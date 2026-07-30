'use client';

import { useRouter } from 'next/navigation';

/**
 * "← Zurück" / "← Back" button for the standalone legal pages. Goes back in
 * history when there is one, otherwise falls back to the locale home page
 * (e.g. when the page was opened directly).
 */
export function BackButton({ locale }: { locale: string }) {
  const router = useRouter();
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
