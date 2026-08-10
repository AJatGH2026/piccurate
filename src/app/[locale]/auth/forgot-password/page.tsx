'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clientConfig } from '@/lib/config';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = params.locale as string;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const appUrl = clientConfig.appUrl;

    // Same enumeration line as registration: Supabase answers /recover with a
    // success even for an address it has never seen, so we never learn — and
    // therefore can never leak — whether an account exists. Keep the success
    // text below conditional ("if there is an account…") for that reason.
    //
    // An error here is consequently NOT "no such user"; it is a real problem
    // (rate limit, malformed address, network), so showing it reveals nothing
    // and helps the person in front of the screen.
    //
    // The link lands on /auth/reset-password, deliberately NOT on the shared
    // /auth/callback route — see the note at the top of that page.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/${locale}/auth/reset-password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
    } else {
      setEmailSent(true);
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-sm text-center">
          <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">
            {brandName(locale)}
          </Link>
          <div className="mt-8 p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-800">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {t('resetSentTitle')}
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              {t('resetSentDesc', { email })}
            </p>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            <Link href={`/${locale}/auth/login`} className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('backToLogin')}
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
            {t('forgotTitle')}
          </h1>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed">{t('forgotIntro')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('forgotCta')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href={`/${locale}/auth/login`} className="text-indigo-600 hover:text-indigo-700 font-medium">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
