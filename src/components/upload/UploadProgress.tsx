'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { estimateRemainingMs, formatEtaDuration } from '@/utils/eta';

interface UploadProgressProps {
  processedCount: number;
  totalCount: number;
  isProcessing: boolean;
}

// Below this many finished photos, or this little elapsed time, the measured
// rate is too noisy to show — a handful of small/cached files finishing in
// one burst looks far faster than the batch really is.
const MIN_SAMPLES_FOR_ETA = 3;
const MIN_ELAPSED_FOR_ETA_MS = 750;
// Once shown, the estimate is allowed to change at most this often. It keeps
// using the full cumulative average since the run started (so it still
// self-corrects if later photos turn out slower — HEIC vs. JPEG, say), but
// throttling how often that new number reaches the screen is what stops it
// from visibly flickering on every single finished photo.
const RECALC_INTERVAL_MS = 3000;

export function UploadProgress({
  processedCount,
  totalCount,
  isProcessing,
}: UploadProgressProps) {
  const t = useTranslations('upload');
  const tc = useTranslations('common');
  const percentage = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  // Rate is the cumulative average since the run started (not a one-shot
  // calibration, and not a sliding window) — an early lucky burst of fast
  // files gets pulled back toward reality as more, possibly slower, photos
  // complete. Re-armed on an idle -> active edge, or if more files are
  // dropped in mid-run (totalCount grows), since that is a genuinely
  // different total to estimate.
  const sessionRef = useRef<{ time: number; processed: number; total: number } | null>(null);
  // 0 = no estimate shown yet. Otherwise the timestamp of the last update,
  // used only to throttle how often the displayed text is allowed to change.
  const lastShownAtRef = useRef(0);
  const [etaText, setEtaText] = useState<string | null>(null);

  useEffect(() => {
    if (!isProcessing) {
      sessionRef.current = null;
      lastShownAtRef.current = 0;
      setEtaText(null);
      return;
    }
    if (!sessionRef.current || sessionRef.current.total !== totalCount) {
      sessionRef.current = { time: Date.now(), processed: processedCount, total: totalCount };
      lastShownAtRef.current = 0;
      setEtaText(null);
    }

    const done = processedCount - sessionRef.current.processed;
    const elapsedMs = Date.now() - sessionRef.current.time;
    if (done < MIN_SAMPLES_FOR_ETA || elapsedMs < MIN_ELAPSED_FOR_ETA_MS) return;

    const now = Date.now();
    if (lastShownAtRef.current !== 0 && now - lastShownAtRef.current < RECALC_INTERVAL_MS) return;

    // Projected across ALL photos (not just the ones still pending), since
    // the goal is the total run time, not a moving "time left" countdown.
    const totalMs = estimateRemainingMs(elapsedMs, done, totalCount);
    if (totalMs == null) return;
    lastShownAtRef.current = now;
    setEtaText(formatEtaDuration(totalMs, tc));
  }, [processedCount, totalCount, isProcessing, tc]);

  if (totalCount === 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-zinc-600 dark:text-zinc-400">
          {isProcessing
            ? t('processing', { current: processedCount, total: totalCount })
            : t('ready', { count: processedCount })}
        </span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{percentage}%</span>
      </div>
      <div className="w-full bg-zinc-200 rounded-full h-2 dark:bg-zinc-700">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isProcessing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isProcessing && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {etaText ? tc('etaTotal', { time: etaText }) : tc('etaCalculating')}
          {' — '}
          {t('etaDependencyNote')}
        </p>
      )}
    </div>
  );
}
