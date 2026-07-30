'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname } from 'next/navigation';
import { submitFeedback } from '@/lib/beta-client';

const FEEDBACK_EMAIL: Record<string, string> = {
  de: 'feedback@auswahlbuddy.de',
  en: 'feedback@shortlistbuddy.com',
};

/**
 * Prominent feedback block on the results page. Same amber treatment as the
 * email capture, so email + feedback read as one "we'd love to hear from you"
 * unit. Offers both a mailto link and an inline comment field. Posts to
 * /api/beta, which forwards to the feedback inbox (Resend) — see src/lib/email.
 */
export function ResultsFeedback() {
  const t = useTranslations('resultsFeedback');
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || 'de';
  const email = FEEDBACK_EMAIL[locale] ?? FEEDBACK_EMAIL.en;
  const [msg, setMsg] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const send = async () => {
    if (!msg.trim()) return;
    setState('sending');
    const ok = await submitFeedback(msg, locale, pathname || '');
    setState(ok ? 'done' : 'error');
    if (ok) setMsg('');
  };

  return (
    <div className="mt-6 rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('title')}</h2>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{t('intro')}</p>
      <p className="mt-2 text-sm">
        <a
          href={`mailto:${email}`}
          className="font-medium text-amber-700 dark:text-amber-300 underline hover:text-amber-800"
        >
          {email}
        </a>
      </p>
      {state === 'done' ? (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{t('thanks')}</p>
      ) : (
        <>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={t('placeholder')}
            rows={3}
            maxLength={2000}
            className="mt-3 w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />
          <button
            onClick={send}
            disabled={state === 'sending' || !msg.trim()}
            className="mt-2 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state === 'sending' ? t('sending') : t('submit')}
          </button>
          {state === 'error' && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('error')}</p>
          )}
        </>
      )}
    </div>
  );
}
