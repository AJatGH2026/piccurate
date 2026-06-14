'use client';

import { useTranslations } from 'next-intl';
import { useCriteria } from '@/hooks/useCriteria';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

const BATCH_SIZE = 20;

export default function ConfigurePage() {
  const t = useTranslations('criteria');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const photos = usePhotoStore((s) => s.photos);
  const applyAnalysisResults = usePhotoStore((s) => s.applyAnalysisResults);
  const rerunSelection = usePhotoStore((s) => s.rerunSelection);
  const savedCount = photos.filter((p) => p.saved).length;
  const { criteria, toggleCriterion, setWeight, updateCriterion, reset } =
    useCriteria();

  const criteriaItems = [
    { key: 'preferFaces' as const, label: t('faces'), desc: t('facesDesc') },
    { key: 'preferAnimals' as const, label: t('animals'), desc: t('animalsDesc') },
    { key: 'preferLandscapes' as const, label: t('landscapes'), desc: t('landscapesDesc') },
    { key: 'preferArchitecture' as const, label: t('architecture'), desc: t('architectureDesc') },
    { key: 'preferFood' as const, label: t('food'), desc: t('foodDesc') },
    { key: 'preferSharpness' as const, label: t('sharpness'), desc: t('sharpnessDesc') },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-bold text-indigo-600">PicCurate</Link>
          <span className="text-sm text-zinc-500">{tc('stepOf', { current: 2, total: 4 })}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>
            <p className="mt-1 text-zinc-500">{t('subtitle')}</p>
          </div>
          <button
            onClick={reset}
            className="mt-1 px-3 py-1.5 rounded-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {t('reset')}
          </button>
        </div>

        {/* Criteria toggles + sliders */}
        <div className="mt-8 space-y-4">
          {criteriaItems.map(({ key, label, desc }) => {
            const criterion = criteria[key];
            if (typeof criterion !== 'object' || !('enabled' in criterion)) return null;

            return (
              <div
                key={key}
                className={`p-4 rounded-xl border transition-colors ${
                  criterion.enabled
                    ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30'
                    : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{label}</h3>
                    <p className="text-sm text-zinc-500 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => toggleCriterion(key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      criterion.enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                        criterion.enabled ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </div>
                {criterion.enabled && (
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-zinc-400 w-8">{t('low')}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={criterion.weight * 100}
                      onChange={(e) => setWeight(key, Number(e.target.value) / 100)}
                      className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
                    />
                    <span className="text-xs text-zinc-400 w-8">{t('high')}</span>
                    <span className="text-xs font-medium text-indigo-600 w-8">
                      {Math.round(criterion.weight * 100)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selection percentage slider */}
        <div className="mt-6 p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {t('selectionPercentage')}
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t('selectionPercentageDesc', { value: criteria.selectionPercentage })}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-zinc-400">5%</span>
            <input
              type="range"
              min="5"
              max="15"
              value={criteria.selectionPercentage}
              onChange={(e) => updateCriterion('selectionPercentage', Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <span className="text-xs text-zinc-400">15%</span>
            <span className="text-xs font-medium text-indigo-600 w-8">
              {criteria.selectionPercentage}%
            </span>
          </div>
        </div>

        {/* Dedup sensitivity slider */}
        <div className="mt-4 p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{t('dedup')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{t('dedupDesc')}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-zinc-400">{t('lenient')}</span>
            <input
              type="range"
              min="1"
              max="10"
              value={criteria.dedupSensitivity}
              onChange={(e) => updateCriterion('dedupSensitivity', Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <span className="text-xs text-zinc-400">{t('strict')}</span>
            <span className="text-xs font-medium text-indigo-600 w-8">
              {criteria.dedupSensitivity}
            </span>
          </div>
        </div>

        {/* Continue button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={async () => {
              // TODO(free-tier-blocker): this demo flow starts analysis directly,
              // bypassing job creation — so the "free 250 photos once per user"
              // rule is NOT enforced here. When accounts/auth land (Phase 3),
              // gate this on the free_tier_used check (see JobManager.createJob
              // and product-pipeline.md §4.2.1) before spending API budget.
              setAnalyzing(true);
              setProgress(t('progressPreparing'));
              try {
                // Only analyse photos that are neither saved (locked keepers) nor
                // already analysed. Changing criteria alone needs no re-analysis —
                // analysis is criteria-independent, so a re-run is then instant & free.
                const toAnalyze = photos.filter((p) => !p.saved && !p.analyzed);

                if (toAnalyze.length === 0) {
                  setProgress(t('progressRecomputing'));
                  rerunSelection(criteria);
                  router.push(`/${locale}/app/review`);
                  return;
                }

                // Split into batches, then analyse them with bounded concurrency
                // (parallel requests are ~3-5x faster than sequential). Results map
                // back to the analysed photos by id, so saved/skipped photos are untouched.
                const totalBatches = Math.ceil(toAnalyze.length / BATCH_SIZE);
                const CONCURRENCY = 5;
                const batchResults: any[][] = new Array(totalBatches);
                let done = 0;

                const runBatch = async (b: number) => {
                  const batch = toAnalyze.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
                  const formData = new FormData();
                  formData.append(
                    'metadata',
                    JSON.stringify(
                      batch.map((p) => ({ filename: p.filename, dateTaken: p.dateTaken, cameraModel: p.cameraModel }))
                    )
                  );
                  for (const photo of batch) {
                    if (photo.thumbnailBlob) {
                      formData.append('thumbnails', photo.thumbnailBlob, photo.filename);
                    } else {
                      const resp = await fetch(photo.thumbnailUrl);
                      formData.append('thumbnails', await resp.blob(), photo.filename);
                    }
                  }
                  const response = await fetch('/api/analyze-demo', { method: 'POST', body: formData });
                  if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Analysis failed');
                  }
                  const data = await response.json();
                  batchResults[b] = data.results;
                  setProgress(t('progressAnalysing', { done: ++done, total: totalBatches }));
                };

                // Concurrency pool
                let nextBatch = 0;
                const worker = async () => {
                  while (nextBatch < totalBatches) {
                    await runBatch(nextBatch++);
                  }
                };
                await Promise.all(
                  Array.from({ length: Math.min(CONCURRENCY, totalBatches) }, worker)
                );

                setProgress(t('progressSelecting'));
                applyAnalysisResults(batchResults.flat(), criteria, toAnalyze.map((p) => p.id));
                router.push(`/${locale}/app/review`);
              } catch (err) {
                console.error('Analysis failed:', err);
                setProgress('');
                alert(t('analysisFailed', { error: err instanceof Error ? err.message : 'Unknown error' }));
              } finally {
                setAnalyzing(false);
              }
            }}
            disabled={analyzing}
            className={`rounded-full px-8 py-3 text-sm font-semibold transition-colors ${
              analyzing
                ? 'bg-zinc-300 text-zinc-500 cursor-wait dark:bg-zinc-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {analyzing ? t('analyzing') : t('analyze')}
          </button>
        </div>
        {progress && (
          <p className="mt-3 text-sm text-indigo-600 text-right animate-pulse">{progress}</p>
        )}
      </main>
    </div>
  );
}
