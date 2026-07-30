'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "← Zurück" / "← Back" button for the standalone legal pages. Goes back in
 * history when there is one, else to the locale home page.
 *
 * Renders nothing when the page is shown inside an iframe (the legal modal on
 * the configure page): there the modal's own ✕ closes it (back to configure,
 * upload intact), and a back button inside the frame would navigate the parent
 * to the upload page and lose the in-progress photos.
 */
export function BackButton({ locale }: { locale: string }) {
  const router = useRouter();
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    setEmbedded(typeof window !== 'undefined' && window.self !== window.top);
  }, []);
  if (embedded) return null;

  const label = locale === 'de' ? '← Zurück' : '← Back';
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push(`/${locale}`);
      }}
      className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
    >
      {label}
    </button>
  );
}
