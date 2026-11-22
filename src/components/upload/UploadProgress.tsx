'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { estimateRemainingMs, formatEtaDuration } from '@/utils/eta';

interface UploadProgressProps {
  processedCount: number;
  totalCount: number;
  isProcessing: boolean;
  /** CLIP embeddings still finishing in the background — see useUpload.ts. */
  pendingEmbeddings: number;
  /** Photos that failed — finished, but not "processed". */
  failedCount?: number;
}

// Time left, from the rate over the LAST few minutes (product-owner decision, 2026-11-22).
// Until then the bar showed a projected TOTAL from the average since the run
// started, which went wrong three ways in real runs: "50 min" at 95 % was read
// as time left; a stall while the tab was hidden kept inflating the figure long
// after the run had recovered (303 min); and photos added mid-run were
// projected across the whole list including the ones already done (158 min).
// A sliding window forgets a stall once it has scrolled out, and "remaining"
// counts only what is still to do.
const WINDOW_MS = 3 * 60 * 1000;
// Below this much evidence inside the window the rate is noise — a handful of
// small files finishing in one burst looks far faster than the batch really is.
const MIN_WINDOW_SPAN_MS = 20 * 1000;
const MIN_WINDOW_DONE = 3;
// The text may change at most this often, so it does not flicker per photo.
const RECALC_INTERVAL_MS = 3000;

export function UploadProgress({
  processedCount,
  totalCount,
  isProcessing,
  pendingEmbeddings,
  failedCount = 0,
}: UploadProgressProps) {
  const t = useTranslations('upload');
  const tc = useTranslations('common');
  const percentage = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;
  // The decode/thumbnail pipeline (isProcessing) finishes before every photo's
  // CLIP embedding has. That remaining work no longer holds anything up here —
  // it continues across the navigation and is waited for on "Analysieren"
  // instead — so this is a note about what is still running, deliberately not
  // a blocked-looking state: the photos really are ready to go on with.
  const finalizing = !isProcessing && pendingEmbeddings > 0;

  // (time, finished) samples inside the window; finished = processed + failed.
  const samplesRef = useRef<Array<{ t: number; done: number }>>([]);
  // 0 = no estimate shown yet; otherwise when the text last changed.
  const lastShownAtRef = useRef(0);
  const [etaText, setEtaText] = useState<string | null>(null);

  useEffect(() => {
    if (!isProcessing) {
      samplesRef.current = [];
      lastShownAtRef.current = 0;
      setEtaText(null);
      return;
    }
    const now = Date.now();
    const done = processedCount + failedCount;
    const samples = samplesRef.current;
    samples.push({ t: now, done });
    // Forget everything older than the window — including the sample from
    // before a stall, so a recovered run is estimated from its current pace.
    while (samples.length > 1 && now - samples[0].t > WINDOW_MS) samples.shift();

    if (lastShownAtRef.current !== 0 && now - lastShownAtRef.current < RECALC_INTERVAL_MS) return;

    const first = samples[0];
    const spanMs = now - first.t;
    const doneInWindow = done - first.done;
    const remaining = Math.max(0, totalCount - done);
    if (spanMs < MIN_WINDOW_SPAN_MS || doneInWindow < MIN_WINDOW_DONE) {
      if (lastShownAtRef.current === 0) return; // still calculating
      // Too little progress in the window (a stall): show "calculating" rather
      // than a figure built on almost nothing.
      lastShownAtRef.current = now;
      setEtaText(null);
      return;
    }
    const remainingMs = estimateRemainingMs(spanMs, doneInWindow, remaining);
    if (remainingMs == null) return;
    lastShownAtRef.current = now;
    setEtaText(formatEtaDuration(remainingMs, tc));
  }, [processedCount, failedCount, totalCount, isProcessing, tc]);

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
          {etaText ? tc('etaRemaining', { time: etaText }) : tc('etaCalculating')}
          {' — '}
          {t('etaDependencyNote')}
        </p>
      )}
      {finalizing && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {t('duplicateScanBackgroundNote')}
        </p>
      )}
    </div>
  );
}
