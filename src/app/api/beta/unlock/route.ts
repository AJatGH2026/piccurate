import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { TIER_CONFIGS } from '@/lib/stripe/prices';
import { saveFeedbackToDb } from '@/lib/feedback';
import { saveFeedback, logFunnel } from '@/lib/beta';
import type { Tier } from '@/types/job';

/**
 * POST /api/beta/unlock — the beta stands in for a purchase.
 *
 * The paid tiers are not buyable yet. Clicking one opens an offer instead: the
 * tester gets that tier's photo allowance once, for free, and we get to see
 * which tier people reach for plus whatever feedback they leave.
 *
 * Two guards that matter:
 *
 * - **A permanent account.** Same reason a purchase would need one: an
 *   anonymous session dies with the browser profile, and an allowance its owner
 *   can never reach again is worse than not granting it.
 * - **Once per account, not once per tier.** Otherwise a tester unlocks S, then
 *   M, then L and leaves with the sum of all three. The gate is
 *   `beta_grant_at IS NULL`, checked and written in one conditional update so
 *   two clicks in flight cannot both win.
 *
 * Feedback is optional on purpose. Making the allowance conditional on it would
 * buy answers, and bought answers tell you what the tester thinks you want.
 */

const GRANTABLE: Tier[] = ['small', 'medium', 'large'];

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const rl = rateLimit(`unlock:${clientIp(request)}`, 20, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const tier = String(body.tier || '') as Tier;
  if (!GRANTABLE.includes(tier)) {
    return NextResponse.json({ error: 'invalid_tier' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.is_anonymous) {
    return NextResponse.json({ error: 'account_required' }, { status: 401 });
  }

  const photos = TIER_CONFIGS[tier].photoLimit;
  const locale = body.locale === 'de' ? 'de' : 'en';

  // The grant is an UPDATE, so it needs a row to update. That row comes from the
  // on_auth_user_created trigger on auth.users — which was missing in production
  // on 2026-08-12, and the database has drifted from supabase/migrations before.
  // Without the row the conditional update below matches nothing, which is
  // indistinguishable from "already granted": the tester was told they had an
  // allowance, the tier came back empty and the count zero, and nothing was
  // written. Same idempotent upsert the job route uses, for the same reason, and
  // it is a no-op whenever the trigger did its work. The id comes from the
  // validated session, never from the body; the admin client is required because
  // profiles has no INSERT policy.
  try {
    await createAdminClient()
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email ?? null, locale, is_anonymous: false },
        { onConflict: 'id', ignoreDuplicates: true }
      );
  } catch (profileErr) {
    // Not fatal on its own: if the row was already there we did not need this,
    // and if it truly cannot be written the update below reports it.
    console.error(`[unlock] profile ensure failed for ${user.id}:`, profileErr);
  }

  // Conditional update: only rows that have no grant yet are touched, so a
  // double click (or a second tab) cannot hand out two allowances.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      beta_grant_tier: tier,
      beta_grant_photos: photos,
      beta_grant_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .is('beta_grant_at', null)
    .select('beta_grant_tier, beta_grant_photos')
    .maybeSingle();

  if (error) {
    console.error('[unlock] profile update failed:', error.message);
    return NextResponse.json({ error: 'unlock_failed' }, { status: 500 });
  }

  if (!updated) {
    // Already granted. Report what they have rather than a bare refusal — the
    // tester's question is "how many do I get", not "did the write succeed".
    const { data: existing } = await supabase
      .from('profiles')
      .select('beta_grant_tier, beta_grant_photos')
      .eq('id', user.id)
      .maybeSingle();

    // No row at all, despite the upsert above. Then this is not "already
    // granted" — nothing was granted and nothing can be. Say so, instead of
    // sending the dialogue into a success state holding a blank tier and zero
    // photos.
    if (!existing) {
      console.error(`[unlock] no profile row for ${user.id} after ensure — grant not written`);
      return NextResponse.json({ error: 'unlock_failed' }, { status: 500 });
    }

    return NextResponse.json(
      {
        error: 'already_granted',
        tier: existing.beta_grant_tier ?? null,
        photos: existing.beta_grant_photos ?? null,
      },
      { status: 409 }
    );
  }

  // Measurement. The tier click on its own is a weak signal here: the allowance
  // matches the tier, so the rational click is always the biggest one. Recorded
  // together with the photo count the tester actually has, the gap between the
  // two is visible — someone with 300 photos picking "large" reads as reach,
  // not as need. See docs/Marketing (pricing_tier_click, photo_count_bucket).
  const photoCount = Number(body.photoCount ?? 0);
  await logFunnel(`unlock_${tier}`);

  const note = String(body.feedback ?? '').trim().slice(0, 2000);
  if (note) {
    const meta = {
      locale,
      path: `beta-unlock/${tier}/photos:${photoCount > 0 ? photoCount : 'unknown'}`,
    };
    const rowId = await saveFeedbackToDb(note, meta);
    if (rowId === null) await saveFeedback(note, meta);
  }

  return NextResponse.json({ ok: true, tier, photos });
}
