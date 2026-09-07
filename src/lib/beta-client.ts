// Client-side helpers for beta signals. Fire-and-forget; never throw.

/** Log a funnel/selection event. Uses sendBeacon so it survives navigation. */
export function logBeta(step: string, extra?: Record<string, unknown>): void {
  try {
    const body = JSON.stringify({ type: 'event', step, ...extra });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/beta', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/beta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/**
 * Like logBeta, but at most once per browser tab session. `review` and
 * `terms_accepted` used to fire on every /review mount and every "Jetzt
 * analysieren"-click respectively — including the no-new-API-call path where
 * criteria change but no photo needs re-analysis (configure/page.tsx's
 * `rerunSelection` branch) and the plain "← Zurück" link from results back to
 * review. That inflated both counters past `analysis` (which only counts
 * completed Gemini calls), even though every individual click/mount was
 * "real" — found 2026-09-07 when the admin dashboard showed review (143) and
 * terms_accepted (124) both above analysis (88) in the same 7-day window.
 * sessionStorage (not a ref) because each step lives in a different route
 * component that unmounts on navigation — a ref would reset right along with
 * it.
 */
export function logBetaOnce(step: string, extra?: Record<string, unknown>): void {
  try {
    const key = `sb-beta-once:${step}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
    logBeta(step, extra);
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
  } catch {
    logBeta(step, extra);
  }
}

/**
 * The bot signals from `useBotSignals()`, passed straight through to the API.
 * Optional so a caller without a form (there is none today) still compiles —
 * the server treats absent signals as neutral either way.
 */
export type BotSignals = { website: string; elapsedMs: number };

export async function submitFeedback(
  message: string,
  locale: string,
  path: string,
  bot?: BotSignals
): Promise<boolean> {
  try {
    const r = await fetch('/api/beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'feedback', message, locale, path, ...bot }),
    });
    const j = (await r.json()) as { ok?: boolean };
    return !!j.ok;
  } catch {
    return false;
  }
}

export async function submitEmail(email: string, locale: string, bot?: BotSignals): Promise<boolean> {
  try {
    const r = await fetch('/api/beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', email, locale, ...bot }),
    });
    const j = (await r.json()) as { ok?: boolean };
    return !!j.ok;
  } catch {
    return false;
  }
}
