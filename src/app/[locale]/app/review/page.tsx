'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ReviewPhotoCard } from '@/components/review/ReviewPhotoCard';
import { SelectionStats } from '@/components/review/SelectionStats';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function ReviewPage() {
  const t = useTranslations('review');
  const tc = useTranslations('common');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const [showRejected, setShowRejected] = useState(false);

  const photos = usePhotoStore((s) => s.photos);
  const toggleSelection = usePhotoStore((s) => s.toggleSelection);
  const saveSelection = usePhotoStore((s) => s.saveSelection);

  const selectedPhotos = photos.filter((p) => p.selected);
  const rejectedPhotos = photos.filter((p) => !p.selected);
  const savedCount = photos.filter((p) => p.saved).length;
  const unsavedSelectedCount = photos.filter((p) => p.selected && !p.saved).length;

  // Group by date
  const dateGroups = new Map<string, typeof photos>();
  for (const photo of photos) {
    const date = photo.dateTaken
      ? new Date(photo.dateTaken).toISOString().split('T')[0]
      : 'Unknown date';
    if (!dateGroups.has(date)) dateGroups.set(date, []);
    dateGroups.get(date)!.push(photo);
  }

  // Scene breakdown for selected
  const sceneBreakdown: Record<string, number> = {};
  for (const p of selectedPhotos) {
    sceneBreakdown[p.sceneType] = (sceneBreakdown[p.sceneType] || 0) + 1;
  }

  // If no photos loaded, redirect back to upload
  if (photos.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 gap-4">
        <p className="text-zinc-500">{t('noPhotos')}</p>
        <Link
          href={`/${locale}/app/upload`}
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {t('goToUpload')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">PicCurate</Link>
          <span className="text-sm text-zinc-500">{tc('stepOf', { current: 3, total: 4 })}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {t('title')}
            </h1>

            {/* Photos by date group */}
            {Array.from(dateGroups.entries()).map(([date, groupPhotos], groupIdx) => {
              const groupSelected = groupPhotos.filter((p) => p.selected);
              const groupRejected = groupPhotos.filter((p) => !p.selected);

              if (groupSelected.length === 0 && !showRejected) return null;

              const geoPhotos = groupPhotos.filter((p) => p.latitude != null && p.longitude != null);

              return (
                <div key={date} className="mt-6">
                  <h2 className="text-sm font-medium text-zinc-500 mb-3">
                    {t('day', { number: groupIdx + 1 })} &mdash; {date}
                    <span className="ml-2 text-indigo-600">
                      ({t('groupSelected', { count: groupSelected.length })})
                    </span>
                    {geoPhotos.length > 0 && (
                      <a
                        href={`https://maps.google.com/?q=${geoPhotos[0].latitude},${geoPhotos[0].longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-zinc-400 hover:text-indigo-500 transition-colors"
                        title={t('withLocation', { count: geoPhotos.length })}
                      >
                        📍 {geoPhotos.length}
                      </a>
                    )}
                  </h2>

                  {/* Selected in this group */}
                  {groupSelected.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {groupSelected.map((photo) => (
                        <ReviewPhotoCard
                          key={photo.id}
                          thumbnailUrl={photo.thumbnailUrl}
                          filename={photo.filename}
                          reasonTag={photo.reasonTag}
                          selected={true}
                          saved={photo.saved}
                          sceneType={photo.sceneType}
                          aestheticScore={photo.aestheticScore}
                          sharpnessScore={photo.sharpnessScore}
                          contentTags={photo.contentTags}
                          latitude={photo.latitude}
                          longitude={photo.longitude}
                          onToggle={() => toggleSelection(photo.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Rejected in this group (when toggled) */}
                  {showRejected && groupRejected.length > 0 && (
                    <div className="mt-3">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                        {groupRejected.map((photo) => (
                          <ReviewPhotoCard
                            key={photo.id}
                            thumbnailUrl={photo.thumbnailUrl}
                            filename={photo.filename}
                            reasonTag={null}
                            selected={false}
                            saved={false}
                            sceneType={photo.sceneType}
                            aestheticScore={photo.aestheticScore}
                            sharpnessScore={photo.sharpnessScore}
                            contentTags={photo.contentTags}
                            latitude={photo.latitude}
                            longitude={photo.longitude}
                            onToggle={() => toggleSelection(photo.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Toggle rejected photos */}
            <button
              onClick={() => setShowRejected(!showRejected)}
              className="mt-6 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showRejected
                ? t('hideRejected')
                : t('showRejected', { count: rejectedPhotos.length })}
            </button>
          </div>

          {/* Sidebar */}
          <div className="lg:w-72 flex-shrink-0">
            <div className="sticky top-4 space-y-4">
              <SelectionStats
                selected={selectedPhotos.length}
                total={photos.length}
                sceneBreakdown={sceneBreakdown}
              />

              <button
                onClick={() => router.push(`/${locale}/app/results`)}
                className="block w-full text-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                {t('finalize')} ({selectedPhotos.length})
              </button>

              {/* Save / lock the current keepers so a re-run with other criteria
                  doesn't reconsider them (smaller pool = faster & cheaper). */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <button
                  onClick={saveSelection}
                  disabled={unsavedSelectedCount === 0}
                  className={`block w-full text-center rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                    unsavedSelectedCount === 0
                      ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  🔒 {t('saveSelection')}{unsavedSelectedCount > 0 ? ` (${unsavedSelectedCount})` : ''}
                </button>
                {savedCount > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">
                    {t('savedHint', { count: savedCount })}
                  </p>
                )}
                <Link
                  href={`/${locale}/app/configure`}
                  className="block w-full text-center rounded-full border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {savedCount > 0 ? t('rerunKeepSaved') : t('rerun')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
