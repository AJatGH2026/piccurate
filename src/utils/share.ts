// Handing a file to the user from an installed (standalone) PWA.
//
// Why this exists at all: on 2026-09-10 a download that failed on an iPhone was
// chased through four rounds of blob-URL fixes before the actual variable
// turned out to be the SURFACE, not the code. Every failing test came from the
// installed app (public/manifest-de.json, `display: standalone`), every working
// one from Safari. In an iOS standalone PWA:
//
//   - `<a download>` is not treated as a save,
//   - links open in an in-app browser view instead of a real tab,
//   - and a blob URL does not survive the jump into that view.
//
// The Web Share API is the way out. `navigator.share({ files })` hands the File
// straight to the native share sheet ("In Dateien sichern"), with no URL, no
// blob handle and no second browsing context anywhere in the path.
//
// NOTE for whoever touches this next: none of it is verifiable outside a real
// iOS device with the app installed. Chromium reports canShare(files) true and
// behaves nothing like iOS, so a green test in a desktop browser proves only
// that the code runs — never that the platform does what we want.

/**
 * Is this page running as an installed app rather than in a browser tab?
 *
 * Two checks because iOS predates the standard one: `navigator.standalone` is
 * Apple's own flag for a home-screen web app, `display-mode: standalone` is the
 * spec'd media query everyone else implements.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const iosFlag = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches === true;
  return iosFlag || mq;
}

/** Can this browser share THIS file? Both the API and the file type can say no. */
export function canShareFile(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

/**
 * Offer `file` through the native share sheet.
 *
 * MUST be called inside a user gesture — `navigator.share` requires transient
 * activation, and on iOS that activation does not survive an `await` on
 * anything slow (building a ZIP, reading originals). Callers with async work to
 * do have to finish it first and let the user tap a second time; that second
 * tap is a fresh gesture. See the two-step flow in the results page.
 *
 * 'cancelled' is a normal outcome, not an error: the user dismissed the sheet.
 * It is reported separately so callers do not show a failure message for it.
 */
export async function shareFile(file: File, title?: string): Promise<ShareOutcome> {
  if (!canShareFile(file)) return 'unsupported';
  try {
    await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
      files: [file],
      ...(title ? { title } : {}),
    });
    return 'shared';
  } catch (err) {
    // AbortError is the user closing the sheet. Everything else is a real
    // failure and the caller should fall back to whatever it did before.
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    console.warn('[share] navigator.share failed:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}
