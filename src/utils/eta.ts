// Shared "time remaining" estimator for the upload and analysis progress
// bars. Deliberately a live measurement of the current run's own rate, not a
// fixed promise — a hardcoded "in seconds" performance claim was pulled from
// the marketing copy on 2026-08-11 because it stopped holding true past
// ~1,000 photos (product-pipeline.md item 13). This recomputes from what is
// actually happening, so it can't go stale the same way.

export type EtaTranslator = (key: string, values?: Record<string, number>) => string;

/**
 * Average elapsed-time-per-unit since `startedAt`, projected across the
 * remaining units. Returns null while there isn't enough of a sample yet.
 */
export function estimateRemainingMs(
  elapsedMs: number,
  doneCount: number,
  remainingCount: number
): number | null {
  if (doneCount <= 0 || elapsedMs <= 0 || remainingCount <= 0) return null;
  return (elapsedMs / doneCount) * remainingCount;
}

/** Rounds to the nearest 5s (never below 5) so the label doesn't tick every second. */
export function formatEtaDuration(remainingMs: number, tc: EtaTranslator): string {
  const totalSeconds = Math.max(5, Math.round(remainingMs / 1000 / 5) * 5);
  if (totalSeconds < 60) return tc('etaSeconds', { seconds: totalSeconds });
  return tc('etaMinutes', { minutes: Math.max(1, Math.round(totalSeconds / 60)) });
}
