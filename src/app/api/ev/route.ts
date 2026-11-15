import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logEvent, ALLOWED_EVENTS } from '@/lib/events';
import { isQaRequest } from '@/lib/qa-mode';
import { classifyUserAgent } from '@/lib/userAgent';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { checkRateLimit, clientIp } from '@/lib/rate-limit';

// Bounds on what one event may carry. Real events are a few hundred bytes; the
// limits only exist so the endpoint cannot be used to fill the event store or
// to push arbitrary text into the dashboard that campaign decisions are read
// from.
const MAX_BODY_CHARS = 8_000;
const MAX_PROPS_CHARS = 2_000;
// Per connection. A long analysis reports progress per batch and a review
// session reports every add/remove, so this sits well above a busy visitor.
const EV_RL_LIMIT = 300;
const EV_RL_WINDOW_MS = 60_000;

/** A caller-supplied label: a single line, bounded, or null when empty. */
function label(v: unknown, max: number): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  // Control characters become spaces (by char code, to keep this source plain ASCII).
  const s = Array.from(String(v), (ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .trim()
    .slice(0, max);
  return s || null;
}

/**
 * POST /api/ev — first-party funnel events for the marketing measurement
 * concept (Marketing/AuswahlBuddy_Event-Spezifikation.md). Same-origin only,
 * no third-party tag (Kampagnenstruktur.md Teil C) — this endpoint IS the
 * "Erstanbieter-Zugriff" the concept's no-cookie-banner argument depends on,
 * so it must never forward anything to Google/Meta itself.
 *
 * Restricted to a whitelisted set of names, bounded in size and rate-limited
 * per connection (since 2026-11-15): cheap for a visitor, but no longer an
 * open tap into the event store.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: 'Body too large' }, { status: 413 });
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const name = String(body.name || '');
  if (!ALLOWED_EVENTS.has(name)) {
    // Not an error worth surfacing to a fire-and-forget beacon — just dropped.
    return NextResponse.json({ ok: false });
  }

  const rl = await checkRateLimit(`ev:${clientIp(request)}`, EV_RL_LIMIT, EV_RL_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  // `props` is free-form by design (each event has its own), so it is bounded
  // as a whole rather than field by field. Oversized props are dropped, the
  // event itself still counts.
  let props: Record<string, unknown> = {};
  if (body.props && typeof body.props === 'object' && !Array.isArray(body.props)) {
    try {
      if (JSON.stringify(body.props).length <= MAX_PROPS_CHARS) {
        props = body.props as Record<string, unknown>;
      }
    } catch {
      /* not serialisable — dropped */
    }
  }

  const { device_class, os_family, browser_family } = classifyUserAgent(
    request.headers.get('user-agent')
  );

  // user_hash: only for a REAL account, never for the anonymous auth users
  // the free-beta flow also creates — matching the spec's two-tier identity
  // model (§1.2). Guarded on the env vars the same way results/page.tsx
  // guards its own Supabase call, so a Supabase-less local dev run still works.
  let userHash: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !user.is_anonymous) {
        userHash = 'u_' + crypto.createHash('sha256').update(user.id).digest('hex').slice(0, 16);
      }
    } catch {
      /* stay anonymous rather than fail the event */
    }
  }

  await logEvent({
    name,
    ts: new Date().toISOString(),
    session_id: label(body.session_id, 64) ?? '',
    user_hash: userHash,
    device_class,
    os_family,
    browser_family,
    locale: label(body.locale, 8) ?? '',
    traffic_source: label(body.traffic_source, 120),
    campaign: label(body.campaign, 120),
    ad_group: label(body.ad_group, 120),
    keyword: label(body.keyword, 120),
    photo_count_bucket: label(body.photo_count_bucket, 24),
    ab_variant: body.ab_variant === 'pricing_a' || body.ab_variant === 'pricing_b' ? body.ab_variant : null,
    internal: isQaRequest(request),
    props,
  });

  return NextResponse.json({ ok: true });
}
