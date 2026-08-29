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
   * Suppress the save button while a running analysis would be destroyed by it.
   *
   * Reported 2026-08-29: saving during the analysis on iOS killed the run after
   * 100 of 249 photos with "Load failed" — Safari treats the download of a blob
   * URL as leaving the page, which aborts every in-flight analyze-demo fetch.
   * The panel appears the moment the job exists, i.e. exactly while the analysis
   * it belongs to is running, so the trap is on the normal path, not an edge.
   *
   * The confirmation itself is NOT withheld: the text stays on screen and
   * readable via "show text", and the save returns as soon as the run ends
   * (and again on /results, plus by email once an address exists). Only the
   * click that would destroy the user's own run is deferred.
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
    // Guarded here as well as via the disabled button: this is the call that
    // tears down the page on iOS, so it must not be reachable while an
    // analysis is running, whatever the button state says.
    if (saveBlocked) return;
    // A Blob URL rather than a data: URI — Safari refuses to download the
    // latter from a link with a filename, which is the same trap the ZIP
    // download hit on iOS (see the popup note in the results page).
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setSaved(true);
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
              disabled={saveBlocked}
              title={saveBlocked ? t('confirmationSaveBusy') : undefined}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                saveBlocked
                  ? 'bg-zinc-200 text-zinc-500 cursor-not-allowed dark:bg-zinc-700 dark:text-zinc-400'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
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

          {/* Says why the button is greyed out, and that the text itself is
              still right here — the confirmation is not being withheld. */}
          {saveBlocked && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {t('confirmationSaveBusy')}
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
