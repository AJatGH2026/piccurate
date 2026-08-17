import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logEvent, ALLOWED_EVENTS } from '@/lib/events';
import { classifyUserAgent } from '@/lib/userAgent';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * POST /api/ev — first-party funnel events for the marketing measurement
 * concept (Marketing/AuswahlBuddy_Event-Spezifikation.md). Same-origin only,
 * no third-party tag (Kampagnenstruktur.md Teil C) — this endpoint IS the
 * "Erstanbieter-Zugriff" the concept's no-cookie-banner argument depends on,
 * so it must never forward anything to Google/Meta itself.
 *
 * No rate limit, same reasoning as the 'event' branch of /api/beta: cheap,
 * fire-and-forget, and restricted to a whitelisted set of names so an
 * unbounded client cannot write arbitrary keys.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const name = String(body.name || '');
  if (!ALLOWED_EVENTS.has(name)) {
    // Not an error worth surfacing to a fire-and-forget beacon — just dropped.
    return NextResponse.json({ ok: false });
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
    session_id: String(body.session_id || ''),
    user_hash: userHash,
    device_class,
    os_family,
    browser_family,
    locale: String(body.locale || ''),
    traffic_source: body.traffic_source ? String(body.traffic_source) : null,
    campaign: body.campaign ? String(body.campaign) : null,
    ad_group: body.ad_group ? String(body.ad_group) : null,
    keyword: body.keyword ? String(body.keyword) : null,
    photo_count_bucket: body.photo_count_bucket ? String(body.photo_count_bucket) : null,
    ab_variant: body.ab_variant === 'pricing_a' || body.ab_variant === 'pricing_b' ? body.ab_variant : null,
    props: body.props && typeof body.props === 'object' ? (body.props as Record<string, unknown>) : {},
  });

  return NextResponse.json({ ok: true });
}
