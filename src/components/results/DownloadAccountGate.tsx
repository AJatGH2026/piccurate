'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Honeypot, useBotSignals } from '@/components/forms/Honeypot';

/**
 * The account gate in front of the ZIP download.
 *
 * It sits here, and not on the upload page, since 2026-08-27: analysing and
 * seeing the result are the free service in full (terms § 3), and asking for
 * an address before any of that had been shown was what campaign traffic died
 * on — 12 visitors reached the old gate, none registered.
 *
 * **Everything happens in this tab, on purpose.** `usePhotoStore` is plain
 * in-memory Zustand with no persistence, so sending someone to /auth/register
 * would destroy the very result they are trying to download. So: no
 * navigation, no redirect, no email round-trip in between.
 *
 * Registering converts the ANONYMOUS auth user that already exists (created
 * when the analysis started) into a permanent one via `updateUser`. That keeps
 * the same `user.id`, so the job stays attached without any claim mechanism —
 * and the confirmation link never has to establish a session, which is what
 * /auth/callback deliberately refuses to do because corporate mail scanners
 * click it.
 *
 * The download is released as soon as an address has been given. Waiting for
 * the confirmation click would mean a trip to another tab and back, and a
 * confirmed address is not what makes this lawful — the address serves to
 * operate the account, and that is true the moment it is entered.
 */
export function DownloadAccountGate({
  locale,
  onClose,
  onUnlocked,
}: {
  locale: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const t = useTranslations('results');
  const ta = useTranslations('auth');
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { website, setWebsite, signals } = useBotSignals();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw new Error(err.message);
      } else {
        // Bot signals are checked here rather than posted to /api/auth/register:
        // that route creates a NEW user, which would orphan the anonymous one
        // this result belongs to. Same filter, applied in place.
        const { website: hp, elapsedMs } = signals();
        if (hp.trim() || elapsedMs < 2500) throw new Error(ta('registerFailed'));
        const { error: err } = await supabase.auth.updateUser({
          email,
          password,
          data: { locale, gdpr_consent_at: new Date().toISOString() },
        });
        if (err) throw new Error(err.message);
      }
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : ta('registerFailed'));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('downloadGateTitle')}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('downloadGateBody')}</p>
        {/* Says the result is safe. Without it, leaving the dialog looks like
            it might cost the analysis — which is exactly what it would have
            done had this been a redirect. */}
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t('downloadGateKeepsResult')}</p>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <Honeypot id="dl-website" value={website} onChange={setWebsite} />
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={ta('email')}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={ta('passwordMinHint')}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {busy ? t('downloadGateBusy') : t('downloadGateSubmit')}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setError(null);
            }}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {mode === 'register' ? ta('hasAccount') : ta('noAccount')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {t('downloadGateCancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
