// Analysis-usage tracking for the admin dashboard. Writes counters to an
// Upstash Redis store (set up via Vercel Marketplace). When the env vars are
// missing, every call is a silent no-op — so production keeps working even
// before stats are wired up.
//
// Counters use Redis INCRBY which is atomic, so concurrent analyses don't
// stomp on each other. Per-day keys auto-expire after 90 days so the
// database stays small.

import { Redis } from '@upstash/redis';

let client: Redis | null | undefined; // undefined = unchecked, null = unavailable

function getClient(): Redis | null {
  if (client !== undefined) return client;
  // Standard Vercel/Upstash integration env vars.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    client = null;
    return null;
  }
  client = new Redis({ url, token });
  return client;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

const DAY_TTL_S = 90 * 24 * 3600;
// Per-IP daily-cap keys contain IP addresses (personal data) and only need to
// live for the current day, so they get a short TTL — data minimisation.
const IP_DAY_TTL_S = 2 * 24 * 3600;

export interface AnalyzeEvent {
  photos: number; // photos analysed in this single API call
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/** Record one analysis call. Never throws — failures are logged and swallowed. */
export async function trackAnalyze(e: AnalyzeEvent): Promise<void> {
  const r = getClient();
  if (!r) return;
  const day = todayKey();
  try {
    // Pipeline (one round-trip) keeps the latency floor low (~30-80 ms total).
    const p = r.pipeline();
    p.incrby('stats:photos:total', e.photos);
    p.incrby('stats:jobs:total', 1);
    p.incrby('stats:tokens:input:total', e.inputTokens);
    p.incrby('stats:tokens:output:total', e.outputTokens);
    p.incrby(`stats:photos:${day}`, e.photos);
    p.incrby(`stats:jobs:${day}`, 1);
    p.incrby(`stats:tokens:input:${day}`, e.inputTokens);
    p.incrby(`stats:tokens:output:${day}`, e.outputTokens);
    p.expire(`stats:photos:${day}`, DAY_TTL_S);
    p.expire(`stats:jobs:${day}`, DAY_TTL_S);
    p.expire(`stats:tokens:input:${day}`, DAY_TTL_S);
    p.expire(`stats:tokens:output:${day}`, DAY_TTL_S);
    await p.exec();
  } catch (err) {
    console.warn('[stats] track failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Today's global photo count (across all users). Used by the beta daily cap in
 * /api/analyze-demo. Returns null when Upstash isn't configured — the caller
 * then skips the cap (the Gemini billing limit remains the hard backstop).
 */
export async function getTodayPhotos(): Promise<number | null> {
  const r = getClient();
  if (!r) return null;
  try {
    const v = await r.get(`stats:photos:${todayKey()}`);
    return v == null ? 0 : Number(v);
  } catch (err) {
    console.warn('[stats] getTodayPhotos failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Read this IP's daily photo counter without reserving anything. Used to refuse
 * a run *before* it starts — reserving here would burn budget on a check.
 */
export async function getIpDailyPhotos(ip: string): Promise<number | null> {
  const r = getClient();
  if (!r) return null;
  try {
    const v = await r.get(`beta:ip:${ip}:${todayKey()}`);
    return v == null ? 0 : Number(v);
  } catch (err) {
    console.warn('[stats] getIpDailyPhotos failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Atomically add `photos` to this IP's daily counter and return the new total
 * (null if Upstash isn't configured). Used by the beta per-IP daily cap — a
 * best-effort guard against a single client draining the free-beta budget.
 */
export async function reserveIpDailyPhotos(ip: string, photos: number): Promise<number | null> {
  const r = getClient();
  if (!r) return null;
  const key = `beta:ip:${ip}:${todayKey()}`;
  try {
    const p = r.pipeline();
    p.incrby(key, photos);
    p.expire(key, IP_DAY_TTL_S);
    const res = (await p.exec()) as unknown[];
    return Number(res[0]);
  } catch (err) {
    console.warn('[stats] reserveIpDailyPhotos failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Upstash-backed fixed-window rate limit. Global across all serverless
 * instances (unlike the in-memory limiter). Returns null when Upstash isn't
 * configured, so the caller can fall back to the in-memory limiter.
 */
export async function rateLimitRedis(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; retryAfter: number } | null> {
  const r = getClient();
  if (!r) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const k = `rl:${key}:${Math.floor(nowSec / windowSec)}`;
  try {
    const p = r.pipeline();
    p.incr(k);
    p.expire(k, windowSec);
    const res = (await p.exec()) as unknown[];
    const count = Number(res[0]);
    if (count > limit) {
      return { ok: false, retryAfter: windowSec - (nowSec % windowSec) };
    }
    return { ok: true, retryAfter: 0 };
  } catch (err) {
    console.warn('[stats] rateLimitRedis failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export interface StatsSnapshot {
  configured: boolean;
  lifetime: { photos: number; jobs: number; inputTokens: number; outputTokens: number; estCostEur: number };
  today: { photos: number; jobs: number; inputTokens: number; outputTokens: number; estCostEur: number };
  byDay: { date: string; photos: number; jobs: number; estCostEur: number }[];
}

// Gemini 2.5 Flash pricing (input $0.30 / output $2.50 per 1M) — matches the
// production model in /api/analyze-demo. Used only for the est. cost column
// on the /admin/stats dashboard. EUR fudge factor ≈ 0.92.
const USD_PER_M_INPUT = 0.30;
const USD_PER_M_OUTPUT = 2.50;
const EUR_PER_USD = 0.92;

function estCostEur(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens / 1_000_000) * USD_PER_M_INPUT + (outputTokens / 1_000_000) * USD_PER_M_OUTPUT;
  return Math.round(usd * EUR_PER_USD * 100) / 100;
}

const lastNDays = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });

/** Read a snapshot for the admin dashboard. Returns zeros if not configured. */
export async function readStats(days = 7): Promise<StatsSnapshot> {
  const r = getClient();
  if (!r) {
    return {
      configured: false,
      lifetime: { photos: 0, jobs: 0, inputTokens: 0, outputTokens: 0, estCostEur: 0 },
      today: { photos: 0, jobs: 0, inputTokens: 0, outputTokens: 0, estCostEur: 0 },
      byDay: [],
    };
  }

  const dayKeys = lastNDays(days);
  // Lifetime + today + N days in one mget.
  const keys = [
    'stats:photos:total', 'stats:jobs:total', 'stats:tokens:input:total', 'stats:tokens:output:total',
    ...dayKeys.flatMap((d) => [
      `stats:photos:${d}`, `stats:jobs:${d}`, `stats:tokens:input:${d}`, `stats:tokens:output:${d}`,
    ]),
  ];

  let values: (string | number | null)[] = [];
  try {
    values = (await r.mget(...keys)) as (string | number | null)[];
  } catch (err) {
    console.warn('[stats] read failed:', err instanceof Error ? err.message : err);
    return {
      configured: true,
      lifetime: { photos: 0, jobs: 0, inputTokens: 0, outputTokens: 0, estCostEur: 0 },
      today: { photos: 0, jobs: 0, inputTokens: 0, outputTokens: 0, estCostEur: 0 },
      byDay: [],
    };
  }

  const n = (v: string | number | null) => (v == null ? 0 : Number(v));

  const lifetime = {
    photos: n(values[0]),
    jobs: n(values[1]),
    inputTokens: n(values[2]),
    outputTokens: n(values[3]),
    estCostEur: estCostEur(n(values[2]), n(values[3])),
  };

  const byDay = dayKeys.map((date, i) => {
    const base = 4 + i * 4;
    const inputT = n(values[base + 2]);
    const outputT = n(values[base + 3]);
    return {
      date,
      photos: n(values[base]),
      jobs: n(values[base + 1]),
      estCostEur: estCostEur(inputT, outputT),
    };
  });

  const today = byDay[0]
    ? {
        photos: byDay[0].photos,
        jobs: byDay[0].jobs,
        inputTokens: n(values[4 + 2]),
        outputTokens: n(values[4 + 3]),
        estCostEur: byDay[0].estCostEur,
      }
    : { photos: 0, jobs: 0, inputTokens: 0, outputTokens: 0, estCostEur: 0 };

  return { configured: true, lifetime, today, byDay };
}
