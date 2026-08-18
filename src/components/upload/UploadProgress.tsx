'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { estimateRemainingMs, formatEtaDuration } from '@/utils/eta';

interface UploadProgressProps {
  processedCount: number;
  totalCount: number;
  isProcessing: boolean;
}

// Below this many finished photos in the current run, the measured rate is
// too noisy to show (the first photo can be a slow outlier decode).
const MIN_SAMPLES_FOR_ETA = 3;

export function UploadProgress({
  processedCount,
  totalCount,
  isProcessing,
}: UploadProgressProps) {
  const t = useTranslations('upload');
  const tc = useTranslations('common');
  const percentage = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  // The total-duration estimate is calibrated ONCE per run, from an early
  // sample, then frozen — recomputing it on every finished photo made the
  // number jump around (concurrent decodes finish in bursts, so the rate
  // between any two single updates is noisy) instead of settling on a
  // usable prognosis. Re-armed on an idle -> active edge, or if more files
  // are dropped in mid-run (totalCount grows), since that is a genuinely
  // different total to estimate.
  const sessionRef = useRef<{ time: number; processed: number; total: number } | null>(null);
  const lockedRef = useRef(false);
  const [etaText, setEtaText] = useState<string | null>(null);

  useEffect(() => {
    if (!isProcessing) {
      sessionRef.current = null;
      lockedRef.current = false;
      setEtaText(null);
      return;
    }
    if (!sessionRef.current || sessionRef.current.total !== totalCount) {
      sessionRef.current = { time: Date.now(), processed: processedCount, total: totalCount };
      lockedRef.current = false;
      setEtaText(null);
    }
    if (lockedRef.current) return;

    const done = processedCount - sessionRef.current.processed;
    const elapsedMs = Date.now() - sessionRef.current.time;
    if (done < MIN_SAMPLES_FOR_ETA || elapsedMs <= 0) return;

    // Projected across ALL photos (not just the ones still pending), since
    // the goal is the total run time, not a moving "time left" countdown.
    const totalMs = estimateRemainingMs(elapsedMs, done, totalCount);
    if (totalMs == null) return;
    lockedRef.current = true;
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
