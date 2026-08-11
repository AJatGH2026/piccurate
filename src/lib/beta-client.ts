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
