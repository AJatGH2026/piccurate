// Minimal in-memory fixed-window rate limiter.
//
// NOTE: state lives in process memory, so on a serverless/multi-instance host
// (e.g. Vercel) the limit is per warm instance, not global — it's a
// best-effort guard against a single client hammering an endpoint, NOT a hard
// quota. The real cost backstop is the Anthropic spend cap; for a strict
// global limit, back this with a shared store (Upstash Redis / Vercel KV).
// See product-pipeline.md §4.2.1.

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

/** Best-effort client IP from common proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
