// Server-side access rules for the curate flow. One code path, one gate: every
// analysis runs against a real job owned by a real auth user. `BETA_OPEN_ACCESS`
// only relaxes *who* that user has to be and *whether* a paid tier must already
// be paid — it never opens a second, unguarded route.
//
// Deliberately NOT a NEXT_PUBLIC_ variable: the browser must not be able to see
// or spoof it.

/**
 * True while the public beta runs: anonymous accounts may analyse, and a paid
 * tier does not have to be settled first.
 *
 * **Defaults to ON.** That is a conscious fail-open: this switch was introduced
 * into a flow that was already open to everyone, and defaulting to closed would
 * have taken the live site down the moment it deployed. Going live means setting
 * `BETA_OPEN_ACCESS=0` in Vercel — an explicit act, not an omission.
 */
export function betaOpenAccess(): boolean {
  return (process.env.BETA_OPEN_ACCESS ?? '1') !== '0';
}

// Beta cost/abuse caps. Defined here rather than in the analysis route so the
// job endpoint can refuse a run *before* it starts, using the same numbers.
export const BETA_MAX_PHOTOS_PER_REQUEST = Number(process.env.BETA_MAX_PHOTOS_PER_REQUEST ?? '250');
// Raised from 20,000 on 2026-08-10 because of the beta grant: at 5,000 free
// photos per tester, four testers in one day exhausted the old cap — and the
// fifth was refused on the very day the ads were running. Sized against the
// measured per-photo cost (kept out of this public repo; see the local
// pipeline doc) so the ceiling stays a small fraction of the monthly budget.
// The hard backstop remains the Gemini billing spend limit at Google, not this.
export const BETA_DAILY_PHOTO_CAP = Number(process.env.BETA_DAILY_PHOTO_CAP ?? '50000');
export const BETA_IP_DAILY_PHOTO_CAP = Number(process.env.BETA_IP_DAILY_PHOTO_CAP ?? '750');

/**
 * How many photos this caller may still analyse today, or `null` when no cap
 * applies (Upstash unconfigured, or both caps switched off).
 *
 * Checked up front so a run is refused before the first token is spent. The
 * caps used to bite mid-run: a 750-photo job died at batch 36 of 38, and every
 * analysed batch was thrown away — the user had waited and paid for nothing.
 */
export async function remainingPhotoBudget(ip: string): Promise<number | null> {
  const { getTodayPhotos, getIpDailyPhotos } = await import('./stats');
  const limits: number[] = [];

  if (BETA_IP_DAILY_PHOTO_CAP > 0) {
    const used = await getIpDailyPhotos(ip);
    if (used != null) limits.push(Math.max(0, BETA_IP_DAILY_PHOTO_CAP - used));
  }
  if (BETA_DAILY_PHOTO_CAP > 0) {
    const used = await getTodayPhotos();
    if (used != null) limits.push(Math.max(0, BETA_DAILY_PHOTO_CAP - used));
  }
  return limits.length ? Math.min(...limits) : null;
}

/** Human-readable reason for a 402/401, kept in one place for both routes. */
export const ACCESS_ERRORS = {
  accountRequired: 'An account is required. Please sign up or log in.',
  paymentRequired: 'This job has not been paid for yet.',
  jobRequired: 'No valid job for this analysis.',
  jobExhausted: 'This job has reached its photo limit.',
  budgetExceeded: 'Daily analysis capacity for this connection is used up.',
} as const;
