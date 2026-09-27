'use client';

// Sample demo — "Mit Beispielfotos ansehen" (Umsetzungsplan Null-Aufwand-Demo,
// neu ausgerichtet 26./27.09.2026 als Pressematerial).
//
// One self-contained page instead of a "sample mode" threaded through
// /app/configure → /app/review: the sliders live on the configure page next to
// the consent checkboxes, the contract logic and the re-analysis for custom
// terms, and every one of those would have needed a demo-mode exception. Here
// none of them exists. The page loads a frozen fixture, runs the app's REAL
// selection (runSelection / detectSeries) on it in local state, and never
// touches usePhotoStore, /api/jobs or /api/analyze-demo — so no contract, no
// job, no `analysis_started`, and nothing of the demo leaks into a real upload
// that follows.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { runSelection, detectSeries, type ProcessedPhoto } from '@/hooks/usePhotoStore';
import { DEFAULT_CRITERIA, type CriteriaConfig } from '@/types/criteria';
import { ReviewPhotoCard } from '@/components/review/ReviewPhotoCard';
import { Lightbox } from '@/components/review/Lightbox';
import { trackEv } from '@/lib/events-client';
import { SAMPLE_FIXTURE_URL, toProcessedPhotos, type SampleFixture } from '@/lib/sample-demo';

type MotifKey = 'preferFaces' | 'preferAnimals' | 'preferLandscapes' | 'preferArchitecture' | 'preferFood' | 'preferSharpness';

// A larger default than the app's 8 % (decision AJ 2026-09-27): with 101 photos,
// 8 % is eight pictures, and at 15 % only one of the real Japan photos made it
// in — the model scores the generated ones higher. 25 % shows both parts.
const SAMPLE_DEFAULTS: CriteriaConfig = { ...DEFAULT_CRITERIA, selectionPercentage: 25 };

export default function SampleDemoPage() {
  const t = useTranslations('sampleDemo');
  const tc = useTranslations('criteria');
  const params = useParams();
  const locale = params.locale as string;

  const [base, setBase] = useState<ProcessedPhoto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [criteria, setCriteria] = useState<CriteriaConfig>(SAMPLE_DEFAULTS);
  // Manual keep/remove on top of the computed selection. Survives slider moves
  // (unlike the app, where a re-run starts over) so a visitor's own picks do
  // not vanish the moment they touch a slider.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [showRejected, setShowRejected] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Phone-like device → "best on a computer" hint under the CTA. Read through
  // useSyncExternalStore so the prerendered HTML (server: false) hydrates cleanly.
  const touchDevice = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia?.('(pointer: coarse) and (hover: none)').matches ?? false,
    () => false
  );
  const [showMore, setShowMore] = useState(false);
  const viewTracked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(SAMPLE_FIXTURE_URL)
      .then((r) => (r.ok ? (r.json() as Promise<SampleFixture>) : Promise.reject(new Error(String(r.status)))))
      .then((fixture) => {
        if (cancelled) return;
        setBase(toProcessedPhotos(fixture));
        if (!viewTracked.current) {
          viewTracked.current = true;
          trackEv('sample_demo_results_view', locale, { photo_count: fixture.photos.length });
        }
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [locale]);


  const computed = useMemo(
    () => (base ? runSelection(base, criteria, [], false) : []),
    [base, criteria]
  );
  const photos = useMemo(
    () =>
      computed.map((p) =>
        p.id in overrides && overrides[p.id] !== p.selected ? { ...p, selected: overrides[p.id] } : p
      ),
    [computed, overrides]
  );
  // Series as the selection sees them — same function, same thresholds.
  const seriesSize = useMemo(() => {
    const m = new Map<string, number>();
    if (!base) return m;
    for (const cluster of detectSeries(base, criteria)) for (const p of cluster) m.set(p.id, cluster.length);
    return m;
  }, [base, criteria]);
  const seriesCount = useMemo(() => {
    if (!base) return 0;
    return detectSeries(base, criteria).filter((c) => c.length > 1).length;
  }, [base, criteria]);
  const cameraCount = useMemo(
    () => new Set((base || []).map((p) => p.cameraModel).filter(Boolean)).size,
    [base]
  );

  const selectedCount = photos.filter((p) => p.selected).length;
  const rejectedCount = photos.length - selectedCount;

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [locale]
  );
  const groups = useMemo(() => {
    const m = new Map<string, ProcessedPhoto[]>();
    for (const p of photos) {
      const d = p.dateTaken ? p.dateTaken.split('T')[0] : '';
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(p);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [photos]);
  // What the lightbox pages through: exactly what is on screen, in order.
  const visible = useMemo(
    () => groups.flatMap(([, g]) => g.filter((p) => p.selected || showRejected)),
    [groups, showRejected]
  );

  const toggle = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) setOverrides((o) => ({ ...o, [id]: !p.selected }));
  };
  const setMotif = (key: MotifKey, patch: Partial<{ enabled: boolean; weight: number }>) =>
    setCriteria((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  const reset = () => {
    setCriteria(SAMPLE_DEFAULTS);
    setOverrides({});
  };

  const motifItems: { key: MotifKey; label: string }[] = [
    { key: 'preferFaces', label: tc('faces') },
    { key: 'preferAnimals', label: tc('animals') },
    { key: 'preferLandscapes', label: tc('landscapes') },
    { key: 'preferArchitecture', label: tc('architecture') },
    { key: 'preferFood', label: tc('food') },
    { key: 'preferSharpness', label: tc('sharpness') },
  ];

  const cta = (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 p-5">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('ctaTitle')}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('ctaBody')}</p>
      <Link
        href={`/${locale}/demo`}
        onClick={() => trackEv('sample_demo_to_upload', locale, { selected_count: selectedCount })}
        className="mt-4 block w-full rounded-full bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
      >
        {t('ctaButton')}
      </Link>
      {touchDevice && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t('ctaMobileHint')}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
              {t('badge')}
            </span>
          </div>
          <Link href={`/${locale}`} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            {t('back')}
          </Link>
        </div>
      </header>

      {/* Bottom padding on a phone keeps the last photos clear of the fixed control bar. */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-48 lg:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">
          {t('intro', { total: base?.length ?? 101, cameras: cameraCount || 6 })}
        </p>
        <p className="mt-3 max-w-3xl rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
          {t('provenance')}
        </p>

        {loadError && <p className="mt-8 text-red-600">{t('loadError')}</p>}
        {!base && !loadError && <p className="mt-8 text-zinc-500">{t('loading')}</p>}

        {base && (
          <>
            {/* The effect in one line: many photos in, series collapsed, few out. */}
            <div className="mt-5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <span className="rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-zinc-700 dark:text-zinc-300">
                {t('statTotal', { count: photos.length })}
              </span>
              <span aria-hidden="true" className="text-zinc-400">→</span>
              <span className="rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-1 text-zinc-700 dark:text-zinc-300">
                {t('statSeries', { count: seriesCount })}
              </span>
              <span aria-hidden="true" className="text-zinc-400">→</span>
              <span className="rounded-full bg-indigo-600 px-3 py-1 font-semibold text-white">
                {t('statSelected', { count: selectedCount })}
              </span>
            </div>

            <div className="mt-6 flex flex-col lg:flex-row gap-8">
              {/* Controls: sticky sidebar on desktop; on a phone a bar fixed to
                  the bottom edge, so photos and slider are on screen together
                  (stacked above the grid, the first photo started below the fold). */}
              <aside className="fixed inset-x-0 bottom-0 z-40 lg:static lg:z-auto lg:order-2 lg:w-80 flex-shrink-0">
                <div className="lg:sticky lg:top-4 space-y-4">
                  <div className="max-h-[70vh] overflow-y-auto lg:max-h-none lg:overflow-visible rounded-t-2xl lg:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 lg:p-5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:shadow-none">
                    <div className="flex items-baseline justify-between">
                      <h2 className="text-sm lg:text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('controlsTitle')}</h2>
                      <button onClick={reset} className="text-xs text-indigo-600 hover:text-indigo-700">{t('reset')}</button>
                    </div>
                    <p className="mt-1 hidden lg:block text-xs text-zinc-500">{t('controlsHint')}</p>

                    <label className="mt-2 lg:mt-4 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {t('size')}
                      <span className="float-right font-normal text-indigo-600">
                        {t('sizeValue', { percent: criteria.selectionPercentage })}
                      </span>
                    </label>
                    <input
                      type="range" min={1} max={30} step={1}
                      value={criteria.selectionPercentage}
                      onChange={(e) => setCriteria((c) => ({ ...c, selectionPercentage: Number(e.target.value) }))}
                      className="mt-2 w-full h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
                    />

                    {/* On a phone only the size slider shows up front — with all
                        of it open, the first photo started at ~1050 px, below the
                        fold. Desktop always shows everything. */}
                    <button
                      onClick={() => setShowMore((s) => !s)}
                      className="mt-2 text-xs font-medium text-indigo-600 lg:hidden"
                    >
                      {showMore ? t('lessSettings') : t('moreSettings')}
                    </button>
                    <div className={showMore ? 'block' : 'hidden lg:block'}>
                    <label className="mt-5 block text-sm font-medium text-zinc-800 dark:text-zinc-200">{t('dedup')}</label>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-zinc-400">{t('dedupLenient')}</span>
                      <input
                        type="range" min={1} max={10} step={1}
                        value={criteria.dedupSensitivity}
                        onChange={(e) => setCriteria((c) => ({ ...c, dedupSensitivity: Number(e.target.value) }))}
                        className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
                      />
                      <span className="text-xs text-zinc-400">{t('dedupStrict')}</span>
                    </div>

                    <p className="mt-5 text-sm font-medium text-zinc-800 dark:text-zinc-200">{t('motifs')}</p>
                    <div className="mt-2 space-y-3">
                      {motifItems.map(({ key, label }) => {
                        const c = criteria[key];
                        return (
                          <div key={key}>
                            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                              <input
                                type="checkbox"
                                checked={c.enabled}
                                onChange={(e) => setMotif(key, { enabled: e.target.checked })}
                                className="accent-indigo-600"
                              />
                              {label}
                              {c.enabled && key !== 'preferSharpness' && c.weight >= 1 && (
                                <span className="ml-auto text-xs font-medium text-indigo-600">{tc('only')}</span>
                              )}
                            </label>
                            {c.enabled && (
                              <input
                                type="range" min={1} max={10} step={1}
                                value={Math.max(1, Math.round(c.weight * 10))}
                                onChange={(e) => setMotif(key, { weight: Number(e.target.value) / 10 })}
                                className="mt-1 w-full h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600"
                                aria-label={label}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  </div>
                  <div className="hidden lg:block">{cta}</div>
                </div>
              </aside>

              <section className="flex-1 lg:order-1 min-w-0">
                <p className="text-xs text-zinc-500">{t('enlargeHint')}</p>
                {groups.map(([date, group]) => {
                  const shown = group.filter((p) => p.selected || showRejected);
                  if (shown.length === 0) return null;
                  return (
                    <div key={date} className="mt-5">
                      <h2 className="mb-2 text-sm font-medium text-zinc-500">
                        {date ? dateFmt.format(new Date(`${date}T00:00:00Z`)) : '—'}
                        <span className="ml-2 text-indigo-600">
                          ({group.filter((p) => p.selected).length}/{group.length})
                        </span>
                      </h2>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {shown.map((photo) => {
                          const size = seriesSize.get(photo.id) || 1;
                          return (
                            <div key={photo.id} className="relative">
                              <ReviewPhotoCard
                                thumbnailUrl={photo.thumbnailUrl}
                                filename={photo.filename}
                                // The app's reason tags are English-only strings
                                // and sit where the series badge goes — left out here.
                                reasonTag={null}
                                selected={photo.selected}
                                sceneType={photo.sceneType}
                                aestheticScore={photo.aestheticScore}
                                sharpnessScore={photo.sharpnessScore}
                                // Same reason: the tag strip would cover the badge.
                                // The lightbox still shows the tags.
                                contentTags={[]}
                                latitude={null}
                                longitude={null}
                                onToggle={() => setLightboxIndex(visible.findIndex((v) => v.id === photo.id))}
                                onEnlarge={() => setLightboxIndex(visible.findIndex((v) => v.id === photo.id))}
                              />
                              {photo.selected && size > 1 && (
                                <span
                                  title={t('seriesBadgeTitle', { count: size })}
                                  className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white"
                                >
                                  {t('seriesBadge', { count: size })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => setShowRejected((s) => !s)}
                  className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {showRejected ? t('hideRejected') : t('showRejected', { count: rejectedCount })}
                </button>

                <div className="mt-8 lg:hidden">{cta}</div>
              </section>
            </div>
          </>
        )}
      </main>

      {lightboxIndex !== null && lightboxIndex >= 0 && (
        <Lightbox
          photos={visible}
          index={Math.min(lightboxIndex, visible.length - 1)}
          onIndexChange={setLightboxIndex}
          onToggle={toggle}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
