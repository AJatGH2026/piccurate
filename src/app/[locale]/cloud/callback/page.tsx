'use client';

import { useEffect, useState } from 'react';

// OAuth redirect target. Runs inside the popup: reads ?code&state, posts them to
// the opener window, then closes. No UI to speak of — purely a machine handoff.
export default function CloudCallbackPage() {
  const [msg, setMsg] = useState('Verbinde…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error_description') || params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { source: 'piccurate-oauth', code, state, error },
        window.location.origin
      );
      setMsg('Fertig. Dieses Fenster kann geschlossen werden.');
      setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 300);
    } else {
      setMsg('Kein Hauptfenster gefunden. Bitte dieses Fenster schließen und erneut versuchen.');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-300 text-sm">
      {msg}
    </div>
  );
}
