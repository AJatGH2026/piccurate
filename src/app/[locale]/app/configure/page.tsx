'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useCriteria } from '@/hooks/useCriteria';
import { usePhotoStore, isNegativeCustom, stripNegativePrefix } from '@/hooks/usePhotoStore';
import { MAX_PERSONS } from '@/types/criteria';
import { coarseCoord } from '@/utils/geo';
import { trackEvent } from '@/lib/analytics';
import Link from 'next/link';
import { LegalModal } from '@/components/legal/LegalModal';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logBeta } from '@/lib/beta-client';
import { createClient } from '@/lib/supabase/client';
import { getTierForPhotoCount, MAX_TIER_PHOTOS } from '@/types/pricing';

const BATCH_SIZE = 20;

export default function ConfigurePage() {
  const t = useTranslations('criteria');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  // Both addresses are aliases of the same mailbox — show the one that matches
  // the site the user is currently on.
  const supportAddress = locale === 'de' ? 'support@auswahlbuddy.de' : 'support@shortlistbuddy.com';
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const photos = usePhotoStore((s) => s.photos);
  const applyAnalysisResults = usePhotoStore((s) => s.applyAnalysisResults);
  const rerunSelection = usePhotoStore((s) => s.rerunSelection);
  const analyzedCustomTerms = usePhotoStore((s) => s.analyzedCustomTerms);
  const persons = usePhotoStore((s) => s.persons);
  const analyzedPersons = usePhotoStore((s) => s.analyzedPersons);
  const removePerson = usePhotoStore((s) => s.removePerson);
  const renamePerson = usePhotoStore((s) => s.renamePerson);
  const setPersonWeight = usePhotoStore((s) => s.setPersonWeight);
  const setPersonMode = usePhotoStore((s) => s.setPersonMode);
  const personThreshold = usePhotoStore((s) => s.personThreshold);
  const setPersonThreshold = usePhotoStore((s) => s.setPersonThreshold);
  const savedCount = photos.filter((p) => p.saved).length;
  // Reference photos are picked on the upload step now, so the add-form state
  // (file input, pending blob/preview, processing flag) moved to
  // components/persons/PersonSetup.tsx along with it.
  const [personError] = useState<string | null>(null);
  // Custom terms are part of the job setup. Once at least one photo has been
  // analysed, the set of terms is frozen — changing them would trigger a full
  // (paid) re-analysis. For new terms the user must start a new job.
  const hasAnalyzed = photos.some((p) => p.analyzed);
  const { criteria, toggleCriterion, setWeight, updateCriterion, addCustom, removeCustom, setCustomWeight, reset } =
    useCriteria();
  const [customInput, setCustomInput] = useState('');
  // A3: age + terms, deliberately two separate declarations — they answer to
  // different rules. The age here is 16, the GDPR Art. 8 threshold for consent
  // in Germany. The 18 of limited contractual capacity only bites where money
  // changes hands, so it belongs at checkout, not in front of the analysis.
  // A2: reference-photo collective confirmation before persons are transmitted.
  const [ageAccepted, setAgeAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // No separate person confirmation any more — see the note further down where
  // the checkbox used to be. Analysis is gated on age + terms only.
  const canAnalyze = ageAccepted && termsAccepted;
  useEffect(() => { logBeta('configure'); }, []);
  // Age/terms acceptance is remembered (localStorage) — confirm once, not again
  // when changing criteria or re-running. (The reference-photo confirmation A2
  // stays per analysis, as the legal text requires it before each transfer.)
  useEffect(() => {
    try {
      // The old single checkbox bundled both statements ("18+ AND terms"), so a
      // stored yes covers both of the new ones — 18 implies 16. Migrated once,
      // then the old key is dropped.
      if (localStorage.getItem('piccurate-age-ok') === '1') {
        localStorage.setItem('sb-age-ok', '1');
        localStorage.setItem('sb-terms-ok', '1');
        localStorage.removeItem('piccurate-age-ok');
      }
      if (localStorage.getItem('sb-age-ok') === '1') setAgeAccepted(true);
      if (localStorage.getItem('sb-terms-ok') === '1') setTermsAccepted(true);
    } catch { /* ignore */ }
  }, []);

  /**
   * Make sure there is a session and a job, and return the job id.
   *
   * Anonymous sign-in gives every visitor a real auth user, so the job (and with
   * it the photo limit and the once-per-user free tier) always has an owner.
   * During the beta `BETA_OPEN_ACCESS` lets that owner stay anonymous; when it
   * is switched off, the server demands a permanent account here and the call
   * fails with a readable message rather than silently analysing for free.
   */
  const ensureJob = async (photoCount: number): Promise<string> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      // When registration is required, signing in anonymously would create an
      // account that can never analyse — and the privacy policy states that
      // anonymous accounts only remain from the earlier open beta. Ask the
      // server rather than guess; on a lookup failure fall through to the old
      // behaviour, since /api/jobs still refuses.
      const policy = await fetch('/api/access-policy', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (policy?.accountRequired === true) throw new Error(t('accountRequired'));
    }
    if (!user) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw new Error(error.message);
    }

    // Above the largest tier there is no plan to sell, so point the user at a
    // human instead of failing with a generic error. Splitting the run would be
    // the obvious advice, but at these volumes it is worth a conversation —
    // that is exactly the customer we want to hear from.
    const tier = getTierForPhotoCount(photoCount);
    if (tier === null) {
      throw new Error(
        t('tooManyForAnyTier', { max: MAX_TIER_PHOTOS.toLocaleString(locale), email: supportAddress })
      );
    }

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, photoCount, locale }),
    });
    const json = await res.json();
    // Refused for lack of daily budget: say how much is left, in the user's
    // language, instead of passing the server's English sentence through.
    if (res.status === 429 && typeof json?.remaining === 'number') {
      throw new Error(t('budgetExceeded', { remaining: json.remaining, requested: photoCount }));
    }
    // A 5xx is our fault, not something the user can act on — show a sentence in
    // their language rather than whatever the server happened to say.
    if (res.status >= 500) throw new Error(t('jobCreateFailed'));
    if (!res.ok || !json?.data?.jobId) {
      throw new Error(json?.error || t('jobCreateFailed'));
    }
    return json.data.jobId as string;
  };

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
  const activeLabels = [
    ...activeMotifs.map((m) => m.label),
    ...customList.map((c) => c.term),
    ...persons.map((p) => (p.mode === 'exclude' ? `🚫 ${p.name}` : p.name)),
  ];
  const maxedLabels = [
    ...activeMotifs.filter((it) => criteria[it.key].weight >= 1).map((m) => m.label),
    ...customList.filter((c) => c.weight >= 1).map((c) => c.term),
    // Include-mode persons at max slider AND exclude-mode persons are both
    // hard filters and show up in the "only" line.
    ...persons
      .filter((p) => p.mode === 'exclude' || p.weight >= 1)
      .map((p) => (p.mode === 'exclude' ? `🚫 ${p.name}` : p.name)),
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
          <Link href="/" className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
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
            {t('selectionPercentageDesc')}
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
              {customList.map((c) => {
                const negative = isNegativeCustom(c.term);
                return (
                  <div key={c.term} className="space-y-2">
                    {/* Top row: term + remove (remove hidden once analysed) */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {negative && <span className="mr-1" aria-hidden="true">🚫</span>}
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
                    {/* Bottom row: for negative terms show a filter note
                        (slider has no effect); for positive terms the usual slider. */}
                    {negative ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t('customFilterActive')}
                      </p>
                    ) : (
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
                    )}
                  </div>
                );
              })}
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

        {/* Persons (feature 5b) — reference-photo-based face matching. Set
            apart with a purple accent so it's visually distinct from both the
            motif criteria (indigo) and the custom terms (amber).

            Only rendered once at least one person exists: reference photos are
            picked on the upload step, before any photo is processed (GATE 1,
            Entscheidung 8) — there is nothing this box can do with zero
            persons, since adding one here could not work (those photos were
            already processed without a face pass) and the box has no other
            content in that case. Showing an empty shell that explains a step
            already missed is confusing, not helpful — reported 2026-08-14. */}
        {persons.length > 0 && (
        <div className="mt-4 p-4 rounded-xl border-2 border-purple-300 bg-purple-50/70 dark:border-purple-700/60 dark:bg-purple-950/20">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{t('personsTitle')}</h3>
          <p className="text-sm text-zinc-500 mt-0.5">{t('personsDesc')}</p>
          {/* Local notice, not the old transmission consent — since the cutover
              nothing about a person leaves the device. */}
          <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">
            {t('personsLocalNote')}
          </p>

          {persons.length > 0 && (
            <div className="mt-3 space-y-4">
              {persons.map((person) => {
                const isExclude = person.mode === 'exclude';
                return (
                  <div key={person.id} className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={person.thumbnailUrl}
                      alt={person.name}
                      className="w-16 h-16 rounded-lg object-cover border border-purple-300 dark:border-purple-700 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 min-w-0 flex-1">
                          {isExclude && <span aria-hidden="true">🚫</span>}
                          {hasAnalyzed ? (
                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {person.name}
                            </span>
                          ) : (
                            <input
                              value={person.name}
                              onChange={(e) => renamePerson(person.id, e.target.value)}
                              className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1 text-sm"
                              aria-label={t('personName')}
                            />
                          )}
                        </span>
                        {!hasAnalyzed && (
                          <button
                            onClick={() => removePerson(person.id)}
                            className="flex-shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
                            aria-label={t('customRemove')}
                          >
                            {t('customRemove')}
                          </button>
                        )}
                      </div>
                      {/* Mode toggle: include ↔ exclude. Segmented button — the
                          active side gets the purple fill; the inactive side is
                          a light outline so it stays clickable but subdued. */}
                      <div className="inline-flex rounded-full border border-purple-300 dark:border-purple-700 overflow-hidden text-xs">
                        <button
                          onClick={() => setPersonMode(person.id, 'include')}
                          className={`px-3 py-1 transition-colors ${
                            !isExclude
                              ? 'bg-purple-600 text-white'
                              : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                          }`}
                        >
                          {t('personModeInclude')}
                        </button>
                        <button
                          onClick={() => setPersonMode(person.id, 'exclude')}
                          className={`px-3 py-1 transition-colors ${
                            isExclude
                              ? 'bg-purple-600 text-white'
                              : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                          }`}
                        >
                          {t('personModeExclude')}
                        </button>
                      </div>
                      {/* Slider (include) OR filter-note (exclude) — same
                          split we use for positive/negative custom terms. */}
                      {isExclude ? (
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          {t('personFilterActive', { name: person.name })}
                        </p>
                      ) : (
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-400">{t('low')}</span>
                            <input
                              type="range"
                              min="1"
                              max="10"
                              step="1"
                              value={Math.max(1, Math.round(person.weight * 10))}
                              onChange={(e) => setPersonWeight(person.id, Number(e.target.value) / 10)}
                              className="flex-1 h-1.5 rounded-full appearance-none bg-zinc-200 dark:bg-zinc-700 accent-purple-600"
                            />
                            <span className="text-xs text-zinc-400">{t('only')}</span>
                            <span className="text-xs font-medium text-purple-600 w-12 text-right">
                              {person.weight >= 1 ? t('only') : `${Math.round(person.weight * 10)}/10`}
                            </span>
                          </div>
                          {/* This slider and the shared threshold slider below answer
                              different questions (reported 2026-08-14: without this
                              line they read as two copies of the same control) — this
                              one is selection priority given a match, the threshold is
                              whether a face counts as a match at all. */}
                          <p className="mt-1 text-xs text-zinc-400">
                            {t('personWeightHint', { name: person.name })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* No add-form here: reference persons are chosen on the upload step,
              before any photo is processed (GATE 1, Entscheidung 8). Adding one
              here could not work — those photos were already processed without a
              face pass, so a new person would simply never match anything.
              What DOES stay on this page is weight and include/exclude: pure
              selection logic, re-tunable at any time without touching a pixel. */}

          {/* Threshold slider. § 1(5) of the plan: no cosine value on screen —
              the number means nothing to a user — but the side effect IS named
              in both directions, because face matching that quietly guesses
              wrong is exactly what people should be able to see coming.
              Re-derives matches instantly from the stored embeddings; no photo
              is touched again, so this is cheap to drag around. */}
          {persons.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {t('personThresholdTitle')}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="text-xs text-zinc-500 w-16 text-right">
                  {t('personThresholdStrict')}
                </span>
                {/* The slider is INVERTED against the threshold: dragging right
                    must feel like "more results", which means a LOWER similarity
                    cut-off. Both directions use the same mapping
                    (slider = 100 − threshold·100) so the handle sits where the
                    current threshold actually is. */}
                <input
                  type="range"
                  min={30}
                  max={70}
                  step={2}
                  value={100 - Math.round(personThreshold * 100)}
                  onChange={(e) => setPersonThreshold((100 - Number(e.target.value)) / 100)}
                  className="flex-1 accent-purple-600"
                  aria-label={t('personThresholdTitle')}
                />
                <span className="text-xs text-zinc-500 w-16">{t('personThresholdLoose')}</span>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t('personThresholdHint')}</p>
            </div>
          )}

          {personError && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{personError}</p>
          )}

          {/* The A2 biometric-consent checkbox that used to live here was removed
              on 2026-08-14 together with the transmission it consented to — its
              text described sending reference photos to an LLM provider, which
              is no longer true. Its replacement, a contractual (not Art. 9)
              usage confirmation, was reinstated where the reference photo is
              actually picked — the checkbox in components/persons/PersonSetup.tsx
              on the upload page — not here, since this page can no longer add a
              reference photo at all. */}

          <p className="mt-3 text-xs text-purple-700 dark:text-purple-300">
            {hasAnalyzed
              ? t('personsLockedNote')
              : persons.length >= MAX_PERSONS
                ? t('personsMaxReached', { max: MAX_PERSONS })
                : t('personsSetupHint', { max: MAX_PERSONS })}
          </p>
        </div>
        )}

        {/* Live selection-mode summary */}
        <div className="mt-6 p-3 rounded-xl bg-indigo-50 text-indigo-800 text-sm dark:bg-indigo-950/30 dark:text-indigo-200">
          {selectionMode}
        </div>

        {/* A4 (AI Act): transparency notice directly before starting analysis. */}
        <div className="mt-4 p-3 rounded-xl bg-zinc-100 text-zinc-600 text-xs dark:bg-zinc-800 dark:text-zinc-300">
          {t('aiNotice')}
        </div>

        {/* The § 312f confirmation goes out the moment the analysis starts. Say
            so before the click, not least because the sending domain is new
            enough that providers still file it as spam — a confirmation nobody
            knows to look for is one nobody finds. */}
        <p className="mt-2 flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span aria-hidden="true">✉️</span>
          <span>{t('contractMailNotice')}</span>
        </p>

        {/* A3: two separate declarations, neither preselected. Kept apart so a
            later change to one threshold does not silently restate the other. */}
        <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={ageAccepted}
            onChange={(e) => {
              setAgeAccepted(e.target.checked);
              try { localStorage.setItem('sb-age-ok', e.target.checked ? '1' : '0'); } catch { /* ignore */ }
            }}
            className="mt-0.5 accent-indigo-600"
          />
          <span>{t('ageConfirm18')}</span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => {
              setTermsAccepted(e.target.checked);
              try { localStorage.setItem('sb-terms-ok', e.target.checked ? '1' : '0'); } catch { /* ignore */ }
            }}
            className="mt-0.5 accent-indigo-600"
          />
          <span>
            {t('termsConfirm')}{' '}
            <LegalModal href={`/${locale}/terms`} label={t('termsShort')} linkClassName="underline hover:text-indigo-600" />
          </span>
        </label>

        {/* Continue button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={async () => {
              // A3: record the terms confirmation (date-keyed) before processing.
              logBeta('terms_accepted');
              // `persons_confirmed` was removed on 2026-08-14. It told the server
              // "a person search is happening in this session" — harmless-looking
              // as a counter, but § 5.4 lists exactly that as a NO-GO: the server
              // must not be able to know a person search took place, because
              // correlated with the analysis request of the same session it is a
              // signal about biometric processing. Do not add a person counter
              // back, in any form.
              setAnalyzing(true);
              setProgress(t('progressPreparing'));
              try {
                // Custom terms (feature 5a) are tagged DURING analysis, so if the
                // set of terms changed since the last run, already-analysed photos
                // must be re-analysed to pick them up. Otherwise analysis is
                // criteria-independent and a re-run is instant & free.
                // The AI is always asked "is X visible?", never the negation
                // — a "no snow" term is sent to Gemini as just "snow", and
                // the client interprets absence-of-tag as "keep" and
                // presence-of-tag as "exclude". So we strip prefixes here
                // both for the diff check and for what actually goes to the
                // model.
                const currentTerms = (criteria.customCriteria || [])
                  .map((c) => stripNegativePrefix(c.term).toLowerCase().trim())
                  .filter(Boolean)
                  .sort();
                const termsChanged =
                  JSON.stringify(currentTerms) !== JSON.stringify([...analyzedCustomTerms].sort());
                const customTerms = (criteria.customCriteria || [])
                  .map((c) => stripNegativePrefix(c.term))
                  .filter(Boolean);

                // Persons (feature 5b): same diff mechanic — a change in the
                // set of reference persons forces re-analysis. Names are
                // Changing a reference person no longer triggers a re-analysis.
                // It used to have to: the names and photos went into the Gemini
                // prompt, so a different set meant different results. Matching is
                // local now and re-derives instantly from stored embeddings —
                // re-running the (paid) analysis for it would charge the user for
                // nothing.
                const toAnalyze = photos.filter(
                  (p) => !p.saved && (!p.analyzed || termsChanged)
                );

                if (toAnalyze.length === 0) {
                  setProgress(t('progressRecomputing'));
                  rerunSelection(criteria);
                  router.push(`/${locale}/app/review`);
                  return;
                }

                // One job per analysis run — the server enforces the tier's photo
                // limit and the once-per-user free tier against it. Created here,
                // as late as possible: the anonymous auth user is only minted when
                // someone actually analyses, so crawlers never create accounts
                // (they would count towards Supabase's monthly active users).
                const jobId = await ensureJob(toAnalyze.length);

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
                  formData.append('jobId', jobId);
                  // Consent attestation — this fetch only runs when the UI's
                  // age/terms gate (canAnalyze) is satisfied, so assert it to
                  // the server (which enforces it independently).
                  formData.append('consent', '1');
                  // Drives the language of the AI-derived place names.
                  formData.append('locale', locale);
                  formData.append(
                    'metadata',
                    JSON.stringify(
                      batch.map((p) => ({
                        filename: p.filename,
                        dateTaken: p.dateTaken,
                        cameraModel: p.cameraModel,
                        // Coarsened to ~1.1 km — enough to name the town, not
                        // enough to point at a home. See utils/geo.ts.
                        lat: coarseCoord(p.latitude),
                        lon: coarseCoord(p.longitude),
                      }))
                    )
                  );
                  if (customTerms.length) {
                    formData.append('customTerms', JSON.stringify(customTerms));
                  }
                  // NO reference photos, names or biometric consent are sent any
                  // more. Person matching happens in the browser (since
                  // 2026-08-14): the reference photo, the face crops, the
                  // embeddings and the match results never leave the device.
                  // Adding a person field back here would silently undo that —
                  // see docs/legal/personensuche-umsetzungsplan.md § 3 rule 3.
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

                // Concurrency pool. A failing batch must NOT discard the ones that
                // already succeeded: a daily cap hit at batch 36 of 38 used to
                // throw away ~700 analysed photos the user had just paid and
                // waited for. The first error stops the pool, everything already
                // analysed is kept, and the rest is reported as unfinished.
                let nextBatch = 0;
                let failure: string | null = null;
                const worker = async () => {
                  while (nextBatch < totalBatches && !failure) {
                    const b = nextBatch++;
                    try {
                      await runBatch(b);
                    } catch (e) {
                      // First error wins; the other workers see `failure` and
                      // stop instead of hammering an endpoint that just refused.
                      failure ??= e instanceof Error ? e.message : String(e);
                    }
                  }
                };
                await Promise.all(
                  Array.from({ length: Math.min(CONCURRENCY, totalBatches) }, worker)
                );

                setProgress(t('progressSelecting'));
                // Only the batches that actually returned count as analysed, and
                // their photo ids must line up with them — otherwise photos would
                // be marked "analysed" that the model never saw, and a re-run
                // would skip them forever.
                const flatResults: any[] = [];
                const analysedIds: string[] = [];
                for (let b = 0; b < totalBatches; b++) {
                  const res = batchResults[b];
                  if (!res) continue;
                  flatResults.push(...res);
                  analysedIds.push(
                    ...toAnalyze.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE).map((p) => p.id)
                  );
                }

                // Nothing survived — then it really is a plain failure.
                if (flatResults.length === 0) {
                  throw new Error(failure ?? 'Analysis failed');
                }

                // No label→name mapping any more: the model is not asked about
                // people at all, and the store ignores any `persons` it returns.
                applyAnalysisResults(flatResults, criteria, analysedIds);
                trackEvent('analysis_complete', {
                  photos: analysedIds.length,
                  requested: toAnalyze.length,
                  partial: failure ? 1 : 0,
                });
                logBeta('analysis');
                // Say what happened before showing the result, so nobody wonders
                // why some photos are missing from the review.
                if (failure) {
                  alert(t('analysisPartial', {
                    done: analysedIds.length,
                    total: toAnalyze.length,
                    error: failure,
                  }));
                }
                router.push(`/${locale}/app/review`);
              } catch (err) {
                console.error('Analysis failed:', err);
                setProgress('');
                alert(t('analysisFailed', { error: err instanceof Error ? err.message : 'Unknown error' }));
              } finally {
                setAnalyzing(false);
              }
            }}
            disabled={analyzing || !canAnalyze}
            title={!canAnalyze ? t('confirmRequired') : undefined}
            className={`rounded-full px-8 py-3 text-sm font-semibold transition-colors ${
              analyzing || !canAnalyze
                ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed dark:bg-zinc-700'
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
