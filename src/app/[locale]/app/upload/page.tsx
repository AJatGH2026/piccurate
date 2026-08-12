'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useUpload } from '@/hooks/useUpload';
import { DropZone } from '@/components/upload/DropZone';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { PhotoGrid } from '@/components/upload/PhotoGrid';
import { DropboxImport } from '@/components/upload/DropboxImport';
import { dropboxConfigured } from '@/lib/cloud/dropbox';
import { useEffect, useState } from 'react';
import type { Tier } from '@/types/job';
import { PRICING_PLANS } from '@/types/pricing';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { createClient } from '@/lib/supabase/client';
import { logBeta } from '@/lib/beta-client';

const DEFAULT_TIER: Tier = 'free';

export default function UploadPage() {
  const t = useTranslations('upload');
  const tp = useTranslations('pricing');
  const tNav = useTranslations('nav');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  useEffect(() => { logBeta('upload'); }, []);
  // The tier decides how many photos may be uploaded, so it cannot stay pinned
  // to "free": a tester who unlocked 1,000 was still told 250 and stopped
  // there. Read from the account's beta grant; falls back to free while the
  // lookup is in flight or when there is none.
  const [currentTier, setCurrentTier] = useState<Tier>(DEFAULT_TIER);
  // When BETA_OPEN_ACCESS is off, a permanent account is required. The server
  // enforces that in /api/jobs and /api/analyze-demo — but both are only reached
  // when the user presses Analyse, i.e. AFTER uploading up to 250 photos. On a
  // slower machine that is ten minutes of work ending in an error. So ask the
  // server for the policy up front and gate the drop zone instead.
  const [needsAccount, setNeedsAccount] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const policy = await fetch('/api/access-policy', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const registered = !!user && !user.is_anonymous;
        // Fail open on a policy lookup error: the server still refuses the job,
        // so the worst case is the old behaviour, not an unguarded upload.
        if (!cancelled && policy?.accountRequired === true && !registered) {
          setNeedsAccount(true);
        }
        if (!registered) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('beta_grant_tier')
          .eq('id', user.id)
          .maybeSingle();
        const granted = profile?.beta_grant_tier as Tier | null | undefined;
        if (!cancelled && granted && PRICING_PLANS.some((p) => p.tier === granted)) {
          setCurrentTier(granted);
        }
      } catch {
        /* keep the free default — the server enforces the real limit anyway */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [showDropbox, setShowDropbox] = useState(false);
  const setPhotosFromUpload = usePhotoStore((s) => s.setPhotosFromUpload);

  const plan = PRICING_PLANS.find((p) => p.tier === currentTier)!;
  const maxPhotos = plan.photoLimit;

  const { photos, isProcessing, processedCount, totalCount, addFiles, removePhoto, retryFailed, failedCount, clearAll, error } =
    useUpload({ maxPhotos });

  const readyCount = photos.filter((p) => p.status === 'ready').length;
  const canContinue = readyCount > 0 && !isProcessing;

  const goToConfigure = () => {
    setPhotosFromUpload(photos);
    router.push(`/${locale}/app/configure`);
  };

  // Reusable continue button — rendered twice on the upload page (above the
  // grid and below it) so it stays reachable when many photos are present.
  const continueButton = (
    <button
      disabled={!canContinue}
      onClick={goToConfigure}
      className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
        canContinue
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600'
      }`}
    >
      {t('continue')} ({readyCount})
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Simple header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-bold text-indigo-600">
            {brandName(locale)}
          </Link>
          <span className="text-sm text-zinc-500">{tNav('dashboard')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>

        {/* Tier indicator */}
        <div className="mt-2 text-sm text-zinc-500">
          {/* Both need the locale explicitly: without it the server formats in
              en-US and the browser in the user's own locale, which is a
              hydration mismatch and costs this page every click handler.
              See the note in app/pricing. */}
          {/* The tier name, not its price: a granted tier was not paid for, and
              putting "7,99 €" above someone's free allowance invites the
              question of when they will be charged. */}
          {plan.tier === 'free'
            ? tp('freeTitle')
            : plan.tier === 'small'
              ? tp('small')
              : plan.tier === 'medium'
                ? tp('medium')
                : tp('large')}{' '}
          &middot; {t('allowance', { photos: maxPhotos.toLocaleString(locale) })}
        </div>

        {/* Drop zone — replaced by the account gate when registration is required,
            so nobody uploads hundreds of photos before learning they cannot run. */}
        {needsAccount ? (
          <div className="mt-6 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-5 py-6 text-center">
            <h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
              {t('accountGateTitle')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t('accountGateBody')}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/${locale}/auth/register?next=${encodeURIComponent(`/${locale}/app/upload`)}`}
                className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                {tNav('register')}
              </Link>
              <Link
                href={`/${locale}/auth/login?next=${encodeURIComponent(`/${locale}/app/upload`)}`}
                className="rounded-full border border-zinc-300 dark:border-zinc-600 px-5 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {tNav('login')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <DropZone
              onFiles={addFiles}
              maxPhotos={maxPhotos}
              disabled={isProcessing && totalCount >= maxPhotos}
            />
          </div>
        )}

        {/* The browser only holds a reference to each file, so the originals must
            stay put until the download. Said here, before the upload, because
            afterwards it can only be reported as damage (results page). */}
        {!needsAccount && (
          <p className="mt-3 flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span aria-hidden="true">📁</span>
            <span>{t('keepFilesNote')}</span>
          </p>
        )}

        {/* Cloud import */}
        {!needsAccount && dropboxConfigured() && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-400">{t('orImportFrom')}</span>
            <button
              onClick={() => setShowDropbox(true)}
              className="rounded-full border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('importDropbox')}
            </button>
          </div>
        )}

        {showDropbox && (
          <DropboxImport
            onClose={() => setShowDropbox(false)}
            onImport={(files) => {
              addFiles(files);
              setShowDropbox(false);
            }}
          />
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Progress bar */}
        <UploadProgress
          processedCount={processedCount}
          totalCount={totalCount}
          isProcessing={isProcessing}
        />

        {/* Failed-conversion notice + retry (only the failed ones) */}
        {failedCount > 0 && !isProcessing && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm dark:bg-amber-900/20 dark:text-amber-300">
            <span>{t('someFailed', { count: failedCount })}</span>
            <button
              onClick={retryFailed}
              className="self-start sm:self-auto rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              {t('retryFailed', { count: failedCount })}
            </button>
          </div>
        )}

        {/* Top continue button — visible as soon as photos exist, so it stays
            reachable when the grid below grows long. */}
        {photos.length > 0 && (
          <div className="mt-4 flex justify-end">{continueButton}</div>
        )}

        {/* Photo grid */}
        <PhotoGrid photos={photos} onRemove={removePhoto} />

        {/* Bottom actions */}
        {photos.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={clearAll}
              className="text-sm text-zinc-500 hover:text-red-600 transition-colors"
            >
              {t('clearAll')}
            </button>
            {continueButton}
          </div>
        )}
      </main>
    </div>
  );
}
