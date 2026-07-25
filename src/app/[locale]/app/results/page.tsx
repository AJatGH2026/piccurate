'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { enabledCloudProviders, type CloudProvider } from '@/lib/cloud';
import { reverseGeocode } from '@/utils/geocode';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ResultsPage() {
  const t = useTranslations('results');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;
  const [downloading, setDownloading] = useState(false);
  // 'flat' = one folder for the whole trip (best for photo-book auto-import);
  // 'byday' = one subfolder per day (best for the user's own organisation).
  const [zipMode, setZipMode] = useState<'flat' | 'byday'>('flat');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const cloudProviders = enabledCloudProviders();

  const photos = usePhotoStore((s) => s.photos);
  const selectedPhotos = photos.filter((p) => p.selected);
  const selectedCount = selectedPhotos.length;
  const totalCount = photos.length;

  // Group the selected photos by day, with one representative GPS point each,
  // for the trip overview (date + place name). Keyed on the stable store ref.
  const dayGroups = useMemo(() => {
    const m = new Map<string, { date: string; lat: number | null; lon: number | null; count: number }>();
    for (const p of photos) {
      if (!p.selected) continue;
      const date = p.dateTaken ? new Date(p.dateTaken).toISOString().split('T')[0] : 'undated';
      const g = m.get(date) || { date, lat: null, lon: null, count: 0 };
      g.count++;
      if (g.lat == null && p.latitude != null && p.longitude != null) {
        g.lat = p.latitude;
        g.lon = p.longitude;
      }
      m.set(date, g);
    }
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [photos]);

  // Resolve place names for the days that have GPS (cached, localized).
  const [placeByDay, setPlaceByDay] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const g of dayGroups) {
        if (g.lat == null || g.lon == null) continue;
        const label = await reverseGeocode(g.lat, g.lon, locale);
        if (label && !cancelled) {
          setPlaceByDay((prev) => (prev[g.date] === label ? prev : { ...prev, [g.date]: label }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dayGroups, locale]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Sort selected photos by date taken (earliest first), undated last
      const sorted = [...selectedPhotos].sort((a, b) => {
        if (!a.dateTaken && !b.dateTaken) return 0;
        if (!a.dateTaken) return 1;
        if (!b.dateTaken) return -1;
        return a.dateTaken.localeCompare(b.dateTaken);
      });

      // Build summary lines for the index file
      const summaryLines: string[] = [
        'PicCurate Selection Summary',
        `Generated: ${new Date().toISOString().split('T')[0]}`,
        `Photos: ${sorted.length} selected from ${totalCount} total`,
        '',
        'No. | Folder         | Filename                         | Date Taken          | Location                    | Scene Type',
        '----|----------------|----------------------------------|---------------------|-----------------------------|------------',
      ];

      for (let i = 0; i < sorted.length; i++) {
        const photo = sorted[i];
        const dateStr = photo.dateTaken
          ? new Date(photo.dateTaken).toISOString().split('T')[0]
          : 'undated';
        const folder = dateStr;
        const prefix = zipMode === 'byday' ? `${folder}/` : ''; // flat = no subfolders

        // Add photo (flat folder or per-day subfolder)
        if (photo.originalFile) {
          const buffer = await photo.originalFile.arrayBuffer();
          zip.file(`${prefix}${photo.filename}`, buffer);
        } else {
          const response = await fetch(photo.thumbnailUrl);
          const blob = await response.blob();
          zip.file(`${prefix}${photo.filename.replace(/\.heic$/i, '.jpg')}`, blob);
        }

        // Build summary line
        const dateDisplay = photo.dateTaken
          ? new Date(photo.dateTaken).toISOString().replace('T', ' ').slice(0, 19)
          : 'Unknown';
        const location =
          photo.latitude != null && photo.longitude != null
            ? `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`
            : '';
        const num = String(i + 1).padStart(3);
        summaryLines.push(
          `${num} | ${folder.padEnd(14)} | ${photo.filename.padEnd(32)} | ${dateDisplay.padEnd(19)} | ${location.padEnd(27)} | ${photo.sceneType}`
        );
      }

      // Add locations summary at the bottom
      const photosWithLocation = sorted.filter((p) => p.latitude != null && p.longitude != null);
      if (photosWithLocation.length > 0) {
        summaryLines.push('', '', 'Locations (Google Maps links):', '');
        const seen = new Set<string>();
        for (const p of photosWithLocation) {
          const key = `${p.latitude!.toFixed(3)},${p.longitude!.toFixed(3)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          summaryLines.push(
            `  ${p.dateTaken ? new Date(p.dateTaken).toISOString().split('T')[0] : 'undated'} — https://maps.google.com/?q=${p.latitude},${p.longitude}`
          );
        }
      }

      zip.file('_index.txt', summaryLines.join('\n'));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `piccurate-selection-${selectedCount}-photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Primary conversion: a completed download = the user got value.
      trackEvent('download', { photos: selectedCount, zip_mode: zipMode });
      trackAdsConversion();
    } catch (err) {
      console.error('ZIP creation failed:', err);
      alert(t('zipFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const saveToCloud = async (provider: CloudProvider) => {
    setCloudBusy(true);
    setCloudStatus(null);
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (const photo of selectedPhotos) {
        if (photo.originalFile) {
          files.push({ name: photo.filename, blob: photo.originalFile });
        } else {
          const r = await fetch(photo.thumbnailUrl);
          files.push({ name: photo.filename, blob: await r.blob() });
        }
      }
      const res = await provider.uploadSelection(files, (p) =>
        setCloudStatus(t('cloudUploading', { provider: provider.label, done: p.done, total: p.total }))
      );
      setCloudStatus(t('cloudDone', { count: res.uploaded, folder: res.folderName }));
    } catch (err) {
      setCloudStatus(t('cloudFailed', { error: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setCloudBusy(false);
    }
  };

  const ceweUrl = `https://www.cewe.de/?utm_source=piccurate&utm_medium=affiliate&utm_campaign=photobook&utm_content=results`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link
              href={`/${locale}/app/review`}
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
            >
              <span aria-hidden="true">←</span> {tc('back')}
            </Link>
            <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">PicCurate</Link>
          </div>
          <span className="text-sm text-zinc-500">{tc('stepOf', { current: 4, total: 4 })}</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Success state */}
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {t('title')}
          </h1>
          <p className="mt-2 text-zinc-500">
            {t('subtitle', { count: selectedCount, total: totalCount })}
          </p>
        </div>

        {/* Selected photo preview */}
        {selectedPhotos.length > 0 && (
          <div className="mt-8 grid grid-cols-4 sm:grid-cols-6 gap-2">
            {selectedPhotos.slice(0, 12).map((photo) => (
              <div key={photo.id} className="aspect-square rounded-lg overflow-hidden">
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.filename}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {selectedPhotos.length > 12 && (
              <div className="aspect-square rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm text-zinc-500">
                +{selectedPhotos.length - 12}
              </div>
            )}
          </div>
        )}

        {/* Trip overview: date + place name (where GPS is available) */}
        {dayGroups.length > 0 && (
          <div className="mt-8 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('tripOverview')}</h2>
            <ul className="mt-3 space-y-1.5">
              {dayGroups.map((g) => (
                <li key={g.date} className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {g.date === 'undated' ? t('undatedLabel') : g.date}
                  </span>
                  {placeByDay[g.date] && (
                    <span className="text-zinc-500">· 📍 {placeByDay[g.date]}</span>
                  )}
                  <span className="ml-auto text-xs text-zinc-400">{g.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Download card */}
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('download')}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t('fullResNote', { count: selectedCount })}
          </p>

          {/* ZIP structure choice */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setZipMode('flat')}
              className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                zipMode === 'flat'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="font-medium text-zinc-900 dark:text-zinc-100">{t('zipFlat')}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{t('zipFlatDesc')}</div>
            </button>
            <button
              type="button"
              onClick={() => setZipMode('byday')}
              className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                zipMode === 'byday'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <div className="font-medium text-zinc-900 dark:text-zinc-100">{t('zipByDay')}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{t('zipByDayDesc')}</div>
            </button>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading || selectedCount === 0}
            className={`mt-4 w-full rounded-full py-3 text-sm font-semibold transition-colors ${
              downloading
                ? 'bg-zinc-200 text-zinc-500 cursor-wait dark:bg-zinc-700'
                : selectedCount === 0
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {downloading ? t('downloading') : t('downloadAction', { count: selectedCount })}
          </button>
        </div>

        {/* Save to cloud (only when a provider is configured) */}
        {cloudProviders.length > 0 && (
          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('cloudHeading')}</h2>
            <p className="mt-1 text-sm text-zinc-500">{t('cloudHint')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {cloudProviders.map((p) => (
                <button
                  key={p.id}
                  onClick={() => saveToCloud(p)}
                  disabled={cloudBusy || selectedCount === 0}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                    cloudBusy || selectedCount === 0
                      ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-700'
                      : 'bg-sky-600 text-white hover:bg-sky-700'
                  }`}
                >
                  {t('cloudSaveTo', { provider: p.label })}
                </button>
              ))}
            </div>
            {cloudStatus && <p className="mt-3 text-sm text-indigo-600 dark:text-indigo-400">{cloudStatus}</p>}
          </div>
        )}

        {/* Photobook CTA */}
        <div className="mt-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6">
          <div className="flex items-start gap-4">
            <div className="text-3xl">📖</div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {t('photobook')}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t('photobookDesc')}
              </p>
              <a
                href={ceweUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                {t('photobookCta')}
                <span className="text-xs">↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* Start over */}
        <div className="mt-8 text-center">
          <Link
            href={`/${locale}/app/upload`}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {t('newJob')}
          </Link>
        </div>
      </main>
    </div>
  );
}
