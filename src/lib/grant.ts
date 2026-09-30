// The beta grant as a pot of photos.
//
// A tester unlocks a tier once (profiles.beta_grant_*). That becomes ONE job
// (jobs.beta_grant, unique per user — migration 009) which holds the allowance
// for 30 days. Every session draws from that job; the job's counters are the
// truth. Photos and interim results are not stored, so each new session counts
// afresh: photos selected again on another day are charged again.
//
// Same logic as a purchase will have, on purpose (product-owner decision, 2026-09-30) — the
// beta only differs in that nobody pays.

import { TIER_CONFIGS } from '@/lib/stripe/prices';
import type { Tier } from '@/types/job';

export const GRANT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

interface SupabaseLike {
  from: (table: string) => any;
}

export interface GrantStatus {
  tier: Tier;
  /** Photos the grant was worth when it was unlocked. */
  total: number;
  /** Photos still available. */
  remaining: number;
  /** Until when the allowance can be used (ISO). */
  expiresAt: string;
  /** The grant's job, once one exists. */
  jobId: string | null;
}

/**
 * The user's active grant, or null when there is none, it ran out of time, or
 * its job has expired. An expired grant is gone for good — one per account — so
 * such a user is treated like any other from then on.
 */
export async function getGrantStatus(db: SupabaseLike, userId: string): Promise<GrantStatus | null> {
  const { data: profile } = await db
    .from('profiles')
    .select('beta_grant_tier, beta_grant_photos, beta_grant_at')
    .eq('id', userId)
    .maybeSingle();
  const tier = profile?.beta_grant_tier as Tier | null | undefined;
  if (!tier || !profile?.beta_grant_at || !(tier in TIER_CONFIGS)) return null;

  const total = Number(profile.beta_grant_photos ?? TIER_CONFIGS[tier].photoLimit);
  const grantEnd = new Date(new Date(profile.beta_grant_at).getTime() + GRANT_DAYS * DAY_MS);

  const { data: job } = await db
    .from('jobs')
    .select('id, photo_count, photo_limit, expires_at')
    .eq('user_id', userId)
    .eq('beta_grant', true)
    .maybeSingle();

  if (job) {
    const end = new Date(job.expires_at as string);
    if (end.getTime() < Date.now()) return null;
    return {
      tier,
      total: Number(job.photo_limit),
      remaining: Math.max(0, Number(job.photo_limit) - Number(job.photo_count)),
      expiresAt: end.toISOString(),
      jobId: job.id as string,
    };
  }

  if (grantEnd.getTime() < Date.now()) return null;
  return { tier, total, remaining: total, expiresAt: grantEnd.toISOString(), jobId: null };
}
