'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * Landing for the download gate's confirmation link (see `/auth/callback`'s
 * comment on `source=download-gate`). Deliberately has no login form: the tab
 * that started the download is already polling for the confirmed account and
 * will start the download itself within seconds, so asking for a password
 * here would just be a second, pointless login.
 */
export default function DownloadConfirmedPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = params.locale as string;
  const [hasError, setHasError] = useState(false);

  // window.location instead of useSearchParams, same reason as the login page:
  // keeps this statically renderable without a Suspense boundary.
  useEffect(() => {
    setHasError(new URLSearchParams(window.location.search).get('error') === '1');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm text-center">
        <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">
          {brandName(locale)}
        </Link>
        <div className="mt-8 p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-800">
          <div className="text-4xl mb-4">{hasError ? '⚠️' : '✅'}</div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {hasError ? t('downloadConfirmErrorTitle') : t('downloadConfirmedTitle')}
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            {hasError ? t('downloadConfirmErrorBody') : t('downloadConfirmedBody')}
          </p>
        </div>
        {!hasError && (
          <p className="mt-6 text-sm text-zinc-500 leading-relaxed">
            {t('downloadConfirmedFallback')}{' '}
            <Link href={`/${locale}`} className="text-indigo-600 hover:text-indigo-700 font-medium">
              {brandName(locale)}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
