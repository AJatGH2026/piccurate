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

// Failures and time-in-background, added 2026-11-21: large runs were seen
// where, past ~1,400 photos, every new photo failed within ~30 ms, and where
// the shared model queue stood still for minutes. Neither could be explained,
// because a failed photo left no trace in the event and nobody knew whether
// the tab had been in the background.
//
// What is recorded is deliberately coarse: the phase a photo failed in and the
// error's NAME from a fixed list (RangeError, EncodingError …) — never its
// message, which can carry a file name (privacy policy § 9.1 promises none).
const failures = new Map<string, number>();
const KNOWN_ERROR_NAMES = new Set([
  'Error',
  'RangeError',
  'TypeError',
  'EncodingError',
  'InvalidStateError',
  'NotReadableError',
  'NotFoundError',
  'QuotaExceededError',
  'AbortError',
  'SecurityError',
  'DataError',
  'OperationError',
]);

function errorName(err: unknown): string {
  const name =
    err && typeof err === 'object' && 'name' in err && typeof (err as { name: unknown }).name === 'string'
      ? (err as { name: string }).name
      : typeof err === 'string'
        ? 'String'
        : 'Unknown';
  return KNOWN_ERROR_NAMES.has(name) || name === 'String' || name === 'Unknown' ? name : 'Other';
}

/**
 * Count one failure. `phase` says where (exif, convert_face, decode, … or
 * `photo` for the per-photo total, `face` for the person-search pass); the
 * per-photo total additionally counts the error name.
 */
export function recordFailure(phase: string, err: unknown): void {
  hookVisibility();
  if (phases.size === 0 && failures.size === 0) resetRunCounters();
  failures.set(`fail_${phase}_n`, (failures.get(`fail_${phase}_n`) ?? 0) + 1);
  if (phase === 'photo') {
    const key = `err_${errorName(err)}_n`;
    failures.set(key, (failures.get(key) ?? 0) + 1);
  }
}

/**
 * Count one occurrence of something that is neither a timing nor a failure —
 * since 2026-11-22 which way each HEIC took (`conv_server_n`,
 * `conv_browser_<why>_n`, `conv_fallback_<why>_n`), so the 4.7 s per HEIC
 * measured in the browser can be split into "server was slow" and "the slow
 * browser path ran instead". Rides in the same per-run map as the failures.
 */
export function countEvent(key: string): void {
  hookVisibility();
  if (phases.size === 0 && failures.size === 0) resetRunCounters();
  failures.set(key, (failures.get(key) ?? 0) + 1);
}

// Time the page spent hidden during the run (another tab, minimised window,
// screen locked). Browsers throttle hidden pages hard, which is the leading
// explanation for the minute-long queue stalls — this turns it into a number.
let hiddenMs = 0;
let hiddenCount = 0;
let hiddenSince: number | null = null;
let visibilityHooked = false;

function hookVisibility(): void {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  if (document.visibilityState === 'hidden') hiddenSince = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (hiddenSince === null) {
        hiddenSince = Date.now();
        hiddenCount++;
      }
    } else if (hiddenSince !== null) {
      hiddenMs += Date.now() - hiddenSince;
      hiddenSince = null;
    }
  });
}

function resetRunCounters(): void {
  failures.clear();
  hiddenMs = 0;
  hiddenCount = 0;
  // A page that is hidden right now stays counted from this moment on.
  if (hiddenSince !== null) hiddenSince = Date.now();
}

function runExtras(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of failures) out[k] = v;
  const openHidden = hiddenSince !== null ? Date.now() - hiddenSince : 0;
  out.hidden_ms = hiddenMs + openHidden;
  out.hidden_n = hiddenCount;
  return out;
}

/** Record one observation for a phase. */
export function recordPhase(phase: string, ms: number): void {
  hookVisibility();
  // First observation of a new run: start its failure and background counts
  // fresh. (takeTimingSummary clears the phases at the end of each run.)
  if (phases.size === 0 && failures.size === 0) resetRunCounters();
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
  } catch (err) {
    recordFailure(phase, err);
    throw err;
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
  const out: Record<string, number> = runExtras();
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
  const out = summarize();
  phases.clear();
  resetRunCounters();
  return out;
}
