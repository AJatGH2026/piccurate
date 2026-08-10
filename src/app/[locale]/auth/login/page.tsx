'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = params.locale as string;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<'ok' | 'error' | 'reset' | null>(null);

  // Read the flag set by the /auth/callback redirect, or by /auth/reset-password
  // once a new password has been saved. We use window.location instead of
  // useSearchParams so the page doesn't require a Suspense boundary (keeps it
  // statically renderable).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('confirmed')) setConfirmMsg('ok');
    else if (sp.get('password_reset')) setConfirmMsg('reset');
    else if (sp.get('confirm_error')) setConfirmMsg('error');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    } else {
      router.push(`/${locale}`);
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">
            {brandName(locale)}
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t('login')}
          </h1>
        </div>

        {confirmMsg === 'ok' && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-400">
            {t('confirmedBanner')}
          </div>
        )}
        {confirmMsg === 'reset' && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-400">
            {t('passwordResetBanner')}
          </div>
        )}
        {confirmMsg === 'error' && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-700 text-sm dark:bg-amber-900/20 dark:text-amber-400">
            {t('confirmErrorBanner')}
          </div>
        )}

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('loginCta')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link
            href={`/${locale}/auth/forgot-password`}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            {t('forgotLink')}
          </Link>
        </p>

        <p className="mt-3 text-center text-sm text-zinc-500">
          {t('noAccount')}{' '}
          <Link href={`/${locale}/auth/register`} className="text-indigo-600 hover:text-indigo-700 font-medium">
            {t('registerCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}
