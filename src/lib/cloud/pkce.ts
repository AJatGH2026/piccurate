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

/** Opens authUrl in a popup; resolves with the authorization code once the
 *  callback posts it back (matching state). Rejects on mismatch, error, or close. */
export function popupOAuth(authUrl: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'piccurate-oauth', 'width=520,height=660');
    if (!popup) {
      reject(new Error('Popup blocked — please allow popups and try again.'));
      return;
    }
    let settled = false;
    const cleanup = () => {
      settled = true;
      window.removeEventListener('message', onMsg);
      clearInterval(timer);
      try { popup.close(); } catch { /* ignore */ }
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
      if (popup.closed && !settled) { cleanup(); reject(new Error('Authentication cancelled.')); }
    }, 500);
    window.addEventListener('message', onMsg);
  });
}
