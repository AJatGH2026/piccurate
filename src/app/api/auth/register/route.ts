import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { detectBot } from '@/lib/bot-filter';
import { saveRejectedSubmission } from '@/lib/beta';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { serverConfig } from '@/lib/config';

/**
 * POST /api/auth/register — sign-up behind the same invisible bot filter the
 * withdrawal function and the beta signals already use.
 *
 * Why this route exists at all: registration used to call
 * `supabase.auth.signUp()` straight from the browser, so it never passed a
 * route of ours and `detectBot()` could not see it. Between 9 and 14 August
 * 2026 that produced 168 sign-ups — the same inbox re-registered under several
 * dot-spellings (Gmail ignores dots, so those all deliver to one person), plus
 * a long tail of strangers' work addresses, each of them sent a confirmation
 * mail they never asked for. Routing the call through here closes that without
 * putting a CAPTCHA in front of the people we actually want.
 *
 * Two properties of the old client-side call are preserved deliberately:
 *
 * - **Enumeration protection.** `signUp` does not report an error when the
 *   address already has a confirmed account (the tell is
 *   `data.user.identities === []`, which we still do not act on). This route
 *   therefore answers the same way whether or not the address was new, and the
 *   confirmation screen stays conditional — see the note in auth/register.
 * - **The § 312f / GDPR fields.** `locale` and `gdpr_consent_at` ride along in
 *   `options.data` exactly as before, so the profile trigger and the contract
 *   confirmation still get what they need.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 });
  }

  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  const locale = String(body.locale || '') === 'de' ? 'de' : 'en';
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Missing credentials' }, { status: 400 });
  }

  // Per-IP throttle. Ten an hour leaves room for a mistyped password and a
  // couple of retries — and for a household or an office behind one address —
  // while a burst like the August one (78 in a single day) runs into it early.
  const ip = clientIp(request);
  const rl = await checkRateLimit(`register:${ip}`, 10, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  // Same two signals, same handling as everywhere else: recorded rather than
  // discarded, and reported honestly instead of faked as success. A rejected
  // human simply submits again, and the second attempt has a longer dwell time,
  // so the only false positive that is possible here clears itself.
  //
  // The password is never part of what gets recorded — only the address, which
  // is what makes a rejected batch recognisable as one bot later.
  const verdict = detectBot(body);
  if (verdict) {
    await saveRejectedSubmission({
      kind: 'register',
      text: email.slice(0, 200),
      locale,
      receivedAt: new Date().toISOString(),
      reason: verdict,
      ip,
    });
    return NextResponse.json({ ok: false, error: 'rejected' }, { status: 400 });
  }

  // Carry the return path through the confirmation mail, exactly as the client
  // did: someone who came from the pricing page to unlock a beta grant should
  // land back there, not on the home page with no memory of what they wanted.
  const next = String(body.next || '');
  const appUrl = serverConfig.appUrl();
  const emailRedirectTo =
    next && next !== `/${locale}`
      ? `${appUrl}/${locale}/auth/callback?next=${encodeURIComponent(next)}`
      : `${appUrl}/${locale}/auth/callback`;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { locale, gdpr_consent_at: new Date().toISOString() },
      emailRedirectTo,
    },
  });

  if (error) {
    // Genuine refusals (password too short, address malformed) belong in front
    // of the user — they are the only way to fix the form. Supabase does not
    // put "account exists" in here, so passing the message through does not
    // leak who has an account.
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
