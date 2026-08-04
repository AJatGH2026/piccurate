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

/** Human-readable reason for a 402/401, kept in one place for both routes. */
export const ACCESS_ERRORS = {
  accountRequired: 'An account is required. Please sign up or log in.',
  paymentRequired: 'This job has not been paid for yet.',
  jobRequired: 'No valid job for this analysis.',
  jobExhausted: 'This job has reached its photo limit.',
} as const;
