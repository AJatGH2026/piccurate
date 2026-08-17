'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trackEv } from '@/lib/events-client';

const PROVIDERS = ['google_photos', 'onedrive', 'icloud'] as const;
type Provider = (typeof PROVIDERS)[number];

const LABEL_KEY: Record<Provider, 'cloudSourceGooglePhotos' | 'cloudSourceOneDrive' | 'cloudSourceICloud'> = {
  google_photos: 'cloudSourceGooglePhotos',
  onedrive: 'cloudSourceOneDrive',
  icloud: 'cloudSourceICloud',
};

/**
 * Honest placeholder for the three cloud sources that do not exist yet
 * (Event-Spezifikation §4, `cloud_intent_click`). No fake functionality, no
 * form — just a demand signal: does anyone actually ask for this before we
 * spend engineering time building it. Dropbox is real (DropboxImport.tsx,
 * rendered next to this) and deliberately not listed here.
 */
export function CloudIntentPlaceholder({ locale }: { locale: string }) {
  const t = useTranslations('upload');
  const [expanded, setExpanded] = useState(false);
  const [acked, setAcked] = useState<Provider | null>(null);

  const handleClick = (provider: Provider) => {
    trackEv('cloud_intent_click', locale, { provider });
    setAcked(provider);
  };

  return (
    <div className="mt-2">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline"
        >
          {t('moreCloudSources')}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleClick(p)}
              disabled={acked === p}
              title={t('cloudIntentComingSoon')}
              className="rounded-full border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-60 transition-colors"
            >
              {t(LABEL_KEY[p])}
            </button>
          ))}
          {acked && <span className="text-xs text-indigo-600 dark:text-indigo-400">{t('cloudIntentThanks')}</span>}
        </div>
      )}
    </div>
  );
}
