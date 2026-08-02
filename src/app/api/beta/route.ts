import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { logFunnel, saveFeedback, saveEmail } from '@/lib/beta';
import { emailConfigured, sendFeedbackEmail } from '@/lib/email';
import { saveFeedbackToDb, markFeedbackEmailed } from '@/lib/feedback';

/**
 * POST /api/beta — beta signals: funnel events, feedback, email capture.
 * Body: { type: 'event' | 'feedback' | 'email', ... }. All no-op without Upstash.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const type = String(body.type || '');

  // Funnel events: cheap, fire-and-forget, no rate limit (whitelisted keys only).
  if (type === 'event') {
    const step = String(body.step || '');
    await logFunnel(step);
    if (step === 'finalize') {
      const added = Number(body.added || 0);
      const removed = Number(body.removed || 0);
      if (added > 0) await logFunnel('added', added);
      if (removed > 0) await logFunnel('removed', removed);
    }
    return NextResponse.json({ ok: true });
  }

  // User-submitted content → rate-limit per IP.
  const ip = clientIp(request);
  const rl = rateLimit(`beta:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  if (type === 'feedback') {
    const message = String(body.message || '');
    const meta = { locale: String(body.locale || ''), path: String(body.path || '') };

    // Store FIRST, notify second — the two are independent. An earlier version
    // only stored when the mail failed, so a silently broken mail setup dropped
    // every message. Upstash stays as the fallback store for when Supabase is
    // unavailable; the request counts as handled if either one kept the text.
    const rowId = await saveFeedbackToDb(message, meta);
    const stored = rowId !== null ? true : await saveFeedback(message, meta);

    let mailed = false;
    if (emailConfigured()) {
      mailed = await sendFeedbackEmail({ message, locale: meta.locale, path: meta.path });
      if (mailed && rowId) await markFeedbackEmailed(rowId);
    }

    return NextResponse.json({ ok: stored || mailed });
  }

  if (type === 'email') {
    const ok = await saveEmail(String(body.email || ''), { locale: String(body.locale || '') });
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
