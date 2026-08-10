'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Landing page for the password-reset link.
 *
 * Why this is NOT the shared /auth/callback route: that route deliberately
 * refuses to turn a mail link into a session, because Supabase confirms the
 * address at its own /auth/v1/verify endpoint before redirecting, so a
 * corporate link-scanner (Microsoft Safe Links, Proofpoint URL Defense, …) that
 * merely fetches the link would otherwise get logged in. Setting a new password
 * genuinely needs a session, so the two flows cannot share a landing.
 *
 * What makes a session safe here is PKCE. `resetPasswordForEmail` stores a code
 * verifier in this browser and sends only the challenge to Supabase; the link
 * comes back with `?code=…`, which is worthless without that verifier. A
 * scanner fetching the link therefore cannot obtain a session — only the
 * browser that asked for the reset can. (The trade-off is the flip side of the
 * same coin: a link requested on the phone and opened on the laptop will not
 * work either. That is what the "this link no longer works" branch explains.)
 */
type Stage = 'checking' | 'ready' | 'invalid' | 'saving';

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = params.locale as string;
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      // A dead link (expired, or already spent by a link-scanner that fetched
      // it first) comes back as error params. Supabase puts them in the query
      // string for the PKCE flow and in the hash for the implicit one, so read
      // both. Like the login page we use window.location rather than
      // useSearchParams, which would force a Suspense boundary on this route.
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hasError =
        search.get('error') ||
        search.get('error_code') ||
        hash.get('error') ||
        hash.get('error_code');
      if (hasError) {
        if (active) setStage('invalid');
        return;
      }

      // Creating the browser client is what completes the recovery: it finds
      // the `?code=` in the URL, trades it for a session using the stored
      // verifier, and strips the code from the address bar. getSession() waits
      // for that exchange before it answers, so a session here means the link
      // was good — and no session means it was not.
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setStage(data.session ? 'ready' : 'invalid');
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordRepeat) {
      setError(t('resetMismatch'));
      return;
    }
    setStage('saving');
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStage('ready');
      return;
    }

    // Sign out and send them to the login page. The global scope revokes every
    // other session on the account, which is the whole point of a reset if
    // somebody else had got in — and it keeps this app's rule that you enter by
    // typing your password, never by clicking a mail link.
    //
    // A full page load rather than router.push: the auth cookies were just
    // cleared, and the login page reads its banner flag from window.location on
    // mount, so a hard navigation gets both right without a race.
    await supabase.auth.signOut();
    window.location.assign(`/${locale}/auth/login?password_reset=1`);
  };

  if (stage === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <p className="text-sm text-zinc-500">{t('resetChecking')}</p>
      </div>
    );
  }

  if (stage === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">
            {brandName(locale)}
          </Link>
          <div className="mt-8 p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-800">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t('resetInvalidTitle')}
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed">{t('resetInvalidDesc')}</p>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            <Link
              href={`/${locale}/auth/forgot-password`}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {t('resetRequestNew')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">
            {brandName(locale)}
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t('resetTitle')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('newPassword')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder={t('passwordMinHint')}
            />
          </div>

          <div>
            <label
              htmlFor="password-repeat"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
            >
              {t('repeatPassword')}
            </label>
            <input
              id="password-repeat"
              type="password"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={stage === 'saving'}
            className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {stage === 'saving' ? '...' : t('resetCta')}
          </button>
        </form>
      </div>
    </div>
  );
}
