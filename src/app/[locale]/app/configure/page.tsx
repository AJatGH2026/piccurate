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
  const analyzedCustomTerms = usePhotoStore((s) => s.analyzedCustomTerms);
  const savedCount = photos.filter((p) => p.saved).length;
  // Custom terms are part of the job setup. Once at least one photo has been
  // analysed, the set of terms is frozen — changing them would trigger a full
  // (paid) re-analysis. For new terms the user must start a new job.
  const hasAnalyzed = photos.some((p) => p.analyzed);
  const { criteria, toggleCriterion, setWeight, updateCriterion, addCustom, removeCustom, setCustomWeight, reset } =
    useCriteria();
  const [customInput, setCustomInput] = useState('');

  const criteriaItems = [
    { key: 'preferFaces' as const, label: t('faces'), desc: t('facesDesc') },
    { key: 'preferAnimals' as const, label: t('animals'), desc: t('animalsDesc') },
    { key: 'preferLandscapes' as const, label: t('landscapes'), desc: t('landscapesDesc') },
    { key: 'preferArchitecture' as const, label: t('architecture'), desc: t('architectureDesc') },
    { key: 'preferFood' as const, label: t('food'), desc: t('foodDesc') },
    { key: 'preferSharpness' as const, label: t('sharpness'), desc: t('sharpnessDesc') },
  ];

  // Live summary of what the current sliders will do (motifs only; sharpness
  // is a quality modifier, not a motif filter).
  const motifItems = criteriaItems.filter((it) => it.key !== 'preferSharpness');
  const activeMotifs = motifItems.filter((it) => criteria[it.key].enabled);
  const customList = criteria.customCriteria || [];
  const activeLabels = [...activeMotifs.map((m) => m.label), ...customList.map((c) => c.term)];
  const maxedLabels = [
    ...activeMotifs.filter((it) => criteria[it.key].weight >= 1).map((m) => m.label),
    ...customList.filter((c) => c.weight >= 1).map((c) => c.term),
  ];
  const selectionMode =
    activeLabels.length === 0
      ? t('modeBalanced')
      : maxedLabels.length > 0
        ? t('modeOnly', { motifs: maxedLabels.join(', ') })
        : t('modeEmphasis', { motifs: activeLabels.join(', ') });

  // One toggle+slider card; reused for the motif criteria and for sharpness.
  const renderCriterion = ({ key, label, desc }: (typeof criteriaItems)[number]) => {
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
            <span className="text-xs text-zinc-400">{t('low')}</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={Math.max(1, Math.round(criterion.weight * 10))}
              onChange={(e) => setWeight(key, Number(e.target.value) / 10)}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <span className="text-xs text-zinc-400">{key === 'preferSharpness' ? t('high') : t('only')}</span>
            <span className="text-xs font-medium text-indigo-600 w-12 text-right">
              {key !== 'preferSharpness' && criterion.weight >= 1
                ? t('only')
                : `${Math.round(criterion.weight * 10)}/10`}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Defensive guard: if the photo store is empty (e.g. the user reloaded this
  // page, or navigated here directly), don't show the analyse UI — that would
  // silently push to a "no photos to review" screen. Send them back to upload.
  if (photos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-4">
        <p className="text-zinc-500">{t('noPhotosConfigure')}</p>
        <Link
          href={`/${locale}/app/upload`}
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {t('backToUpload')}
        </Link>
      </div>
    );
  }

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
            <p className="mt-1 text-xs text-zinc-400">{t('sliderLegend')}</p>
          </div>
          <button
            onClick={reset}
            className="mt-1 px-3 py-1.5 rounded-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            {t('reset')}
          </button>
        </div>

        {/* Maximum selection size */}
        <div className="mt-8 p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {t('selectionPercentage')}
          </h3>
          <p className="text-sm text-zinc-500 mt-0.5">
            {t('selectionPercentageDesc', { value: criteria.selectionPercentage })}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-zinc-400">1%</span>
            <input
              type="range"
              min="1"
              max="30"
              value={criteria.selectionPercentage}
              onChange={(e) => updateCriterion('selectionPercentage', Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <span className="text-xs text-zinc-400">30%</span>
            <span className="text-xs font-medium text-indigo-600 w-8">
              {criteria.selectionPercentage}%
            </span>
          </div>
        </div>

        {/* Sharpness — a frame parameter like size + duplicates, so no toggle
            (visually consistent with the other two rails). Always applied;
            the slider tunes how strongly sharp photos are preferred. */}
        <div className="mt-4 p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{t('sharpness')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{t('sharpnessDesc')}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-zinc-400">{t('low')}</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={Math.max(1, Math.round(criteria.preferSharpness.weight * 10))}
              onChange={(e) => setWeight('preferSharpness', Number(e.target.value) / 10)}
              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
            />
            <span className="text-xs text-zinc-400">{t('high')}</span>
            <span className="text-xs font-medium text-indigo-600 w-8 text-right">
              {Math.max(1, Math.round(criteria.preferSharpness.weight * 10))}
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

        {/* Motif criteria: people, animals, landscapes, architecture, food */}
        <div className="mt-4 space-y-4">
          {criteriaItems.filter((it) => it.key !== 'preferSharpness').map(renderCriterion)}
        </div>

        {/* Custom criteria (feature 5a) — visually set apart (amber) */}
        <div className="mt-4 p-4 rounded-xl border-2 border-amber-300 bg-amber-50/70 dark:border-amber-700/60 dark:bg-amber-950/20">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{t('customTitle')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{t('customDesc')}</p>

          {customList.length > 0 && (
            <div className="mt-3 space-y-4">
              {customList.map((c) => (
                <div key={c.term} className="space-y-2">
                  {/* Top row: term + remove (remove hidden once analysed) */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {c.term}
                    </span>
                    {!hasAnalyzed && (
                      <button
                        onClick={() => removeCustom(c.term)}
                        className="flex-shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
                        aria-label={t('customRemove')}
                      >
                        {t('customRemove')}
                      </button>
                    )}
                  </div>
                  {/* Bottom row: slider takes the full width */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">{t('low')}</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={Math.max(1, Math.round(c.weight * 10))}
                      onChange={(e) => setCustomWeight(c.term, Number(e.target.value) / 10)}
                      className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
                    />
                    <span className="text-xs text-zinc-400">{t('only')}</span>
                    <span className="text-xs font-medium text-indigo-600 w-12 text-right">
                      {c.weight >= 1 ? t('only') : `${Math.round(c.weight * 10)}/10`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add-form only before the first analysis. */}
          {!hasAnalyzed && customList.length < 7 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addCustom(customInput);
                setCustomInput('');
              }}
              className="mt-3 flex gap-2"
            >
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder={t('customPlaceholder')}
                className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                {t('customAdd')}
              </button>
            </form>
          )}

          {/* Status hint: either "set up first" or "locked after analysis". */}
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            {hasAnalyzed ? t('customLockedNote') : t('customSetupHint')}
          </p>
        </div>

        {/* Live selection-mode summary */}
        <div className="mt-6 p-3 rounded-xl bg-indigo-50 text-indigo-800 text-sm dark:bg-indigo-950/30 dark:text-indigo-200">
          {selectionMode}
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
                // Custom terms (feature 5a) are tagged DURING analysis, so if the
                // set of terms changed since the last run, already-analysed photos
                // must be re-analysed to pick them up. Otherwise analysis is
                // criteria-independent and a re-run is instant & free.
                const currentTerms = (criteria.customCriteria || [])
                  .map((c) => c.term.toLowerCase().trim())
                  .filter(Boolean)
                  .sort();
                const termsChanged =
                  JSON.stringify(currentTerms) !== JSON.stringify([...analyzedCustomTerms].sort());
                const customTerms = (criteria.customCriteria || []).map((c) => c.term);

                const toAnalyze = photos.filter((p) => !p.saved && (!p.analyzed || termsChanged));

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
                  if (customTerms.length) {
                    formData.append('customTerms', JSON.stringify(customTerms));
                  }
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
