'use client';

import { useEffect } from 'react';

/**
 * Ask before a reload or tab close throws away loaded photos.
 *
 * Photos live only in this tab's memory (usePhotoStore / useUpload) — nothing
 * is stored on a server or on disk. A reload therefore ends the run, and on
 * 2026-11-13 an error message that advised exactly that ("reload the page")
 * cost a tester a 298-photo upload. While `active`, the browser shows its own
 * "leave site?" prompt; the wording is the browser's, not ours, and browsers
 * may skip it when the user never interacted with the page.
 *
 * Covers hard navigations only (reload, close, typed URL). In-app links are
 * client-side navigations, keep the store, and do not trigger it — on purpose.
 * Mobile Safari largely ignores `beforeunload` (unverified general knowledge),
 * so this is a safety net on desktop, not a guarantee everywhere.
 */
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers only show the prompt when returnValue is set.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);
}
