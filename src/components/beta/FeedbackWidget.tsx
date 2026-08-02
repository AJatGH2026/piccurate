'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname } from 'next/navigation';
import { submitFeedback } from '@/lib/beta-client';

/**
 * Small floating feedback button (bottom-left). Opens a panel with a textarea.
 * Posts to /api/beta; a no-op server-side without Upstash, but the UI still
 * thanks the user. Global (rendered in the locale layout).
 */
export function FeedbackWidget() {
  const t = useTranslations('feedback');
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || 'de';
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    // Hide inside the legal modal iframe (configure page) — it would overlap the
    // modal and doesn't belong on the AGB view.
    setEmbedded(typeof window !== 'undefined' && window.self !== window.top);
  }, []);

  const send = async () => {
    if (!msg.trim()) return;
    setSending(true);
    setFailed(false);
    // Report the actual result. Thanking the user unconditionally hid a broken
    // backend for weeks — and it also throws away text the user cannot recover,
    // so on failure the message stays in the box for a retry.
    const ok = await submitFeedback(msg, locale, pathname || '');
    setSending(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setDone(true);
    setMsg('');
    setTimeout(() => {
      setDone(false);
      setOpen(false);
    }, 1800);
  };

  if (embedded) return null;

  return (
    <div className="fixed bottom-4 left-4 z-40 print:hidden">
      {open ? (
        <div className="w-72 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t('title')}</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm"
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
          {done ? (
            <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{t('thanks')}</p>
          ) : (
            <>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder={t('placeholder')}
                rows={4}
                maxLength={2000}
                className="mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
              <button
                onClick={send}
                disabled={sending || !msg.trim()}
                className="mt-2 w-full rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? t('sending') : t('submit')}
              </button>
              {failed && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('error')}</p>
              )}
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-zinc-900/85 dark:bg-zinc-100/90 text-white dark:text-zinc-900 px-4 py-2 text-sm font-medium shadow-lg hover:bg-zinc-900 dark:hover:bg-white transition-colors"
        >
          {t('button')}
        </button>
      )}
    </div>
  );
}
