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
export const FUNNEL_STEPS = ['upload', 'configure', 'analysis', 'review', 'results', 'download'] as const;
const ALLOWED = new Set<string>([
  ...FUNNEL_STEPS,
  'finalize',
  'added',
  'removed',
  'terms_accepted', // A3: 18+ / terms confirmation given before analysis
  'persons_confirmed', // A2: reference-photo collective confirmation given
]);

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
  feedbackCount: number;
  emailCount: number;
  recentFeedback: FeedbackEntry[];
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
    feedbackCount: 0,
    emailCount: 0,
    recentFeedback: [],
  };
  if (!r) return empty;
  try {
    const totalKeys = [...FUNNEL_STEPS, 'added', 'removed'].map((s) => `beta:funnel:${s}:total`);
    const [funnelVals, fbCount, emCount, recent] = await Promise.all([
      r.mget(...totalKeys) as Promise<(number | string | null)[]>,
      r.get('beta:feedback:count') as Promise<number | string | null>,
      r.get('beta:emails:count') as Promise<number | string | null>,
      r.lrange('beta:feedback', 0, 19) as Promise<unknown[]>,
    ]);
    const num = (v: number | string | null) => (v == null ? 0 : Number(v));
    const funnel = FUNNEL_STEPS.map((s, i) => ({ step: s, total: num(funnelVals[i]) }));
    const added = num(funnelVals[FUNNEL_STEPS.length]);
    const removed = num(funnelVals[FUNNEL_STEPS.length + 1]);
    const recentFeedback = recent
      .map((x) => parseEntry<FeedbackEntry>(x))
      .filter((x): x is FeedbackEntry => !!x && typeof x.text === 'string');
    return {
      configured: true,
      funnel,
      selection: { added, removed },
      feedbackCount: num(fbCount),
      emailCount: num(emCount),
      recentFeedback,
    };
  } catch (err) {
    console.warn('[beta] readBetaSignals failed:', err instanceof Error ? err.message : err);
    return { ...empty, configured: true };
  }
}
