'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { classifyUserAgent } from '@/lib/userAgent';
import {
  buildContractConfirmation,
  confirmationFilename,
  freeTierLabel,
  paidTierLabel,
  type ContractConfirmation as ContractData,
} from '@/lib/contract-confirmation';

// Stable identities, defined once at module scope — useSyncExternalStore
// re-subscribes whenever `subscribe` changes identity, so these must not be
// inline arrows.
const subscribeNever = () => () => {};
const serverSnapshot = () => false;
const webkitSnapshot = () => {
  const ua = classifyUserAgent(navigator.userAgent);
  // iOS forces every browser onto WebKit, so the OS is checked directly rather
  // than trusting the UA's browser label — same test the ZIP download in
  // app/[locale]/app/results/page.tsx uses, and for the same reason.
  return ua.os_family === 'ios' || ua.browser_family === 'safari';
};

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
   * An analysis is running in this tab right now, so send the download to a
   * new tab whatever the browser is (see `newTab` below).
   *
   * Reported 2026-08-29: saving during the analysis on iOS killed the run after
   * 100 of 249 photos with "Load failed" — Safari treated the download as
   * leaving the page, which aborts every in-flight analyze-demo fetch. First
   * fix (2026-08-29) was disabling the button until the run ended — technically
   * safe, but § 312f Abs. 2 wants this confirmation available *before*
   * performance begins, i.e. exactly during the window it was disabled in, and
   * the page navigates on to /review within moments of the run ending, so
   * there was no practical window left to use it (flagged 2026-09-01).
   *
   * The name is historical: this used to select a whole different save
   * mechanism (a popup with a blob URL built inside it). Since 2026-09-10 the
   * download is a plain link to a same-origin attachment URL and the only
   * thing left to decide is its target.
   */
  saveBlocked?: boolean;
}) {
  const t = useTranslations('legal');
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  // Is this a WebKit browser? Read through useSyncExternalStore rather than an
  // effect: the value never changes, but the server has no way to know it, and
  // this is the hook that is allowed to answer a client-only question with a
  // different server snapshot — no setState-in-effect, no hydration mismatch.
  // The subscribe callback is a no-op because there is nothing to subscribe to.
  const isWebKit = useSyncExternalStore(subscribeNever, webkitSnapshot, serverSnapshot);

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
   * Where the file actually comes from: a same-origin URL that answers with
   * `Content-Disposition: attachment` (see app/api/contract-confirmation).
   *
   * There is no blob here any more, and that is the fix. Three rounds on
   * 2026-09-10 against a real iPhone established that iOS does not treat
   * `<a download>` on a blob URL as a save at all — it navigates a context to
   * the URL, and a blob URL is a lifetime-bound handle into one document's
   * registry. So the failure kept moving instead of going away: cross-realm
   * lookup failed, then the popup showed iOS's document-preview page instead
   * of saving, then a reload of that page hit the revoked handle and brought
   * "WebKitBlobResource-Fehler 1" back.
   *
   * A real URL has none of those properties. iOS's own download manager takes
   * it, the file lands in Files under its real name, and a reload simply
   * re-fetches it. The text is built from the same lib on both sides, so what
   * downloads is byte-identical to what the <pre> below shows.
   */
  const downloadUrl = useMemo(() => {
    const p = new URLSearchParams({
      job: jobId,
      tier,
      limit: String(photoLimit),
      at: new Date(placedAt).toISOString(),
      locale,
    });
    return `/api/contract-confirmation?${p.toString()}`;
  }, [jobId, tier, photoLimit, placedAt, locale]);

  /**
   * Open the download in a new tab rather than this one.
   *
   * Two independent reasons, either of which is enough:
   *  - `saveBlocked`: the analysis is running. Reported 2026-08-29, a same-tab
   *    download aborted every in-flight analyze-demo fetch on iOS. An
   *    attachment response should not count as leaving the page, but this is
   *    exactly the area where iOS did not behave as specified, so the tab that
   *    owns the fetches stays out of it.
   *  - WebKit generally: every download trouble reported on this button came
   *    from an iPhone. Same engine test the ZIP download uses in
   *    results/page.tsx — iOS forces every browser onto WebKit, so the OS is
   *    checked directly rather than the UA's browser label.
   *
   * Desktop Chrome/Firefox/Edge and Android keep the plain same-tab download:
   * they never had the problem, and a stray tab is a cost with no benefit.
   */
  const newTab = saveBlocked || isWebKit;

  // Two reasons for the same new tab, and only one of them is about the
  // analysis. Saying "so your running analysis isn't interrupted" on /results,
  // where nothing is running, would just be wrong.
  const popupHint = saveBlocked ? t('confirmationSaveNewTab') : t('confirmationSaveNewTabPlain');

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
            {/* A real <a href>, not a button with a click handler. The
                browser's own download machinery is the part that works on
                every platform; there is nothing left here for JavaScript to
                get wrong. `download` only supplies the filename — the
                Content-Disposition header on the response is authoritative. */}
            <a
              href={downloadUrl}
              download={filename}
              target={newTab ? '_blank' : undefined}
              rel="noopener"
              onClick={() => setSaved(true)}
              title={newTab ? popupHint : undefined}
              className="rounded-full px-4 py-1.5 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              {saved ? t('confirmationSaved') : t('confirmationSave')}
            </a>
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
          {newTab && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{popupHint}</p>}

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
