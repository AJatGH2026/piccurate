'use client';

import { useTranslations } from 'next-intl';
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
import { logBeta } from '@/lib/beta-client';

const DEFAULT_TIER: Tier = 'free';

export default function UploadPage() {
  const t = useTranslations('upload');
  const tNav = useTranslations('nav');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  useEffect(() => { logBeta('upload'); }, []);
  const [currentTier] = useState<Tier>(DEFAULT_TIER);
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
            PicCurate
          </Link>
          <span className="text-sm text-zinc-500">{tNav('dashboard')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>

        {/* Tier indicator */}
        <div className="mt-2 text-sm text-zinc-500">
          {plan.priceDisplay} &middot; {t('supported', { limit: maxPhotos.toLocaleString() })}
        </div>

        {/* Drop zone */}
        <div className="mt-6">
          <DropZone
            onFiles={addFiles}
            maxPhotos={maxPhotos}
            disabled={isProcessing && totalCount >= maxPhotos}
          />
        </div>

        {/* Cloud import */}
        {dropboxConfigured() && (
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
