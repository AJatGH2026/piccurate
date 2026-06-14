'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = params.locale as string;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gdprConsent) {
      setError('Please accept the terms and privacy policy to continue.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // In production: call Supabase auth.signUp with metadata { locale, gdpr_consent_at }
      alert(`Registration would happen here for: ${email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href={`/${locale}`} className="text-2xl font-bold text-indigo-600">
            PicCurate
          </Link>
          <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {t('register')}
          </h1>
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
              minLength={8}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              placeholder="Min. 8 characters"
            />
          </div>

          {/* GDPR Consent */}
          <div className="flex items-start gap-2">
            <input
              id="gdpr"
              type="checkbox"
              checked={gdprConsent}
              onChange={(e) => setGdprConsent(e.target.checked)}
              className="mt-1 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="gdpr" className="text-xs text-zinc-500 leading-relaxed">
              I agree to the{' '}
              <Link href={`/${locale}/terms`} className="text-indigo-600 underline" target="_blank">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href={`/${locale}/privacy`} className="text-indigo-600 underline" target="_blank">
                Privacy Policy
              </Link>
              . My photos will be processed by AI for curation purposes. I can delete my data at any time.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !gdprConsent}
            className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? '...' : t('registerCta')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t('hasAccount')}{' '}
          <Link href={`/${locale}/auth/login`} className="text-indigo-600 hover:text-indigo-700 font-medium">
            {t('loginCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}
