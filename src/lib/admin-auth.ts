import crypto from 'crypto';

/**
 * Shared gate for the admin surfaces (/admin/stats and its export).
 *
 * Its OWN token, independent of the site-wide Basic Auth gate — that gate is
 * off during the public beta, so relying on it would leave cost figures and
 * user feedback public. When ADMIN_TOKEN is unset, every admin surface behaves
 * as if it does not exist.
 *
 * Extracted here on 2026-08-30 when the export route was added: a second copy
 * of an access check is a check that drifts, and the copy that drifts is the
 * one nobody looks at.
 */
export function adminTokenOk(provided: string | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !provided) return false;
  // Compare SHA-256 digests rather than the raw strings: equal length for
  // timingSafeEqual, and no length leak from the comparison itself.
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Days of history to read, clamped.
 *
 * Upper bound is the longest retention any of the stores keeps (90 days,
 * privacy policy § 11), so a larger number could only produce empty rows while
 * fanning out thousands of pointless key reads.
 */
export function parseDays(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(90, Math.round(n)));
}
