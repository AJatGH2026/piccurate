'use client';

import { useEffect } from 'react';

// Keep the screen on while long work runs in this page (upload preparation,
// analysis). Added 2026-11-22: on phones the operating system freezes a web
// page as soon as it is not visible, so a locked screen stopped the upload and
// the analysis just like switching to another app. The wake lock prevents the
// automatic screen lock; it cannot (and does not try to) keep the page running
// in the background — the hint on the page says so.
//
// The browser releases the lock by itself whenever the page is hidden, so it
// is requested again each time the page becomes visible while `active` holds.
// Failures (unsupported browser, power-saving mode, denied) are silent: the
// work runs the same, only the screen may lock.

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

interface NavigatorWithWakeLock {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined' || typeof navigator === 'undefined') return;
    const api = (navigator as unknown as NavigatorWithWakeLock).wakeLock;
    if (!api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (sentinel && !sentinel.released) return;
      try {
        const s = await api.request('screen');
        if (cancelled) {
          void s.release().catch(() => {});
          return;
        }
        sentinel = s;
      } catch {
        // Not allowed right now (e.g. battery saver) — nothing to do.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
      sentinel = null;
    };
  }, [active]);
}
