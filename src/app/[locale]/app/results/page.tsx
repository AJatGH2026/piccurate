'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useEffect, useMemo, useState } from 'react';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { enabledCloudProviders, type CloudProvider } from '@/lib/cloud';
import { reverseGeocode } from '@/utils/geocode';
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { logBeta } from '@/lib/beta-client';
import { EmailCapture } from '@/components/beta/EmailCapture';
import { ResultsFeedback } from '@/components/beta/ResultsFeedback';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function ResultsPage() {
  const t = useTranslations('results');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;
  useEffect(() => { logBeta('results'); }, []);
  const [downloading, setDownloading] = useState(false);
  // Photos whose source file could not be read when the archive was built —
  // moved, renamed, deleted or edited after the upload. `degraded` still made it
  // in as the 512px preview; `missing` could not be included at all.
  const [sourceIssues, setSourceIssues] = useState<{ degraded: string[]; missing: string[] } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
    // A5 (privacy): reverse geocoding sends GPS coordinates to a third party
    // (BigDataCloud, outside the EU). DISABLED by default — no GPS leaves the
    // app. Only re-enable behind explicit user consent + a DPA/SCC by setting
    // NEXT_PUBLIC_ENABLE_GEOCODING=1 (see product-pipeline.md §10 / privacy §6).
    if (process.env.NEXT_PUBLIC_ENABLE_GEOCODING !== '1') return;
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

  // A browser File is only a path reference plus a size/mtime snapshot, not a
  // copy — so reading one only fails once the user has moved, renamed, deleted
  // or edited the source file. Cap the list so a whole missing folder does not
  // produce an unreadable wall of filenames.
  const nameList = (names: string[]) =>
    names.length <= 5
      ? names.join(', ')
      : `${names.slice(0, 5).join(', ')} ${t('moreFiles', { count: names.length - 5 })}`;

  const handleDownload = async () => {
    setDownloading(true);
    setSourceIssues(null);
    setDownloadError(null);
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
        `${brandName(locale)} Selection Summary`,
        `Generated: ${new Date().toISOString().split('T')[0]}`,
        `Photos: ${sorted.length} selected from ${totalCount} total`,
        '',
        'No. | Folder         | Filename                         | Date Taken          | Location                    | Scene Type',
        '----|----------------|----------------------------------|---------------------|-----------------------------|------------',
      ];

      // Collected while building the archive, reported to the user afterwards.
      const degraded: string[] = [];
      const missing: string[] = [];

      for (let i = 0; i < sorted.length; i++) {
        const photo = sorted[i];
        const dateStr = photo.dateTaken
          ? new Date(photo.dateTaken).toISOString().split('T')[0]
          : 'undated';
        const folder = dateStr;
        const prefix = zipMode === 'byday' ? `${folder}/` : ''; // flat = no subfolders

        // Add photo (flat folder or per-day subfolder). One unreadable source
        // file must not abort the whole archive, so every read is guarded and
        // falls back to the 512px preview, which lives in memory as a blob and
        // is therefore independent of the source folder.
        let added = false;
        let sourceUnreadable = false;
        if (photo.originalFile) {
          try {
            const buffer = await photo.originalFile.arrayBuffer();
            zip.file(`${prefix}${photo.filename}`, buffer);
            added = true;
          } catch {
            sourceUnreadable = true;
          }
        }
        if (!added) {
          try {
            const response = await fetch(photo.thumbnailUrl);
            const blob = await response.blob();
            zip.file(`${prefix}${photo.filename.replace(/\.heic$/i, '.jpg')}`, blob);
            added = true;
            // Only a photo that *had* a source file is degraded; without one the
            // preview has always been the intended content (server-side HEIC).
            if (sourceUnreadable) degraded.push(photo.filename);
          } catch {
            // Preview gone too — nothing left to include for this photo.
            missing.push(photo.filename);
          }
        }
        const note = !added
          ? '  ** NOT INCLUDED — source file could not be read'
          : sourceUnreadable
            ? '  ** reduced resolution — source file could not be read'
            : '';

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
          `${num} | ${folder.padEnd(14)} | ${photo.filename.padEnd(32)} | ${dateDisplay.padEnd(19)} | ${location.padEnd(27)} | ${photo.sceneType}${note}`
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

      // Nothing readable at all — an empty archive would only confuse. Say what
      // happened instead of handing the user a ZIP with just an index file.
      if (missing.length === sorted.length && sorted.length > 0) {
        setDownloadError(t('sourceAllGone'));
        return;
      }

      if (degraded.length > 0 || missing.length > 0) {
        summaryLines.push(
          '',
          '',
          'Note: some source files could not be read when this archive was built',
          '(moved, renamed, deleted or edited after the upload).',
          `  reduced to 512px preview: ${degraded.length}`,
          `  not included at all:      ${missing.length}`
        );
      }

      zip.file('_index.txt', summaryLines.join('\n'));

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${brandName(locale).toLowerCase()}-selection-${selectedCount}-photos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (degraded.length > 0 || missing.length > 0) setSourceIssues({ degraded, missing });
      // Primary conversion: a completed download = the user got value.
      trackEvent('download', {
        photos: selectedCount,
        zip_mode: zipMode,
        degraded: degraded.length,
        missing: missing.length,
      });
      trackAdsConversion();
      logBeta('download');
    } catch (err) {
      console.error('ZIP creation failed:', err);
      setDownloadError(t('zipFailed'));
    } finally {
      setDownloading(false);
    }
  };

  const saveToCloud = async (provider: CloudProvider) => {
    setCloudBusy(true);
    setCloudStatus(null);
    try {
      const files: { name: string; blob: Blob }[] = [];
      const degraded: string[] = [];
      const missing: string[] = [];
      for (const photo of selectedPhotos) {
        let source: Blob | null = null;
        let sourceUnreadable = false;
        if (photo.originalFile) {
          try {
            // Probe with a single byte instead of buffering the file: it fails
            // the same way when the source is gone, but keeps the upload lazy —
            // reading every original up front would blow up memory on a large
            // selection. The provider streams the File itself.
            await photo.originalFile.slice(0, 1).arrayBuffer();
            source = photo.originalFile;
          } catch {
            sourceUnreadable = true;
          }
        }
        if (!source) {
          try {
            const r = await fetch(photo.thumbnailUrl);
            source = await r.blob();
            if (sourceUnreadable) degraded.push(photo.filename);
          } catch {
            missing.push(photo.filename);
            continue;
          }
        }
        files.push({ name: photo.filename, blob: source });
      }
      if (files.length === 0) {
        setCloudStatus(t('sourceAllGone'));
        return;
      }
      const res = await provider.uploadSelection(files, (p) =>
        setCloudStatus(t('cloudUploading', { provider: provider.label, done: p.done, total: p.total }))
      );
      setCloudStatus(t('cloudDone', { count: res.uploaded, folder: res.folderName }));
      if (degraded.length > 0 || missing.length > 0) setSourceIssues({ degraded, missing });
    } catch (err) {
      setCloudStatus(t('cloudFailed', { error: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setCloudBusy(false);
    }
  };

  const ceweUrl = `https://www.cewe.de/?utm_source=auswahlbuddy&utm_medium=affiliate&utm_campaign=photobook&utm_content=results`;

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
            <Link href={`/${locale}`} className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
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
          {/* A4 (AI Act): the selection is AI-generated — say so in the result. */}
          <p className="mt-2 text-xs text-zinc-400">{t('aiNotice')}</p>
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

          {downloadError && (
            <p className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {downloadError}
            </p>
          )}

          {/* Source files that vanished mid-session. Named explicitly so the user
              can put them back and re-download at full resolution. */}
          {sourceIssues && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-medium">{t('sourceIssuesTitle')}</p>
              {sourceIssues.degraded.length > 0 && (
                <p className="mt-1">
                  {t('sourceDegraded', {
                    count: sourceIssues.degraded.length,
                    names: nameList(sourceIssues.degraded),
                  })}
                </p>
              )}
              {sourceIssues.missing.length > 0 && (
                <p className="mt-1">
                  {t('sourceMissing', {
                    count: sourceIssues.missing.length,
                    names: nameList(sourceIssues.missing),
                  })}
                </p>
              )}
              <p className="mt-2 text-xs">{t('sourceIssuesHint')}</p>
            </div>
          )}

        </div>

        {/* Beta email capture — its own card, visually separated from the download. */}
        <EmailCapture />

        {/* Beta feedback — same prominent amber treatment; forwards to our inbox. */}
        <ResultsFeedback />

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
        <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6">
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
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-600 px-5 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
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
