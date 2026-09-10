'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { classifyUserAgent } from '@/lib/userAgent';
import {
  buildContractConfirmation,
  confirmationFilename,
  freeTierLabel,
  paidTierLabel,
  type ContractConfirmation as ContractData,
} from '@/lib/contract-confirmation';

/**
 * The § 312f BGB confirmation, shown in the flow at the moment the contract is
 * concluded, with a button that saves it as a file.
 *
 * Why on screen and not only by email (2026-08-27): since the account gate
 * moved to the ZIP download, the visitor who concludes a free contract usually
 * has no account and no address, so there is nobody to mail. § 312f Abs. 2 asks
 * for a durable medium, not for email — § 126b covers anything the recipient
 * can store and reproduce unchanged, and a saved file does. This is that
 * medium for the anonymous case.
 *
 * **Not an automatic download, on purpose.** Dropping a file into the Downloads
 * folder of someone who wanted to try a photo tool is hostile, and the whole
 * reason the gate moved was that friction here costs the visitors we want. The
 * text is rendered where they are, the save is one click, and anyone who does
 * give us an address later gets the identical text mailed as well (see
 * /api/jobs/[jobId]/confirmation) — so the record does not rest on this click
 * alone.
 */
export function ContractConfirmation({
  jobId,
  tier,
  photoLimit,
  placedAt,
  locale,
  saveBlocked = false,
}: {
  jobId: string;
  tier: string;
  photoLimit: number;
  placedAt: string;
  locale: string;
  /**
   * Force the popup route even on browsers that would not otherwise need it.
   *
   * Since 2026-09-10 WebKit takes the popup route regardless of this flag (see
   * `usePopup` in save()), so this now only adds the browsers that are fine
   * with a same-tab download but must not have one *right now*.
   *
   * Reported 2026-08-29: saving during the analysis on iOS killed the run after
   * 100 of 249 photos with "Load failed" — Safari treats the download of a blob
   * URL, triggered in the SAME tab as the one making the request, as leaving
   * the page, which aborts every in-flight analyze-demo fetch. First fix
   * (2026-08-29) was disabling the button until the run ended — technically
   * safe, but § 312f Abs. 2 wants this confirmation available *before*
   * performance begins, i.e. exactly during the window it was disabled in, and
   * the page navigates on to /review within moments of the run ending, so
   * there was no practical window left to use it (flagged 2026-09-01).
   *
   * Fixed properly by not needing the same tab at all: the ZIP download in
   * results/page.tsx already establishes that a `<a download>` built and
   * clicked inside a window opened synchronously via `window.open('', '_blank')`
   * does not unload *that* window, let alone the one it was opened from — so
   * building the link in the popup's own document, not this tab's, keeps
   * whatever iOS does to "the tab that downloads" away from the tab actually
   * running the fetches. No browser-sniffing needed: this path is only taken
   * while `saveBlocked` is true (i.e. analysis running), and doing it in a
   * popup costs nothing on browsers that were never affected either.
   */
  saveBlocked?: boolean;
}) {
  const t = useTranslations('legal');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  // Only for the on-screen hint below — save() reads the UA itself, since a
  // click handler always runs on the client. Starts false so the server render
  // and the first client render agree; the effect corrects it right after.
  const [isWebKit, setIsWebKit] = useState(false);
  useEffect(() => {
    const ua = classifyUserAgent(navigator.userAgent);
    setIsWebKit(ua.os_family === 'ios' || ua.browser_family === 'safari');
  }, []);

  const { text, filename } = useMemo(() => {
    const data: ContractData = {
      free: true,
      tierLabel: tier === 'free' ? freeTierLabel(locale) : paidTierLabel(tier),
      photoLimit,
      orderRef: jobId,
      placedAt: new Date(placedAt),
      locale,
    };
    return {
      text: buildContractConfirmation(data).text,
      filename: confirmationFilename(jobId, locale),
    };
  }, [jobId, tier, photoLimit, placedAt, locale]);

  /**
   * Build the blob URL **in the document that is going to consume it**.
   *
   * Reported 2026-09-10 from an iPhone: saving during the analysis (the popup
   * path below) died on Safari's own error page — "Der Vorgang konnte nicht
   * abgeschlossen werden. (WebKitBlobResource-Fehler 1.)", i.e. Safari tried to
   * LOAD the blob URL as a page and could not resolve it at all.
   *
   * Two things were wrong with creating it here in the opener and handing the
   * string to a link inside the popup:
   *
   *  1. A blob URL is registered against the document that created it. An
   *     `about:blank` popup inherits the opener's origin, so this looks like it
   *     should resolve — and on desktop WebKit it does — but on iOS the lookup
   *     from the other browsing context is what produces exactly this error.
   *     Creating the blob through the popup's OWN `Blob`/`URL` (its realm, its
   *     registry) removes the cross-document hop entirely.
   *  2. `text/plain` is a type Safari renders inline, so it treats the link as
   *     something to navigate to rather than something to save — which is why
   *     the failure surfaced as a page load in the first place. An opaque type
   *     leaves it no such option, and is the reason the ZIP download next door
   *     (`application/zip`, same popup pattern) was never affected.
   *
   * Falls back to this document's own URL/Blob when the popup's realm is not
   * reachable, which is no worse than what it did before.
   */
  const makeBlobUrl = (realm: Window): string => {
    const B = (realm as Window & { Blob?: typeof Blob }).Blob ?? Blob;
    const U = (realm as Window & { URL?: typeof URL }).URL ?? URL;
    // Not text/plain — see (2) above. The .txt extension in `filename` still
    // tells the user and their OS what this is.
    return U.createObjectURL(new B([text], { type: 'application/octet-stream' }));
  };

  const save = () => {
    // WebKit always takes the popup route, not just while the analysis is
    // running.
    //
    // Reported 2026-09-10 from an iPhone, immediately after the blob-realm fix
    // below landed: saving DURING the analysis worked, saving on /results —
    // the same-tab route — did not. It opened a viewer window that stayed
    // blank and, on reload, showed the same WebKitBlobResource error. So iOS
    // does not honour `<a download>` on a blob as a save at all here; it
    // navigates a new context to the URL, which is precisely the lookup that
    // fails. The popup route is the one measured working on a real device, so
    // it is now the one WebKit gets everywhere.
    //
    // Same engine test the ZIP download uses (results/page.tsx): iOS forces
    // every browser onto WebKit, so the OS is checked directly rather than the
    // UA's browser label, and desktop Chrome/Firefox/Edge — which handle a
    // same-tab download fine and would only be annoyed by a stray tab — are
    // deliberately left out.
    const ua = classifyUserAgent(navigator.userAgent);
    const usePopup = saveBlocked || ua.os_family === 'ios' || ua.browser_family === 'safari';

    if (usePopup) {
      // window.open must be the very first thing here — it consumes this
      // click's user-activation, same requirement as the ZIP download's popup.
      const popup = window.open('', '_blank');
      if (!popup) {
        // Popup blocked: fall back to the same-tab method. Worse than the
        // popup (may still interrupt the run, the original bug), but
        // strictly better than no way to save at all during this window.
        const sameTabUrl = makeBlobUrl(window);
        downloadInThisTab(sameTabUrl);
        setTimeout(() => URL.revokeObjectURL(sameTabUrl), 30_000);
        setSaved(true);
        return;
      }
      {
        // Give the popup a real document before touching it: on a fresh
        // about:blank `document.body` is not guaranteed to exist yet, and the
        // viewport meta is what keeps Safari from laying the page out at
        // desktop width and shrinking it (same fix as the ZIP popup's).
        try {
          popup.document.write(
            '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>'
          );
          popup.document.close();
        } catch {
          /* already navigated or closed — the appendChild below will tell us */
        }
        const url = makeBlobUrl(popup);
        const a = popup.document.createElement('a');
        a.href = url;
        a.download = filename;
        popup.document.body.appendChild(a);
        a.click();
        // Revoked through the realm that created it, and only once the
        // download has had time to start reading.
        const U = (popup as Window & { URL?: typeof URL }).URL ?? URL;
        setTimeout(() => {
          try {
            U.revokeObjectURL(url);
          } catch {
            /* popup gone — the URL died with its document anyway */
          }
        }, 30_000);
        // Painted AFTER the click, same order as the ZIP popup and for the
        // same reason: a download does not unload the document it happens
        // in, so this replaces the blank page left behind rather than racing it.
        popup.document.title = filename;
        popup.document.body.innerHTML = `<div style="font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:60px 24px;">
          <div style="font-size:48px;margin-bottom:16px;">📄</div>
          <p style="font-size:18px;line-height:1.5;color:#3f3f46;margin:0 0 24px;">${t('confirmationPopupReady')}</p>
          <button onclick="window.close()" style="padding:14px 32px;border-radius:999px;border:none;background:#4f46e5;color:#fff;font-size:16px;font-weight:600;">${t('confirmationPopupClose')}</button>
        </div>`;
      }
    } else {
      const url = makeBlobUrl(window);
      downloadInThisTab(url);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }

    setSaved(true);
  };

  // Two reasons for the same new tab, and only one of them is about the
  // analysis. Saying "so your running analysis isn't interrupted" on /results,
  // where nothing is running, would just be wrong.
  const popupHint = saveBlocked ? t('confirmationSaveNewTab') : t('confirmationSaveNewTabPlain');

  const downloadInThisTab = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-base leading-none">
          📄
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{t('confirmationTitle')}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{t('confirmationBody')}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              title={saveBlocked || isWebKit ? popupHint : undefined}
              className="rounded-full px-4 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {saved ? t('confirmationSaved') : t('confirmationSave')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              {open ? t('confirmationHide') : t('confirmationShow')}
            </button>
          </div>

          {/* Explains why the button behaves differently (a new tab, not a
              same-tab download) so the popup does not look like a mistake or
              an ad. Shown wherever the popup route is actually taken — which
              since 2026-09-10 is every WebKit browser, not only mid-analysis. */}
          {(saveBlocked || isWebKit) && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{popupHint}</p>
          )}

          {open && (
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3 text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
              {text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
