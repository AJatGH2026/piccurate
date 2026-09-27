'use client';

// Sample demo — "Mit Beispielfotos ansehen" (Umsetzungsplan Null-Aufwand-Demo,
// neu ausgerichtet 26./27.09.2026 als Pressematerial).
//
// Two steps, as in the real flow: first every photo of the example year
// ("vorher"), then — one click — the selection. The first preview jumped
// straight to a result, and the product owner could not tell what it was a
// result OF (feedback 2026-09-27).
//
// One self-contained page instead of a "sample mode" threaded through
// /app/configure → /app/review: the sliders live on the configure page next to
// the consent checkboxes, the contract logic and the re-analysis for custom
// terms, and every one of those would have needed a demo-mode exception. Here
// none of them exists. The page loads a frozen fixture, runs the app's REAL
// selection (runSelection / detectSeries) on it in local state, and never
// touches usePhotoStore, /api/jobs or /api/analyze-demo — so no contract, no
// job, no `analysis_started`, and nothing of the demo leaks into a real upload
// that follows. The controls deliberately copy the configure page's cards.

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

type MotifKey = 'preferFaces' | 'preferAnimals' | 'preferLandscapes' | 'preferArchitecture' | 'preferFood';

// A larger default than the app's 8 % (decision AJ 2026-09-27): with 101 photos,
// 8 % is eight pictures, and at 15 % only one of the real Japan photos made it
// in — the model scores the generated ones higher. 25 % shows both parts.
const SAMPLE_DEFAULTS: CriteriaConfig = { ...DEFAULT_CRITERIA, selectionPercentage: 25 };

const RANGE = 'flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-indigo-600';
const CARD = 'p-4 rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900';

export default function SampleDemoPage() {
  const t = useTranslations('sampleDemo');
  const tc = useTranslations('criteria');
  const params = useParams();
  const locale = params.locale as string;

  const [base, setBase] = useState<ProcessedPhoto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [stage, setStage] = useState<'before' | 'result'>('before');
  const [criteria, setCriteria] = useState<CriteriaConfig>(SAMPLE_DEFAULTS);
  // Manual keep/remove on top of the computed selection. Survives slider moves
  // (unlike the app, where a re-run starts over) so a visitor's own picks do
  // not vanish the moment they touch a slider.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [showRejected, setShowRejected] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const resultTracked = useRef(false);
  // Phone-like device → "best on a computer" hint under the CTA. Read through
  // useSyncExternalStore so the prerendered HTML (server: false) hydrates cleanly.
  const touchDevice = useSyncExternalStore(
    () => () => {},
    () => window.matchMedia?.('(pointer: coarse) and (hover: none)').matches ?? false,
    () => false
  );

  useEffect(() => {
    let cancelled = false;
    fetch(SAMPLE_FIXTURE_URL)
      .then((r) => (r.ok ? (r.json() as Promise<SampleFixture>) : Promise.reject(new Error(String(r.status)))))
      .then((fixture) => {
        if (cancelled) return;
        setBase(toProcessedPhotos(fixture));
        trackEv('sample_demo_intro_view', locale, { photo_count: fixture.photos.length });
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
  const clusters = useMemo(() => (base ? detectSeries(base, criteria) : []), [base, criteria]);
  const seriesSize = useMemo(() => {
    const m = new Map<string, number>();
    for (const cluster of clusters) for (const p of cluster) m.set(p.id, cluster.length);
    return m;
  }, [clusters]);
  const seriesCount = clusters.filter((c) => c.length > 1).length;
  const cameraCount = useMemo(
    () => new Set((base || []).map((p) => p.cameraModel).filter(Boolean)).size,
    [base]
  );

  const selectedCount = photos.filter((p) => p.selected).length;
  const rejectedCount = photos.length - selectedCount;

  const dayFmt = useMemo(
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
    () =>
      stage === 'before'
        ? groups.flatMap(([, g]) => g)
        : groups.flatMap(([, g]) => g.filter((p) => p.selected || showRejected)),
    [groups, showRejected, stage]
  );

  const select = () => {
    setStage('result');
    window.scrollTo({ top: 0 });
    if (!resultTracked.current) {
      resultTracked.current = true;
      trackEv('sample_demo_results_view', locale, { photo_count: photos.length, selected_count: selectedCount });
    }
  };
  const toggle = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (p) setOverrides((o) => ({ ...o, [id]: !p.selected }));
  };
  const setMotif = (key: MotifKey | 'preferSharpness', patch: Partial<{ enabled: boolean; weight: number }>) =>
    setCriteria((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  const reset = () => {
    setCriteria(SAMPLE_DEFAULTS);
    setOverrides({});
  };
  const openLightbox = (id: string) => setLightboxIndex(visible.findIndex((v) => v.id === id));

  const motifItems: { key: MotifKey; label: string; desc: string }[] = [
    { key: 'preferFaces', label: tc('faces'), desc: tc('facesDesc') },
    { key: 'preferAnimals', label: tc('animals'), desc: tc('animalsDesc') },
    { key: 'preferLandscapes', label: tc('landscapes'), desc: tc('landscapesDesc') },
    { key: 'preferArchitecture', label: tc('architecture'), desc: tc('architectureDesc') },
    { key: 'preferFood', label: tc('food'), desc: tc('foodDesc') },
  ];

  const header = (
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
  );

  const provenance = (
    <p className="mt-3 max-w-3xl rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
      {t('provenance')}
    </p>
  );

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

  // ---- Step 1: every photo of the year, unsorted ---------------------------
  if (stage === 'before' || !base) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {header}
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-16">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('introTitle')}</h1>
          <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">
            {t('introText', { total: base?.length ?? 101, cameras: cameraCount || 8 })}
          </p>
          {provenance}

          {loadError && <p className="mt-8 text-red-600">{t('loadError')}</p>}
          {!base && !loadError && <p className="mt-8 text-zinc-500">{t('loading')}</p>}

          {base && (
            <>
              {/* The one action of this step stays in reach while scrolling. */}
              <div className="sticky top-0 z-30 -mx-4 sm:mx-0 mt-5 px-4 sm:px-0 py-3 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur flex flex-wrap items-center gap-3">
                <button
                  onClick={select}
                  className="rounded-full bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
                >
                  {t('selectButton')}
                </button>
                <span className="text-sm text-zinc-500">{t('selectHint')}</span>
              </div>

              {groups.map(([date, group]) => (
                <div key={date} className="mt-4">
                  <h2 className="mb-2 text-sm font-medium text-zinc-500">
                    {date ? dayFmt.format(new Date(`${date}T00:00:00Z`)) : '—'}
                    <span className="ml-2 text-zinc-400">({group.length})</span>
                  </h2>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-1.5">
                    {group.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => openLightbox(photo.id)}
                        className="aspect-square overflow-hidden rounded-md ring-1 ring-black/5"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.thumbnailUrl} alt={photo.filename} loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-8 flex justify-center">
                <button
                  onClick={select}
                  className="rounded-full bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-colors"
                >
                  {t('selectButton')}
                </button>
              </div>
            </>
          )}
        </main>
        {lightboxIndex !== null && lightboxIndex >= 0 && (
          <Lightbox
            photos={visible}
            index={Math.min(lightboxIndex, visible.length - 1)}
            onIndexChange={setLightboxIndex}
            onToggle={() => {}}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </div>
    );
  }

  // ---- Step 2: the selection -------------------------------------------------
  const controls = (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t('controlsTitle')}</h2>
        <button onClick={reset} className="px-3 py-1 rounded-full text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
          {t('reset')}
        </button>
      </div>
      <p className="hidden lg:block text-xs text-zinc-400">{t('controlsHint')}</p>

      {/* Selection size — same card as /app/configure. */}
      <div className={CARD}>
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{tc('selectionPercentage')}</h3>
        <p className="hidden lg:block text-sm text-zinc-500 mt-0.5">{tc('selectionPercentageDesc')}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-zinc-400">1%</span>
          <input
            type="range" min="1" max="30"
            value={criteria.selectionPercentage}
            onChange={(e) => setCriteria((c) => ({ ...c, selectionPercentage: Number(e.target.value) }))}
            className={RANGE}
          />
          <span className="text-xs text-zinc-400">30%</span>
          <span className="text-xs font-medium text-indigo-600 w-8">{criteria.selectionPercentage}%</span>
        </div>
      </div>

      {/* On a phone only the size card shows up front; desktop shows all. */}
      <button onClick={() => setShowMore((s) => !s)} className="text-xs font-medium text-indigo-600 lg:hidden">
        {showMore ? t('lessSettings') : t('moreSettings')}
      </button>
      <div className={`space-y-3 ${showMore ? 'block' : 'hidden lg:block'}`}>
        <div className={CARD}>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{tc('dedup')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{tc('dedupDesc')}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-zinc-400">{tc('lenient')}</span>
            <input
              type="range" min="1" max="10"
              value={criteria.dedupSensitivity}
              onChange={(e) => setCriteria((c) => ({ ...c, dedupSensitivity: Number(e.target.value) }))}
              className={RANGE}
            />
            <span className="text-xs text-zinc-400">{tc('strict')}</span>
            <span className="text-xs font-medium text-indigo-600 w-5 text-right">{criteria.dedupSensitivity}</span>
          </div>
        </div>

        {/* Sharpness has no toggle in the app either — always applied. */}
        <div className={CARD}>
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{tc('sharpness')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{tc('sharpnessDesc')}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs text-zinc-400">{tc('low')}</span>
            <input
              type="range" min="1" max="10" step="1"
              value={Math.max(1, Math.round(criteria.preferSharpness.weight * 10))}
              onChange={(e) => setMotif('preferSharpness', { weight: Number(e.target.value) / 10 })}
              className={RANGE}
            />
            <span className="text-xs text-zinc-400">{tc('high')}</span>
            <span className="text-xs font-medium text-indigo-600 w-5 text-right">
              {Math.max(1, Math.round(criteria.preferSharpness.weight * 10))}
            </span>
          </div>
        </div>

        {motifItems.map(({ key, label, desc }) => {
          const c = criteria[key];
          return (
            <div
              key={key}
              className={`p-4 rounded-xl border transition-colors ${
                c.enabled
                  ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30'
                  : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{label}</h3>
                  <p className="text-sm text-zinc-500 mt-0.5">{desc}</p>
                </div>
                <button
                  onClick={() => setMotif(key, { enabled: !c.enabled })}
                  role="switch"
                  aria-checked={c.enabled}
                  aria-label={label}
                  className={`relative flex-none w-11 h-6 rounded-full transition-colors ${
                    c.enabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                      c.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
              {c.enabled && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-xs text-zinc-400">{tc('low')}</span>
                  <input
                    type="range" min="1" max="10" step="1"
                    value={Math.max(1, Math.round(c.weight * 10))}
                    onChange={(e) => setMotif(key, { weight: Number(e.target.value) / 10 })}
                    className={RANGE}
                    aria-label={label}
                  />
                  <span className="text-xs text-zinc-400">{tc('only')}</span>
                  <span className="text-xs font-medium text-indigo-600 w-10 text-right">
                    {c.weight >= 1 ? tc('only') : `${Math.round(c.weight * 10)}/10`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {header}
      {/* Bottom padding on a phone keeps the last photos clear of the fixed control bar. */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-6 pb-56 lg:py-8">
        <button onClick={() => setStage('before')} className="text-sm text-indigo-600 hover:text-indigo-700">
          ← {t('backToAll', { total: photos.length })}
        </button>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-400">{t('intro')}</p>
        {provenance}

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
          {/* Desktop: sticky sidebar that scrolls INSIDE itself when taller than
              the window — at 100 % zoom its end (and the CTA) was out of reach
              (feedback AJ 2026-09-27). Phone: a bar fixed to the bottom edge. */}
          <aside className="fixed inset-x-0 bottom-0 z-40 lg:static lg:z-auto lg:order-2 lg:w-80 flex-shrink-0">
            <div className="max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:pr-1 lg:shadow-none">
              {controls}
              <div className="mt-4 hidden lg:block">{cta}</div>
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
                    {date ? dayFmt.format(new Date(`${date}T00:00:00Z`)) : '—'}
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
                            // The app's reason tags and content tags are English-only
                            // and sit where the series badge goes — left out here;
                            // the lightbox still shows the tags.
                            reasonTag={null}
                            selected={photo.selected}
                            sceneType={photo.sceneType}
                            aestheticScore={photo.aestheticScore}
                            sharpnessScore={photo.sharpnessScore}
                            contentTags={[]}
                            latitude={null}
                            longitude={null}
                            onToggle={() => openLightbox(photo.id)}
                            onEnlarge={() => openLightbox(photo.id)}
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
