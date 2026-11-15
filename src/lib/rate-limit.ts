// Minimal in-memory fixed-window rate limiter.
//
// NOTE: state lives in process memory, so on a serverless/multi-instance host
// (e.g. Vercel) the limit is per warm instance, not global — it's a
// best-effort guard against a single client hammering an endpoint, NOT a hard
// quota. The real cost backstop is the Anthropic spend cap; for a strict
// global limit, back this with a shared store (Upstash Redis / Vercel KV).
// See product-pipeline.md §4.2.1.

import { rateLimitRedis } from './stats';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  retryAfter: number; // seconds until the window resets
}

/**
 * Allow up to `limit` calls per `windowMs` for a given key (e.g. client IP).
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count++;
  return { ok: true, retryAfter: 0 };
}

/**
 * Rate limit backed by Upstash when configured (global across serverless
 * instances), falling back to the in-memory limiter otherwise. Prefer this in
 * API routes so the limit actually holds across Vercel instances.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = await rateLimitRedis(key, limit, Math.ceil(windowMs / 1000));
  return redis ?? rateLimit(key, limit, windowMs);
}

/**
 * Best-effort client IP. Prefer Vercel's `x-real-ip` (set by the platform to
 * the true client IP; not client-spoofable) over the left-most value of
 * `x-forwarded-for`, which a caller can forge. Falls back to XFF for local dev.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip');
  if (real) return normalizeIp(real);
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return normalizeIp(xff.split(',')[0]);
  return 'unknown';
}

/**
 * The address a limit should be counted against.
 *
 * IPv4 stays as it is. An IPv6 address is cut to its /64 prefix: one home or
 * mobile connection is handed a whole /64, so counting the full address gives
 * every caller as many separate allowances as they care to pick addresses.
 * Anything that does not parse is returned unchanged (and length-capped, since
 * the value ends up in a storage key).
 */
export function normalizeIp(raw: string): string {
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith('[')) ip = ip.slice(1).split(']')[0];
  const zone = ip.indexOf('%');
  if (zone >= 0) ip = ip.slice(0, zone);
  ip = ip.slice(0, 64);
  if (!ip.includes(':')) return ip || 'unknown';

  // IPv4 reached over an IPv6 socket.
  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];

  const halves = ip.split('::');
  if (halves.length > 2) return ip;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const groups =
    halves.length === 2
      ? [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail]
      : head;
  const prefix = groups.slice(0, 4);
  if (prefix.length < 4 || prefix.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return ip;
  return prefix.map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}
