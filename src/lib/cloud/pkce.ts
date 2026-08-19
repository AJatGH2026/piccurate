'use client';

// PKCE + popup-based OAuth for public (no-secret) SPA clients. The popup loads the
// provider's consent page, which redirects to our /cloud/callback; that page posts
// the auth code back here via postMessage so the main page (and its in-memory
// photos) is never unloaded.

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomB64(byteLength: number): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return b64url(arr.buffer);
}

export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomB64(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

export function randomState(): string {
  return randomB64(16);
}

/**
 * Opens authUrl in a popup; resolves with the authorization code once the
 * callback posts it back (matching state). Rejects on mismatch, error, or close.
 *
 * `popup`, if passed, must already be open (see the callers in dropbox.ts /
 * onedrive.ts) — reported 2026-08-19: opening it HERE, after the PKCE
 * challenge is computed (an async crypto.subtle.digest) and after the
 * caller's own async file-reading work, put it too many awaits past the
 * original click for mobile browsers to still treat it as gesture-authorised,
 * so window.open returned null ("Popup blocked") even though the user really
 * did just click a button. Passing an already-open window sidesteps that —
 * same fix as the ZIP download's popup in app/results/page.tsx.
 *
 * Target is `_blank`, not a custom name, even in this fallback path —
 * reported a THIRD time 2026-08-19 (still blocked on iPhone Safari after
 * both the synchronous-open fix and dropping the width=/height= features
 * string). The ZIP download's popup — `window.open('', '_blank')`, target
 * `_blank`, no features — is the only one of the two that has ever actually
 * worked on the reporting device, and by this point the target name is the
 * only argument still different between the two calls. `_blank` gives up
 * the one thing a custom name bought (a second click re-focusing the same
 * window instead of opening a new one) — worth it if that is what iOS
 * Safari's popup blocker keys on.
 */
export function popupOAuth(authUrl: string, expectedState: string, popup?: Window | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = popup ?? window.open('', '_blank');
    if (!win) {
      reject(new Error('Popup blocked — please allow popups and try again.'));
      return;
    }
    win.location.href = authUrl;
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener('message', onMsg);
      clearInterval(timer);
      try { win.close(); } catch { /* ignore */ }
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; code?: string; state?: string; error?: string };
      if (!d || d.source !== 'piccurate-oauth') return;
      if (d.state !== expectedState) { cleanup(); reject(new Error('OAuth state mismatch')); return; }
      if (d.error) { cleanup(); reject(new Error(d.error)); return; }
      if (d.code) { cleanup(); resolve(d.code); }
    };
    const timer = setInterval(() => {
      if (win.closed && !settled) { cleanup(); reject(new Error('Authentication cancelled.')); }
    }, 500);
    window.addEventListener('message', onMsg);
  });
}
