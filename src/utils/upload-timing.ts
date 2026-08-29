// Per-phase timing for the upload pipeline — diagnostic instrumentation.
//
// Why this exists (2026-08-29): upload speed was debugged twice from
// architecture alone and the reasoning was wrong both times. The 4-minute
// laptop run was attributed to CLIP; the real cause was /api/convert 500ing on
// a missing libvips, which made every HEIC take the slow browser path AND cost
// a wasted full-size upload first. Guessing again about the person-search path
// (now 2.3-4.1 s/photo against 1.1 s without) is not worth another cycle.
//
// The question this has to answer: with three models per photo sharing ONE
// serialized queue (utils/inferenceSerializer.ts), is the queue the wall, or is
// it the decode/network work around it? That is why inference is recorded as
// two separate numbers — time spent WAITING for the queue, and time spent
// actually computing. A large wait with a small run says the chain is
// saturated and more decode concurrency would buy nothing.
//
// Aggregated per run and emitted once with `file_transfer_ready`, so it costs
// one event rather than one per photo, and shows up in /admin/stats without
// anyone needing to open DevTools on the machine that is actually slow.

type Agg = { n: number; totalMs: number; maxMs: number };

const phases = new Map<string, Agg>();

/** Record one observation for a phase. */
export function recordPhase(phase: string, ms: number): void {
  const a = phases.get(phase);
  if (a) {
    a.n++;
    a.totalMs += ms;
    if (ms > a.maxMs) a.maxMs = ms;
  } else {
    phases.set(phase, { n: 1, totalMs: ms, maxMs: ms });
  }
}

/** Await `fn`, recording how long it took under `phase`. Rethrows unchanged. */
export async function timePhase<T>(phase: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    recordPhase(phase, Date.now() - t0);
  }
}

/**
 * Log the running totals WITHOUT resetting them.
 *
 * The completion event is not enough on its own: a run slow enough to be worth
 * measuring is exactly the run the tester gives up on, and an abandoned run
 * used to emit nothing at all. Reported 2026-08-29 — 30 photos with a
 * reference photo, abandoned at 5:30, no measurement. Progress beats a perfect
 * record that never arrives.
 */
export function logTimingProgress(done: number): void {
  if (phases.size === 0) return;
  console.info(`[upload] phase timings after ${done} photos (ms)`, summarize());
}

function summarize(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [phase, a] of phases) {
    out[`${phase}_n`] = a.n;
    out[`${phase}_avg_ms`] = Math.round(a.totalMs / a.n);
    out[`${phase}_max_ms`] = a.maxMs;
  }
  return out;
}

/** Everything recorded so far, without resetting — for an abandoned run. */
export function peekTimingSummary(): Record<string, number> | null {
  return phases.size === 0 ? null : summarize();
}

/**
 * Flat, event-friendly summary of everything recorded so far, then reset.
 *
 * Averages rather than totals: the run length already says how many photos
 * there were, and an average is the number that can be compared between a
 * 46-photo and a 71-photo run. Max comes along because a single 5-second
 * outlier and a uniformly slow phase need different fixes.
 *
 * Returns null when nothing was recorded, so a caller can omit the field
 * rather than send an empty object.
 */
export function takeTimingSummary(): Record<string, number> | null {
  if (phases.size === 0) return null;
  const out: Record<string, number> = {};
  for (const [phase, a] of phases) {
    out[`${phase}_n`] = a.n;
    out[`${phase}_avg_ms`] = Math.round(a.totalMs / a.n);
    out[`${phase}_max_ms`] = a.maxMs;
  }
  phases.clear();
  return out;
}
