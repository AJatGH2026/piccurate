import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';
import { saveWithdrawal, saveRejectedWithdrawal } from '@/lib/beta';
import { emailConfigured, sendWithdrawalReceipt, sendWithdrawalNotice } from '@/lib/email';

/**
 * POST /api/withdrawal — the confirmation step of the electronic withdrawal
 * function required by § 356a BGB (in force since 19 June 2026).
 *
 * The statute is specific about the mechanics, and two of them shape this
 * handler:
 *
 * - Abs. 5: the declaration counts as timely if it was *transmitted* before the
 *   deadline. So the moment of receipt is stamped here, server-side, before any
 *   downstream work — never in the browser, whose clock is the user's to set.
 * - Abs. 4: a receipt on a durable medium must go out "unverzüglich" with the
 *   content plus the date and time of receipt. That mail is the consumer's
 *   evidence, so a failure to send it is a failed request, not a warning.
 *
 * Deliberately open to everyone: § 356a Abs. 1 requires the function to be
 * easily accessible throughout the withdrawal period, and a consumer who bought
 * without keeping a session must still be able to reach it. No login, no
 * captcha, no puzzle — only filters a human never notices.
 *
 * Those filters exist because the form was found by a spam bot within a day of
 * going live on 10 August 2026: random-string submissions every few minutes,
 * each one addressed at a stranger's mailbox. Left open, the receipt Abs. 4
 * demands turns the function into a mail relay pointed at third parties, and
 * the sending domain's reputation goes with it.
 *
 * Every rejection here is recoverable on purpose. A false positive is far more
 * expensive than a passed-through bot: it would be a consumer whose declaration
 * we dropped. So nothing is silently swallowed — a rejected submission is
 * stored with its reason, and the caller gets the error whose message names the
 * email route, which is an equally effective withdrawal.
 */

const MAX = { name: 200, contractRef: 200, email: 200, note: 2000 } as const;

// A human needs longer than this to read four labels and fill three of them,
// even pasting from a confirmation mail. Bots post within milliseconds.
const MIN_DWELL_MS = 2500;

function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const ip = clientIp(request);
  // Upstash-backed, so the limit holds across serverless instances — the
  // in-memory limiter this used to call counts per warm Lambda and a bot
  // spread over instances never reached it. Three per hour still covers a
  // consumer withdrawing from more than one contract in a sitting.
  const rl = await checkRateLimit(`withdrawal:${ip}`, 3, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const name = clean(body.name, MAX.name);
  const contractRef = clean(body.contractRef, MAX.contractRef);
  const email = clean(body.email, MAX.email).toLowerCase();
  const note = clean(body.note, MAX.note);
  const locale = body.locale === 'de' ? 'de' : 'en';

  // Two signals a human cannot produce and a bot cannot see. Both are checked
  // only when present: a tab opened before this deployment posts neither, and
  // an absent field must never count as evidence against the sender.
  const honeypot = String(body.website ?? '').trim();
  const dwellMs = Number(body.elapsedMs);
  const tooFast = Number.isFinite(dwellMs) && dwellMs >= 0 && dwellMs < MIN_DWELL_MS;

  if (honeypot || tooFast) {
    // Kept, not discarded. If this ever catches a real person, their
    // declaration and its arrival time are still on record and can be honoured
    // with the original timestamp.
    await saveRejectedWithdrawal({
      name,
      contractRef,
      email,
      note: note || undefined,
      receivedAt: new Date().toISOString(),
      locale,
      reason: honeypot ? 'honeypot' : 'too_fast',
      ip,
    });
    return NextResponse.json({ error: 'rejected' }, { status: 400 });
  }

  // Only the three items § 356a Abs. 2 lists are required. Asking for more as a
  // condition of withdrawing would itself be an obstacle to the right.
  const missing: string[] = [];
  if (!name) missing.push('name');
  if (!contractRef) missing.push('contractRef');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('email');
  if (missing.length) {
    return NextResponse.json({ error: 'missing_fields', fields: missing }, { status: 400 });
  }

  // A second limit on the recipient, because the first one is only as good as
  // the attacker's IP supply. This is what stops the receipt from being aimed
  // at a stranger's mailbox over and over from rotating addresses.
  const rlMail = await checkRateLimit(`withdrawal:to:${email}`, 3, 24 * 60 * 60_000);
  if (!rlMail.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rlMail.retryAfter) } }
    );
  }

  const receivedAt = new Date();
  const declaration = { name, contractRef, email, note: note || undefined, receivedAt, locale };

  // Record first, notify second — the same ordering as the feedback route, and
  // for the same reason: a broken mail setup must not lose the declaration.
  await saveWithdrawal({
    name,
    contractRef,
    email,
    note: note || undefined,
    receivedAt: receivedAt.toISOString(),
    locale,
  });

  if (!emailConfigured()) {
    // Without a mail provider we cannot deliver the receipt Abs. 4 demands.
    // Say so rather than showing a success screen that promises an email which
    // will never arrive — the consumer would be left without their evidence.
    console.error('[withdrawal] RESEND_API_KEY unset — receipt could not be sent.');
    return NextResponse.json({ error: 'receipt_unavailable' }, { status: 503 });
  }

  const receipt = await sendWithdrawalReceipt(declaration);
  await sendWithdrawalNotice(declaration);

  if (!receipt) {
    return NextResponse.json({ error: 'receipt_failed' }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    receivedAt: receivedAt.toISOString(),
  });
}
