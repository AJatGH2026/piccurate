'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { googleTagEnabled, getStoredConsent, setConsent, applyConsent } from '@/lib/analytics';

/**
 * Cookie-consent banner for the Google tag. Dormant (renders nothing) unless a
 * tag id is configured. Shows once when no choice is stored; on return visits it
 * silently re-applies the stored choice to Consent Mode.
 */
export function ConsentBanner() {
  const t = useTranslations('consent');
  const params = useParams();
  const locale = (params?.locale as string) || 'de';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!googleTagEnabled()) return;
    const stored = getStoredConsent();
    if (stored) {
      // Returning visitor: re-apply their choice once gtag is up.
      applyConsent(stored === 'granted');
    } else {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const choose = (granted: boolean) => {
    setConsent(granted ? 'granted' : 'denied');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-300 flex-1">
          {t('text')}{' '}
          <Link href={`/${locale}/privacy`} className="underline hover:text-indigo-600">
            {t('privacy')}
          </Link>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => choose(false)}
            className="rounded-full border border-zinc-300 dark:border-zinc-600 px-4 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t('decline')}
          </button>
          <button
            onClick={() => choose(true)}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
