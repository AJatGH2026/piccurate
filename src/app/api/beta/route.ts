import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { logFunnel, saveFeedback, saveEmail } from '@/lib/beta';

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
    const ok = await saveFeedback(String(body.message || ''), {
      locale: String(body.locale || ''),
      path: String(body.path || ''),
    });
    return NextResponse.json({ ok });
  }

  if (type === 'email') {
    const ok = await saveEmail(String(body.email || ''), { locale: String(body.locale || '') });
    return NextResponse.json({ ok });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
