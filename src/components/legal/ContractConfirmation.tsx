'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
   * Route the save through a popup window instead of a same-tab download.
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

  const save = () => {
    // A Blob URL rather than a data: URI — Safari refuses to download the
    // latter from a link with a filename, which is the same trap the ZIP
    // download hit on iOS (see the popup note in the results page).
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));

    if (saveBlocked) {
      // window.open must be the very first thing here — it consumes this
      // click's user-activation, same requirement as the ZIP download's
      // popup. Anything opened later (after the URL.createObjectURL above,
      // which is synchronous, is fine) would risk losing it.
      const popup = window.open('', '_blank');
      if (!popup) {
        // Popup blocked: fall back to the same-tab method. Worse than the
        // popup (may still interrupt the run, the original bug), but
        // strictly better than no way to save at all during this window.
        downloadInThisTab(url);
      } else {
        const a = popup.document.createElement('a');
        a.href = url;
        a.download = filename;
        popup.document.body.appendChild(a);
        a.click();
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
      downloadInThisTab(url);
    }

    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setSaved(true);
  };

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
              title={saveBlocked ? t('confirmationSaveNewTab') : undefined}
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

          {/* The button works during analysis too now — this just explains
              why it behaves differently (a new tab, not a same-tab download)
              so the popup doesn't look like a mistake or an ad. */}
          {saveBlocked && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {t('confirmationSaveNewTab')}
            </p>
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
