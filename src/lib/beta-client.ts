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

export async function submitFeedback(message: string, locale: string, path: string): Promise<boolean> {
  try {
    const r = await fetch('/api/beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'feedback', message, locale, path }),
    });
    const j = (await r.json()) as { ok?: boolean };
    return !!j.ok;
  } catch {
    return false;
  }
}

export async function submitEmail(email: string, locale: string): Promise<boolean> {
  try {
    const r = await fetch('/api/beta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', email, locale }),
    });
    const j = (await r.json()) as { ok?: boolean };
    return !!j.ok;
  } catch {
    return false;
  }
}
