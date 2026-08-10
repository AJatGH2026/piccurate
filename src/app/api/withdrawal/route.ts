import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { saveWithdrawal } from '@/lib/beta';
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
 * without keeping a session must still be able to reach it. Rate limiting is
 * the only gate.
 */

const MAX = { name: 200, contractRef: 200, email: 200, note: 2000 } as const;

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
  const rl = rateLimit(`withdrawal:${ip}`, 10, 60 * 60_000);
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

  // Only the three items § 356a Abs. 2 lists are required. Asking for more as a
  // condition of withdrawing would itself be an obstacle to the right.
  const missing: string[] = [];
  if (!name) missing.push('name');
  if (!contractRef) missing.push('contractRef');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('email');
  if (missing.length) {
    return NextResponse.json({ error: 'missing_fields', fields: missing }, { status: 400 });
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
