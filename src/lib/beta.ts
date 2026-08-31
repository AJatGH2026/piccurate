// Beta signals: funnel counters, feedback, and email capture — all backed by
// Upstash Redis (same store as stats.ts). Every function is a graceful no-op
// when Upstash isn't configured, so the app works unchanged without it.
//
// Privacy: funnel data is aggregate counters only (no per-user event streams),
// in line with the "signal-only" leaning in product-pipeline.md §2.1. Feedback
// and email are user-submitted and stored as short capped lists.

import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;
function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

const todayKey = () => new Date().toISOString().slice(0, 10);
const DAY_TTL_S = 90 * 24 * 3600;

// Funnel steps that make up the flow, plus the two selection-correction signals.
// `photobook_click` is the step *after* download: the user follows the partner
// link. It is the leading indicator for the affiliate revenue stream, which the
// business plan treats as the second-largest contribution — so it has to be
// countable long before the first commission is earned.
export const FUNNEL_STEPS = ['upload', 'configure', 'analysis', 'review', 'results', 'download', 'photobook_click'] as const;
const ALLOWED = new Set<string>([
  ...FUNNEL_STEPS,
  'finalize',
  'added',
  'removed',
  'terms_accepted', // A3: 18+ / terms confirmation given before analysis
  // NOTE: 'persons_confirmed' was removed on 2026-08-14. It told the server that
  // a person search was happening in a given session — which § 5.4 of
  // docs/legal/personensuche-umsetzungsplan.md lists as a NO-GO: correlated with
  // the analysis request of the same session, that counter is a signal about
  // biometric processing. Do not add a person-related event back here.
  // Which paid tier a tester reaches for while nothing is buyable — written by
  // /api/beta/unlock. Missing from this list until 2026-08-12, so the route
  // logged them and this function dropped every one on the floor.
  'unlock_small',
  'unlock_medium',
  'unlock_large',
]);

/**
 * Count one own-test-traffic event that was deliberately NOT added to the
 * funnel counters (qa_mode cookie, lib/qa-mode.ts — docs/review-notes.md
 * point 2). This counter has no step dimension: unlike lib/events.ts, this
 * store keeps no per-event record to tag, so a skipped funnel step is
 * indistinguishable from another skipped funnel step here.
 */
export async function logInternalFunnelSkip(): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    await r.incrby('beta:funnel:internal_skipped:total', 1);
  } catch (err) {
    console.warn('[beta] logInternalFunnelSkip failed:', err instanceof Error ? err.message : err);
  }
}

/** Increment a funnel/selection counter (total + per-day). Whitelisted keys only. */
export async function logFunnel(step: string, count = 1): Promise<void> {
  const r = getClient();
  if (!r || !ALLOWED.has(step) || !Number.isFinite(count) || count <= 0) return;
  const day = todayKey();
  try {
    const p = r.pipeline();
    p.incrby(`beta:funnel:${step}:total`, count);
    p.incrby(`beta:funnel:${step}:${day}`, count);
    p.expire(`beta:funnel:${step}:${day}`, DAY_TTL_S);
    await p.exec();
  } catch (err) {
    console.warn('[beta] logFunnel failed:', err instanceof Error ? err.message : err);
  }
}

/** Store a feedback message (capped list of the last 500). Returns success. */
export async function saveFeedback(
  message: string,
  meta: { locale?: string; path?: string }
): Promise<boolean> {
  const r = getClient();
  if (!r) return false;
  const text = String(message || '').trim().slice(0, 2000);
  if (!text) return false;
  try {
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      text,
      locale: meta.locale || '',
      path: meta.path || '',
    });
    const p = r.pipeline();
    p.lpush('beta:feedback', entry);
    p.ltrim('beta:feedback', 0, 499);
    p.incr('beta:feedback:count');
    await p.exec();
    return true;
  } catch (err) {
    console.warn('[beta] saveFeedback failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Store a withdrawal declaration (§ 356a BGB). NOT capped and NOT trimmed:
 * every other list here is a beta signal we can afford to lose, this one is
 * evidence of a consumer exercising a statutory right. The mail to our inbox
 * is the second, independent copy — if Upstash is unconfigured or fails, the
 * caller must still treat the mail as the record.
 */
export async function saveWithdrawal(entry: {
  name: string;
  contractRef: string;
  email: string;
  note?: string;
  receivedAt: string;
  locale: string;
}): Promise<boolean> {
  const r = getClient();
  if (!r) return false;
  try {
    await r.lpush('legal:withdrawals', JSON.stringify(entry));
    return true;
  } catch (err) {
    console.warn('[beta] saveWithdrawal failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Store a withdrawal submission the bot filters turned away (capped list of
 * the last 500, so a flood cannot fill the store).
 *
 * Separate from `legal:withdrawals` on purpose, and capped where that one is
 * not: this list is not evidence of an exercised right, it is the audit trail
 * showing what the filters caught. If a consumer ever reports that the form
 * refused them, their submission is in here with its arrival time and can be
 * honoured as of that moment.
 */
export async function saveRejectedWithdrawal(entry: {
  name: string;
  contractRef: string;
  email: string;
  note?: string;
  receivedAt: string;
  locale: string;
  reason: 'honeypot' | 'too_fast';
  ip: string;
}): Promise<boolean> {
  const r = getClient();
  if (!r) return false;
  try {
    const p = r.pipeline();
    p.lpush('legal:withdrawals:rejected', JSON.stringify(entry));
    p.ltrim('legal:withdrawals:rejected', 0, 499);
    p.incr('legal:withdrawals:rejected:count');
    await p.exec();
    return true;
  } catch (err) {
    console.warn('[beta] saveRejectedWithdrawal failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Store a beta submission (feedback or email capture) the bot filters turned
 * away — capped list of the last 200, plus a counter so a flood is visible
 * even after the list has rotated. The withdrawal equivalent is separate and
 * kept longer, because that one may have to be honoured after the fact.
 */
export async function saveRejectedSubmission(entry: {
  kind: string;
  text: string;
  locale: string;
  receivedAt: string;
  reason: 'honeypot' | 'too_fast';
  ip: string;
}): Promise<boolean> {
  const r = getClient();
  if (!r) return false;
  try {
    const p = r.pipeline();
    p.lpush('beta:rejected', JSON.stringify(entry));
    p.ltrim('beta:rejected', 0, 199);
    p.incr('beta:rejected:count');
    await p.exec();
    return true;
  } catch (err) {
    console.warn('[beta] saveRejectedSubmission failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Store a captured email (capped list of the last 1000). Returns success. */
export async function saveEmail(email: string, meta: { locale?: string }): Promise<boolean> {
  const r = getClient();
  if (!r) return false;
  const e = String(email || '').trim().toLowerCase();
  if (e.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return false;
  try {
    const entry = JSON.stringify({ ts: new Date().toISOString(), email: e, locale: meta.locale || '' });
    const p = r.pipeline();
    p.lpush('beta:emails', entry);
    p.ltrim('beta:emails', 0, 999);
    p.incr('beta:emails:count');
    await p.exec();
    return true;
  } catch (err) {
    console.warn('[beta] saveEmail failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

export interface FeedbackEntry {
  ts: string;
  text: string;
  locale: string;
  path: string;
}
export interface BetaSignals {
  configured: boolean;
  funnel: { step: string; total: number }[];
  selection: { added: number; removed: number };
  consent: { termsAccepted: number };
  unlocks: { small: number; medium: number; large: number };
  feedbackCount: number;
  emailCount: number;
  recentFeedback: FeedbackEntry[];
  // All-time count of events skipped because they came from the qa_mode
  // cookie (docs/review-notes.md point 2) — see logInternalFunnelSkip.
  internalSkipped: number;
}

function parseEntry<T>(x: unknown): T | null {
  try {
    return (typeof x === 'string' ? JSON.parse(x) : x) as T;
  } catch {
    return null;
  }
}

/** Read a beta-signals snapshot for the admin dashboard. */
export async function readBetaSignals(): Promise<BetaSignals> {
  const r = getClient();
  const empty: BetaSignals = {
    configured: false,
    funnel: [],
    selection: { added: 0, removed: 0 },
    consent: { termsAccepted: 0 },
    unlocks: { small: 0, medium: 0, large: 0 },
    feedbackCount: 0,
    emailCount: 0,
    recentFeedback: [],
    internalSkipped: 0,
  };
  if (!r) return empty;
  try {
    // Extra keys beyond the funnel/selection ones: consent checkboxes (should
    // track 1:1 with `analysis`) and beta-unlock clicks per tier (written by
    // /api/beta/unlock, previously never read back — see product-pipeline.md §4).
    // 'persons_confirmed' deliberately absent — see the note at ALLOWED above.
    // Historical values may still sit in Redis; they are simply not read back.
    const extraSteps = ['terms_accepted', 'unlock_small', 'unlock_medium', 'unlock_large'];
    const totalKeys = [...FUNNEL_STEPS, 'added', 'removed', ...extraSteps].map((s) => `beta:funnel:${s}:total`);
    const [funnelVals, fbCount, emCount, recent, internalSkipped] = await Promise.all([
      r.mget(...totalKeys) as Promise<(number | string | null)[]>,
      r.get('beta:feedback:count') as Promise<number | string | null>,
      r.get('beta:emails:count') as Promise<number | string | null>,
      r.lrange('beta:feedback', 0, 19) as Promise<unknown[]>,
      r.get('beta:funnel:internal_skipped:total') as Promise<number | string | null>,
    ]);
    const num = (v: number | string | null) => (v == null ? 0 : Number(v));
    const funnel = FUNNEL_STEPS.map((s, i) => ({ step: s, total: num(funnelVals[i]) }));
    const added = num(funnelVals[FUNNEL_STEPS.length]);
    const removed = num(funnelVals[FUNNEL_STEPS.length + 1]);
    const extraBase = FUNNEL_STEPS.length + 2;
    // Order must match `extraSteps` exactly — this is positional, so dropping a
    // step there without dropping it here shifts every following counter by one.
    const [termsAccepted, unlockSmall, unlockMedium, unlockLarge] = extraSteps.map(
      (_, i) => num(funnelVals[extraBase + i])
    );
    const recentFeedback = recent
      .map((x) => parseEntry<FeedbackEntry>(x))
      .filter((x): x is FeedbackEntry => !!x && typeof x.text === 'string');
    return {
      configured: true,
      funnel,
      selection: { added, removed },
      consent: { termsAccepted },
      unlocks: { small: unlockSmall, medium: unlockMedium, large: unlockLarge },
      feedbackCount: num(fbCount),
      emailCount: num(emCount),
      recentFeedback,
      internalSkipped: num(internalSkipped),
    };
  } catch (err) {
    console.warn('[beta] readBetaSignals failed:', err instanceof Error ? err.message : err);
    return { ...empty, configured: true };
  }
}
