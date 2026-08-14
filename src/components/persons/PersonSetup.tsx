'use client';

// Reference-person setup for the local person search.
//
// Lives BEFORE the upload (GATE 1, Entscheidung 8): the upload has to know
// whether to run the face pass, and § 3 rule 1 of
// docs/legal/personensuche-umsetzungsplan.md requires the user to activate the
// person search explicitly — activation therefore has to precede the processing,
// not follow it.
//
// Only the reference photo and the name live here. Slider weight and
// include/exclude stay on the configure page: those are pure selection logic and
// can be changed afterwards without touching a single pixel again.

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { MAX_PERSONS } from '@/types/criteria';
import { decodePhoto, isHEIC, convertReferenceHEIC } from '@/utils/image';
import { detectFaces } from '@/utils/faceDetection';
import { computeFaceEmbedding } from '@/utils/faceEmbedding';
import { LegalModal } from '@/components/legal/LegalModal';

interface Props {
  /** Once photos are queued the set is fixed — see the note in the component. */
  locked: boolean;
  /**
   * False once sales are live and the current tier is free — the person
   * search is a paid-tier feature after launch, but free for everyone during
   * the beta (see `salesAreLive()` in @/types/pricing and plan § 7b). The
   * header stays visible either way so the feature is discoverable; only the
   * setup form is replaced by an upsell.
   */
  available: boolean;
}

export function PersonSetup({ locked, available }: Props) {
  const t = useTranslations('criteria');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;

  const persons = usePhotoStore((s) => s.persons);
  const addPerson = usePhotoStore((s) => s.addPerson);
  const removePerson = usePhotoStore((s) => s.removePerson);

  // Open by default. It used to start collapsed on the theory that most runs
  // don't need it and the drop zone shouldn't drop below the fold — reasonable
  // on paper, but a live test (2026-08-14) showed the real failure mode: a
  // tester went straight for the big, obvious drop zone and never noticed the
  // collapsed "Personen" strip above it at all. Since the beta's whole point
  // right now is measuring how testers actually use this feature, a feature
  // nobody discovers can't be measured — visibility wins over the fold here.
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingEmbedding, setPendingEmbedding] = useState<number[] | null>(null);
  const [noFace, setNoFace] = useState(false);
  // The contractual usage restriction from docs/legal/personensuche-umsetzungsplan.md
  // § 4.3 / AGB § 7 — not an Art. 9 GDPR consent, so it lives only here on the
  // client and is never transmitted. One checkbox for the whole job, not one
  // per photo: AGB § 7 already says "eine einzige... Bestätigung" covers every
  // reference photo of an analysis job — the per-photo re-tick that used to be
  // here contradicted that text instead of implementing it (reported 2026-08-14).
  // Deliberately NOT reset by resetPending(); it only resets with the component
  // itself, i.e. a fresh upload session.
  const [usageConfirmed, setUsageConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingBlob(null);
    setPendingPreview(null);
    setPendingEmbedding(null);
    setNoFace(false);
    setName('');
  };

  async function handleFile(file: File) {
    setError(null);
    setNoFace(false);
    setBusy(true);
    try {
      // HEIC reference photos decode in the browser, never via /api/convert.
      // That is a hard rule (§ 2.4 / § 3 rule 3): the reference photo is the one
      // image that unambiguously identifies the person being searched for.
      const source: Blob = isHEIC(file) ? await convertReferenceHEIC(file) : file;

      // Keep the full-resolution bitmap: the face crop must come from the
      // original, not from the 512 px square preview, which is centre-cropped
      // and throws away exactly the resolution the match depends on (§ 9.5).
      const { thumbnail, bitmap } = await decodePhoto(source, { keepBitmap: true });
      let embedding: number[] | null = null;
      try {
        if (bitmap) {
          const faces = await detectFaces(bitmap);
          if (faces.length > 0) {
            const best = faces.reduce((a, b) => (a.score > b.score ? a : b));
            embedding = await computeFaceEmbedding(bitmap, best);
          }
        }
      } finally {
        bitmap?.close();
      }

      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
      setPendingBlob(thumbnail);
      setPendingPreview(URL.createObjectURL(thumbnail));
      setPendingEmbedding(embedding);
      // Telling the user now beats letting them wonder later why this person is
      // never found. Not fatal: the photo can still be added — the cloud path
      // may well cope with it — but it is the moment to offer a better one.
      setNoFace(embedding === null);
    } catch (err) {
      console.error('[PersonSetup] reference photo failed:', err);
      setError(t('personsProcessFailed'));
    } finally {
      setBusy(false);
    }
  }

  const canAdd = !locked && persons.length < MAX_PERSONS;

  return (
    <div className="rounded-xl border-2 border-purple-300 bg-purple-50/70 dark:border-purple-700/60 dark:bg-purple-950/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span>
          <span aria-hidden="true">🔍</span>{' '}
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{t('personsTitle')}</span>
          <span className="ml-2 text-xs text-zinc-500">{tc('optional')}</span>
          {persons.length > 0 && (
            <span className="ml-2 rounded-full bg-purple-600 px-2 py-0.5 text-xs font-semibold text-white">
              {persons.length}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-purple-700 dark:text-purple-300">
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-zinc-500">{t('personsDesc')}</p>
          {/* The cutover happened (2026-08-14): personRefs/personNames/
              personsConsent are gone from the analyse route, so this notice is
              now the accurate one. Verified, not assumed — the network trace in
              docs/legal/personensuche-spike-messbericht.md § 6 shows zero
              requests during matching, and the analyse request no longer carries
              a person field at all. */}
          <p className="mt-2 text-xs text-purple-700 dark:text-purple-300">{t('personsLocalNote')}</p>

          {available && !locked && (
            <label className="mt-3 flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={usageConfirmed}
                onChange={(e) => setUsageConfirmed(e.target.checked)}
                className="mt-0.5 flex-shrink-0"
              />
              <span>
                {t('personsConfirm')}{' '}
                <LegalModal
                  href={`/${locale}/persons-info`}
                  label={t('personsInfoLink')}
                  linkClassName="underline hover:text-purple-700 dark:hover:text-purple-300"
                />
              </span>
            </label>
          )}

          {persons.length > 0 && (
            <ul className="mt-3 space-y-2">
              {persons.map((person) => (
                <li key={person.id} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={person.thumbnailUrl}
                    alt={person.name}
                    className="w-12 h-12 rounded-lg object-cover border border-purple-300 dark:border-purple-700 flex-shrink-0"
                  />
                  <span className="flex-1 min-w-0 text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {person.name}
                    {person.embedding === null && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                        {t('personsNoFace')}
                      </span>
                    )}
                  </span>
                  {!locked && (
                    <button
                      onClick={() => removePerson(person.id)}
                      className="flex-shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors"
                    >
                      {t('customRemove')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!available ? (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
              {t('personsPaidOnly')}{' '}
              {/* An <a> or next/link would navigate away from /app/upload —
                  exactly the state-loss risk LegalModal exists to avoid (see
                  its own doc comment), so it's reused here even though this
                  target is a pricing page, not a legal text. */}
              <LegalModal
                href={`/${locale}/app/pricing`}
                label={t('personsPaidOnlyLink')}
                linkClassName="underline hover:text-purple-700 dark:hover:text-purple-300"
              />
            </p>
          ) : locked ? (
            <p className="mt-3 text-xs text-zinc-500">{t('personsLockedUpload')}</p>
          ) : canAdd ? (
            <div className="mt-3">
              {pendingPreview ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingPreview}
                      alt={t('personsPreview')}
                      className="w-12 h-12 rounded-lg object-cover border border-purple-300 dark:border-purple-700 flex-shrink-0"
                    />
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('personName')}
                      className="flex-1 min-w-0 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => {
                        if (!pendingBlob || !usageConfirmed) return;
                        if (!addPerson(name, pendingBlob, pendingEmbedding)) {
                          setError(t('personsAddFailed'));
                          return;
                        }
                        resetPending();
                        setError(null);
                      }}
                      disabled={!name.trim() || !pendingBlob || !usageConfirmed}
                      title={!usageConfirmed ? t('personsConfirmRequired') : undefined}
                      className="rounded-full bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('customAdd')}
                    </button>
                    <button
                      onClick={resetPending}
                      className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    >
                      {tc('cancel')}
                    </button>
                  </div>
                  {noFace && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t('personsNoFaceHint')}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="rounded-full border border-purple-300 dark:border-purple-700 px-4 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 disabled:opacity-50 disabled:cursor-wait transition-colors"
                >
                  {busy ? t('personsProcessing') : t('personsAdd')}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                // HEIC is accepted here — it decodes in the browser only
                // (convertReferenceHEIC), so iPhone users are not locked out.
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = ''; // allow re-picking the same file
                  await handleFile(file);
                }}
              />
            </div>
          ) : (
            <p className="mt-3 text-xs text-purple-700 dark:text-purple-300">
              {t('personsMaxReached', { max: MAX_PERSONS })}
            </p>
          )}

          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
