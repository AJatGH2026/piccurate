'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePhotoStore, type ProcessedPhoto } from '@/hooks/usePhotoStore';
import { enabledCloudProviders, type CloudProvider } from '@/lib/cloud';
import { dominantPlace, placeFolder } from '@/utils/geo';
// `trackEvent`/`trackAdsConversion` are the dormant GA4/Ads tag (lib/analytics.ts).
// `trackEv` is the separate first-party funnel (Event-Spezifikation.md), always on.
import { trackEvent, trackAdsConversion } from '@/lib/analytics';
import { trackEv, mark, msSince } from '@/lib/events-client';
import { classifyUserAgent } from '@/lib/userAgent';
import { DownloadAccountGate } from '@/components/results/DownloadAccountGate';
import { ContractConfirmation } from '@/components/legal/ContractConfirmation';
import { logBeta } from '@/lib/beta-client';
import { EmailCapture } from '@/components/beta/EmailCapture';
import { ResultsFeedback } from '@/components/beta/ResultsFeedback';
import { MicroSurvey } from '@/components/results/MicroSurvey';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Reported 2026-08-19: on iPhone Safari, the popup tab opened to preserve
// download gesture authority (see handleDownload) does download the file
// correctly, but the tab itself stays on a literal blank page afterwards —
// window.close() from a timer, not a fresh user gesture inside that window,
// is not reliably honoured there, so the tab does not close and Safari does
// not return focus to the results page on its own. Painting real content
// into it — including a manual close button, which IS a fresh gesture in
// that window and does get honoured — gives the user a way out instead of a
// dead end, regardless of whether the timed auto-close below also fires.
function paintDownloadPopup(win: Window, bodyHtml: string) {
  try {
    // Reported 2026-08-19 (as "text too small, have to zoom in"): this
    // document never got a viewport meta tag, so Safari rendered it at
    // desktop width and shrank the whole page to fit — no font-size fixes
    // that alone. Idempotent; body.innerHTML below only replaces <body>, so
    // this only needs to run once, but checking is cheap and it's called on
    // every paint.
    if (!win.document.querySelector('meta[name="viewport"]')) {
      const meta = win.document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1';
      win.document.head.appendChild(meta);
    }
    win.document.body.innerHTML = `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafafa;color:#18181b;"><div style="max-width:340px;text-align:center;">${bodyHtml}</div></div>`;
  } catch {
    /* window already closed or otherwise inaccessible — nothing to paint */
  }
}

export default function ResultsPage() {
  const t = useTranslations('results');
  const tc = useTranslations('common');
  const params = useParams();
  const locale = params.locale as string;
  // Set once a download starts, so the idle-exit listener below (registered
  // once on mount) never mistakes an active session for an abandoned one.
  const hasActedRef = useRef(false);
  useEffect(() => {
    logBeta('results');
    const snapPhotos = usePhotoStore.getState().photos;
    trackEv('results_shown', locale, {
      selected_count: snapPhotos.filter((p) => p.selected).length,
      total_count: snapPhotos.length,
    });
    // Event-Spezifikation §5: `results_idle_exit` — "die entlarvendste Kennzahl
    // der ganzen Spezifikation". Same dual-listener pattern as the analysis
    // page: pagehide for a hard navigation/tab close, effect cleanup for an
    // in-app (SPA) navigation away, guarded so it only ever fires once.
    const shownAt = Date.now();
    const fireIdleExit = () => {
      if (!hasActedRef.current) {
        hasActedRef.current = true;
        trackEv('results_idle_exit', locale, { time_on_results_ms: Date.now() - shownAt });
      }
    };
    window.addEventListener('pagehide', fireIdleExit);
    return () => {
      window.removeEventListener('pagehide', fireIdleExit);
      fireIdleExit();
    };
  }, [locale]);
  const [downloading, setDownloading] = useState(false);
  // Event-Spezifikation §6: one-click question shown right after a completed
  // download. null = not shown yet, false = shown/unanswered, true = answered.
  const [microSurvey, setMicroSurvey] = useState<'hidden' | 'shown' | 'answered'>('hidden');
  // Photos whose source file could not be read when the archive was built —
  // moved, renamed, deleted or edited after the upload. `degraded` still made it
  // in as the 512px preview; `missing` could not be included at all.
  const [sourceIssues, setSourceIssues] = useState<{ degraded: string[]; missing: string[] } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Reported 2026-08-19: on mobile, a completed download is easy to miss (a
  // sound plays, nothing on screen changes) — this drives a more prominent
  // confirmation than the small print below the button.
  const [downloadSucceeded, setDownloadSucceeded] = useState(false);
  // 'flat' = one folder for the whole trip (best for photo-book auto-import);
  // 'byday' = one subfolder per day (best for the user's own organisation).
  const [zipMode, setZipMode] = useState<'flat' | 'byday' | 'byplace'>('flat');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  // Signed-in users get a sign-out option here; demo users have no account.
  // Client-side check because this page is a client component — and it stays
  // silent when Supabase isn't configured, so the demo flow never breaks.
  const [user, setUser] = useState<{ email?: string } | null>(null);
  // Whether the auth answer has arrived. Without it a click on Download in the
  // first moments after load would see `user === null` and wrongly demand an
  // account from someone who has one.
  const [authChecked, setAuthChecked] = useState(false);
  const [showDownloadGate, setShowDownloadGate] = useState(false);
  // Set the moment the gate is passed. A ref, not state: onUnlocked starts the
  // download in the same tick, and a setUser() there would not be visible yet
  // — downloadNeedsAccount() would still see "no account" and reopen the
  // dialog it just closed, forever.
  const accountJustCreatedRef = useRef(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        // Anonymous sign-in means demo users now have a session too — but there
        // is nothing for them to sign out of, and offering it would suggest they
        // had an account. Only real accounts get the button.
        if (!cancelled) {
          setUser(data.user && !data.user.is_anonymous ? data.user : null);
          setAuthChecked(true);
        }
      })
      .catch(() => {
        /* not signed in, or auth unreachable — leave the button hidden */
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const cloudProviders = enabledCloudProviders();

  const photos = usePhotoStore((s) => s.photos);
  const contract = usePhotoStore((s) => s.contract);
  const selectedPhotos = photos.filter((p) => p.selected);
  const selectedCount = selectedPhotos.length;
  const totalCount = photos.length;

  // Group the selected photos by day for the trip overview. The place label
  // comes from the analysis (the model reads it off the coordinates that
  // travelled with the photo), so there is no geocoding round-trip and no
  // third-party recipient — see utils/geo.ts.
  const dayGroups = useMemo(() => {
    const m = new Map<string, { date: string; places: string[]; count: number }>();
    for (const p of photos) {
      if (!p.selected) continue;
      const date = p.dateTaken ? new Date(p.dateTaken).toISOString().split('T')[0] : 'undated';
      const g = m.get(date) || { date, places: [], count: 0 };
      g.count++;
      if (p.place) g.places.push(p.place);
      m.set(date, g);
    }
    return [...m.values()]
      .map((g) => ({ date: g.date, count: g.count, place: dominantPlace(g.places) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [photos]);

  // Distinct places across the selection, most photos first — drives the
  // "per place" ZIP layout and tells us whether offering it makes sense.
  const placeGroups = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of photos) {
      if (!p.selected || !p.place) continue;
      m.set(p.place, (m.get(p.place) || 0) + 1);
    }
    return [...m.entries()]
      .map(([place, count]) => ({ place, count }))
      .sort((a, b) => b.count - a.count || a.place.localeCompare(b.place));
  }, [photos]);
  const hasPlaces = placeGroups.length > 0;

  // A browser File is only a path reference plus a size/mtime snapshot, not a
  // copy — so reading one only fails once the user has moved, renamed, deleted
  // or edited the source file. Cap the list so a whole missing folder does not
  // produce an unreadable wall of filenames.
  const nameList = (names: string[]) =>
    names.length <= 5
      ? names.join(', ')
      : `${names.slice(0, 5).join(', ')} ${t('moreFiles', { count: names.length - 5 })}`;

  /**
   * True when the ZIP download must ask for an account first (2026-08-27).
   * Deliberately fails OPEN when Supabase is not configured — a local or demo
   * run has no accounts at all, and a gate nobody can pass is a broken page,
   * not a strict one. `authChecked` guards the moment before the auth answer
   * arrives, so a fast click is never mistaken for "not signed in".
   */
  const downloadNeedsAccount = () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
    if (!authChecked) return false;
    if (accountJustCreatedRef.current) return false;
    return !user;
  };

  const handleDownload = async () => {
    // The account gate, before anything else happens — in particular before
    // the WebKit window below is opened, which would otherwise leave a blank
    // tab sitting behind the dialog.
    if (downloadNeedsAccount()) {
      setShowDownloadGate(true);
      // This is where an account is actually demanded now, so this is where
      // the event belongs. It used to fire on the upload page; counting it in
      // both places would double the same visitor.
      trackEv('account_gate_shown', locale);
      return;
    }

    // Open the download's destination tab SYNCHRONOUSLY, in the same tick as
    // the click — before any `await` below. Reported 2026-08-15: on iPhone
    // Safari the download silently did nothing (no sound, no error) once the
    // selection was small enough that it usually worked, but not always.
    // That matches a known WebKit behaviour: the "user activation" a tap
    // grants is short-lived and can expire during async work (reading files,
    // building the ZIP), after which a.click() on a download link is simply
    // ignored — no exception, nothing to catch. A window opened in direct,
    // synchronous response to the click keeps its gesture authority even
    // after the async work that follows; the ZIP only needs to be navigated
    // to once it exists. Kept 100% client-side on purpose (§ architecture
    // rule: originals never touch the server) — this only changes *how* the
    // already-built blob reaches the user, not what gets built.
    //
    // Only WebKit actually needs this: it's a WebKit gesture-expiry quirk,
    // not a Safari-branding one — Apple requires every iOS browser (Chrome,
    // Firefox, ...) to run on WebKit too, so "iOS" is checked directly rather
    // than trusting the UA's browser label. On desktop, only Safari itself is
    // WebKit; Chrome/Firefox/Edge there use their own engines and already
    // honour a plain `a.click()` after the async ZIP build, same as Android.
    // Reported 2026-08-19: the popup tab was landing on everyone, including
    // browsers that never had the bug, and sitting there on about:blank
    // instead of leaving the user on the results page.
    const ua = classifyUserAgent(navigator.userAgent);
    const isWebKit = ua.os_family === 'ios' || ua.browser_family === 'safari';
    const downloadWindow = isWebKit ? window.open('', '_blank') : null;
    if (downloadWindow) {
      paintDownloadPopup(
        downloadWindow,
        `<div style="font-size:64px;margin-bottom:20px;">⏳</div><p style="font-size:26px;font-weight:700;margin:0;">${t('downloadPopupPreparing')}</p>`
      );
    }
    setDownloading(true);
    setSourceIssues(null);
    setDownloadError(null);
    setDownloadSucceeded(false);
    hasActedRef.current = true; // a started download is never an idle exit, success or not
    mark('download_started');
    const selectedMb = selectedPhotos.reduce((sum, p) => sum + (p.originalFile?.size ?? 0), 0) / (1024 * 1024);
    trackEv('download_started', locale, {
      selected_count: selectedCount,
      total_mb: Math.round(selectedMb * 10) / 10,
    });
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Sort selected photos by date taken (earliest first), undated last.
      // In "per place" mode, group by place first and keep the trip's
      // chronology inside each one — a place folder that jumps around in
      // time is harder to use than no folders at all.
      const byDate = (a: ProcessedPhoto, b: ProcessedPhoto) => {
        if (!a.dateTaken && !b.dateTaken) return 0;
        if (!a.dateTaken) return 1;
        if (!b.dateTaken) return -1;
        return a.dateTaken.localeCompare(b.dateTaken);
      };
      const placeRank = new Map(placeGroups.map((g, i) => [g.place, i]));
      const sorted = [...selectedPhotos].sort((a, b) => {
        if (zipMode === 'byplace') {
          // Photos without a place sort last, together.
          const ra = a.place ? (placeRank.get(a.place) ?? 9998) : 9999;
          const rb = b.place ? (placeRank.get(b.place) ?? 9998) : 9999;
          if (ra !== rb) return ra - rb;
        }
        return byDate(a, b);
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
        const folder =
          zipMode === 'byplace' ? placeFolder(photo.place || t('zipNoPlace')) : dateStr;
        const prefix = zipMode === 'flat' ? '' : `${folder}/`; // flat = no subfolders

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
        // Prefer the readable place name; fall back to raw coordinates. The
        // full-precision pair stays local — only the coarsened one was sent
        // for naming, and the ZIP never leaves the device.
        const location =
          photo.place ||
          (photo.latitude != null && photo.longitude != null
            ? `${photo.latitude.toFixed(4)}, ${photo.longitude.toFixed(4)}`
            : '');
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
        downloadWindow?.close(); // don't leave the reserved tab sitting blank
        setDownloadError(t('sourceAllGone'));
        trackEv('download_failed', locale, { error_class: 'file_missing', selected_count: selectedCount });
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
      const filename = `${brandName(locale).toLowerCase()}-selection-${selectedCount}-photos.zip`;
      if (downloadWindow && !downloadWindow.closed) {
        // Still holds the gesture authority from the click. Built as a real
        // <a download> INSIDE the popup's own document, not a bare
        // `location.href = url` navigation — the latter has no filename to
        // offer, so Safari's download-confirmation sheet showed "Unknown.zip"
        // (reported 2026-08-19). Triggering it doesn't unload the tab's
        // document (a download, unlike a real navigation, leaves whatever is
        // on screen in place), so the popup content painted below stays
        // visible afterwards.
        const popupLink = downloadWindow.document.createElement('a');
        popupLink.href = url;
        popupLink.download = filename;
        downloadWindow.document.body.appendChild(popupLink);
        popupLink.click();
        // Reported 2026-08-19: the painted "back to your selection" link
        // navigated the POPUP tab to the results URL — a fresh browsing
        // context with an empty in-memory photo store (nothing is persisted
        // server-side by design), so it showed "0 photos" and looked like
        // the analysis had been lost. It hadn't; that tab just never had it.
        // The real results page is still open, untouched, in the tab this
        // popup was opened from — so the only safe action here is closing
        // this one, never navigating it.
        paintDownloadPopup(
          downloadWindow,
          `<div style="font-size:64px;margin-bottom:20px;">✅</div>` +
            `<p style="font-size:26px;font-weight:700;margin:0 0 16px;">${t('downloadPopupReady')}</p>` +
            `<p style="font-size:19px;line-height:1.5;color:#52525b;margin:0 0 24px;">${t('downloadLocationHint')}</p>` +
            `<p style="font-size:17px;line-height:1.5;color:#71717a;margin:0 0 28px;">${t('downloadPopupBackHint')}</p>` +
            `<button onclick="window.close()" style="padding:18px 40px;border-radius:999px;border:none;background:#4f46e5;color:#fff;font-size:20px;font-weight:600;">${t('downloadPopupClose')}</button>`
        );
        // Once a click resolves to a download, the browser hands it off to
        // its download manager and detaches it from the tab — closing the
        // tab after that point doesn't interrupt the transfer. Best-effort
        // only: reported 2026-08-19, this does not reliably close the tab on
        // iPhone Safari (a timer isn't a fresh user gesture there) — the
        // close button painted above IS a fresh gesture, and reportedly
        // works, which is why the user always has that regardless of
        // whether this timer succeeds.
        setTimeout(() => {
          try {
            downloadWindow.close();
          } catch {
            /* already closed by the user, or by the browser — fine either way */
          }
        }, 2000);
      } else {
        // No popup (blocked, or window.open unsupported) — the synchronous
        // click still works on browsers that don't drop gesture authority
        // across the async gap, which is most of them.
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // The new tab needs a moment to actually start reading the blob before
      // its URL is safe to revoke — revoking immediately risks a race on a
      // slow connection, so this waits rather than freeing it right away.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
      trackEv('download_completed', locale, { duration_ms: msSince('download_started') });
      trackEv('micro_survey_shown', locale);
      setMicroSurvey('shown');
      setDownloadSucceeded(true);
    } catch (err) {
      console.error('ZIP creation failed:', err);
      downloadWindow?.close(); // don't leave the reserved tab sitting blank
      setDownloadError(t('zipFailed'));
      trackEv('download_failed', locale, {
        error_class: err instanceof Error && /memory|allocat/i.test(err.message) ? 'memory' : 'other',
        selected_count: selectedCount,
      });
    } finally {
      setDownloading(false);
    }
  };

  const saveToCloud = async (provider: CloudProvider) => {
    // Open the OAuth popup SYNCHRONOUSLY, in the same tick as the click —
    // before any `await` below. Reported 2026-08-19: "Popup blocked" on
    // mobile, because window.open() previously happened deep inside
    // popupOAuth() — after this function's own async file-reading loop AND
    // the PKCE challenge (an async crypto.subtle.digest) — several awaits
    // past the point mobile browsers still treat it as gesture-authorised.
    // Same fix as the ZIP download's popup further up this file: open blank,
    // in-gesture, hand it down so the real auth URL can navigate it once ready.
    //
    // Target is `_blank`, not a custom name — reported a THIRD time
    // 2026-08-19, still blocked after both the synchronous-open fix and
    // dropping the width=/height= features string. The ZIP download's popup
    // — `window.open('', '_blank')` — is the only one of the two that has
    // ever worked on the reporting device, and the target name is now the
    // only remaining difference between the two calls. Trades away a custom
    // name's one benefit (a second click re-focusing the same window instead
    // of opening a new one) for actually working.
    const popup = window.open('', '_blank');
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
        popup?.close(); // nothing to upload, so no OAuth needed either
        setCloudStatus(t('sourceAllGone'));
        return;
      }
      const res = await provider.uploadSelection(
        files,
        (p) => setCloudStatus(t('cloudUploading', { provider: provider.label, done: p.done, total: p.total })),
        popup
      );
      setCloudStatus(t('cloudDone', { count: res.uploaded, folder: res.folderName }));
      if (degraded.length > 0 || missing.length > 0) setSourceIssues({ degraded, missing });
    } catch (err) {
      popup?.close(); // leftover if the error happened before uploadSelection took it over
      setCloudStatus(t('cloudFailed', { error: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setCloudBusy(false);
    }
  };

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
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{tc('stepOf', { current: 4, total: 4 })}</span>
            {/* The results page is where a session actually ends, so this is
                where signing out belongs. Demo users have no account — nothing
                is shown for them. */}
            {user && <LogoutButton locale={locale} />}
          </div>
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
          {/* The selection is AI-generated, and this is also where the backup
              warning belongs: the download is where tidying up starts to look
              tempting. zinc-400 at 12px sat around 2.6:1 on white — legible
              enough for a footnote, not for the line that backs terms § 12. */}
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('aiNotice')}</p>
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
                  {g.place && <span className="text-zinc-500">· 📍 {g.place}</span>}
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

          {/* ZIP structure choice. The "per place" option only appears once
              the analysis has actually produced place names — offering an
              empty folder scheme would be a broken promise. */}
          <div className={`mt-4 grid gap-2 ${hasPlaces ? 'grid-cols-3' : 'grid-cols-2'}`}>
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
            {hasPlaces && (
              <button
                type="button"
                onClick={() => setZipMode('byplace')}
                className={`rounded-xl border p-3 text-left text-sm transition-colors ${
                  zipMode === 'byplace'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{t('zipByPlace')}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {t('zipByPlaceDesc', { count: placeGroups.length })}
                </div>
              </button>
            )}
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
          {/* Reported 2026-08-15: on mobile, a download completes (a sound
              plays) but nothing on screen says WHERE it went — the browser's
              own download UI is easy to miss on a phone. We can't point to an
              exact folder (that's the browser's call, not this page's), but
              naming the usual place beats saying nothing. */}
          <p className="mt-2 text-center text-xs text-zinc-400">{t('downloadLocationHint')}</p>

          {/* Same information as the small print above, but shown prominently
              right after a completed download — that small print is easy to
              have never registered before the click, and by the time the
              download sound plays, attention has often moved elsewhere. */}
          {downloadSucceeded && !downloadError && (
            <p className="mt-3 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">
              {t('downloadCompleteHint')}
            </p>
          )}

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

        {/* One-click question, right after a completed download (§6). */}
        {microSurvey !== 'hidden' && (
          <MicroSurvey
            locale={locale}
            answered={microSurvey === 'answered'}
            onAnswered={() => setMicroSurvey('answered')}
          />
        )}

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

        {/* Photobook hint — deliberately without a provider link.
            This used to be a CTA to cewe.de carrying utm_medium=affiliate. No
            commission agreement exists (confirmed 2026-08-11), so the tag
            described a relationship we do not have; and a link that looks like
            a partner link without being labelled as advertising is a needless
            § 5a UWG target. Naming no provider keeps the useful part — you can
            take the ZIP to a photobook service — without either problem.
            Bring the link back only together with a real contract and a
            "Partnerlink" label. */}
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
            </div>
          </div>
        </div>

        {/* The same confirmation offered on /configure when the contract was
            formed, repeated here because that page is long gone by now and a
            copy the visitor can only save in the seconds before they click on
            would be a poor durable medium. */}
        {contract && (
          <ContractConfirmation
            jobId={contract.jobId}
            tier={contract.tier}
            photoLimit={contract.photoLimit}
            placedAt={contract.placedAt}
            locale={locale}
          />
        )}

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

      {showDownloadGate && (
        <DownloadAccountGate
          locale={locale}
          jobId={contract?.jobId}
          onClose={() => setShowDownloadGate(false)}
          onUnlocked={() => {
            // The session is now a permanent account. Reflect that locally so
            // the gate does not reappear, then start the download the user
            // asked for in the first place — they should not have to find the
            // button again.
            accountJustCreatedRef.current = true;
            setUser({ email: undefined });
            setShowDownloadGate(false);
            // We finally have an address for a contract that was concluded
            // anonymously, so the § 312f confirmation can go out by mail as
            // well. Idempotent server-side (jobs.confirmation_sent_at), and
            // deliberately not awaited: the download must not wait on our
            // mailer, and a failure here is retried the next time this runs.
            if (contract?.jobId) {
              void fetch(
                `/api/jobs/${encodeURIComponent(contract.jobId)}/confirmation?locale=${encodeURIComponent(locale)}`,
                { method: 'POST' }
              ).catch(() => {
                /* the on-screen copy above already discharged the obligation */
              });
            }
            void handleDownload();
          }}
        />
      )}
    </div>
  );
}
