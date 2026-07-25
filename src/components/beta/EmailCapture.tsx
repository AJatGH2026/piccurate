'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { submitEmail } from '@/lib/beta-client';

/**
 * Optional "notify me about updates" email capture. Shown on the results page
 * after a download. Dismissible; posts to /api/beta (no-op without Upstash).
 */
export function EmailCapture() {
  const t = useTranslations('emailCapture');
  const params = useParams();
  const locale = (params?.locale as string) || 'de';
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || state === 'done') {
    return state === 'done' ? (
      <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{t('thanks')}</p>
    ) : null;
  }

  const send = async () => {
    if (!email.trim()) return;
    setState('sending');
    const ok = await submitEmail(email, locale);
    setState(ok ? 'done' : 'error');
  };

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t('title')}</h3>
        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs"
          aria-label={t('dismiss')}
        >
          ✕
        </button>
      </div>
      <p className="mt-0.5 text-xs text-zinc-500">{t('note')}</p>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('placeholder')}
          className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm"
        />
        <button
          onClick={send}
          disabled={state === 'sending' || !email.trim()}
          className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state === 'sending' ? t('sending') : t('submit')}
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('error')}</p>}
    </div>
  );
}
