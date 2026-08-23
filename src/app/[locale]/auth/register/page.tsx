'use client';

import { useTranslations } from 'next-intl';
import { brandName } from '@/lib/brand';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { readNextParam } from '@/lib/auth/next-path';
import { Honeypot, useBotSignals } from '@/components/forms/Honeypot';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const params = useParams();
  const locale = params.locale as string;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  // The invisible half of the bot filter (src/lib/bot-filter.ts): a field no
  // human can reach plus the time spent on the form. Registration was the one
  // public form still bypassing it, because it called Supabase straight from
  // the browser — see the note in /api/auth/register.
  const { website, setWebsite, signals } = useBotSignals();
  // Where to return once the account exists. Read after mount rather than
  // during render: there is no window on the server, and an href that differs
  // between server and client output is a hydration mismatch.
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => setNext(readNextParam(locale)), [locale]);
  const withNext = (path: string) =>
    next && next !== `/${locale}` ? `${path}?next=${encodeURIComponent(next)}` : path;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gdprConsent) {
      setError('Please accept the terms and privacy policy to continue.');
      return;
    }
    setLoading(true);
    setError(null);

    // Goes through our own route rather than calling Supabase directly, so the
    // bot signals below can actually be checked somewhere. The route keeps the
    // sign-up itself unchanged — same `locale`/`gdpr_consent_at` payload, same
    // confirmation redirect, same enumeration protection.
    //
    // Note on the success screen below: signUp does NOT report an error when
    // the address already has a confirmed account. Supabase suppresses it on
    // purpose, so that nobody can test an address list against us to learn who
    // has an account here. (The tell is `data.user.identities === []`, which we
    // deliberately do not act on.)
    //
    // The consequence is that we cannot know whether a mail went out, so the
    // confirmation text must not claim one did — it says "if there is no
    // account yet, a mail is on its way, otherwise just log in". Please keep it
    // conditional: the previous wording promised a mail unconditionally and
    // left people waiting for one that was never sent.
    let res: Response;
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, locale, next, ...signals() }),
      });
    } catch {
      setError(t('registerFailed'));
      setLoading(false);
      return;
    }

    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      // A bot verdict and a throttle are both shown as the generic failure: the
      // filters only work while they are not described, and a person who trips
      // one clears it by simply submitting again.
      const raw = json?.error;
      setError(raw && raw !== 'rejected' && raw !== 'rate_limited' ? raw : t('registerFailed'));
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
              {t('checkEmailTitle')}
            </h1>
            <p className="text-sm text-zinc-500 leading-relaxed">
              {t('checkEmailDesc', { email })}
            </p>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            {t('hasAccount')}{' '}
            <Link href={withNext(`/${locale}/auth/login`)} className="text-indigo-600 hover:text-indigo-700 font-medium">
              {t('loginCta')}
            </Link>
          </p>
          {/* The text above sends anyone who already has an account to the
              login. Without this link, that is a dead end for exactly the
              people who cannot remember their password. */}
          <p className="mt-3 text-sm text-zinc-500">
            <Link
              href={`/${locale}/auth/forgot-password`}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {t('forgotLink')}
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
            {t('register')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Honeypot id="reg-website" value={website} onChange={setWebsite} />
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
              placeholder={t('passwordMinHint')}
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
            {/* Was hardcoded English, so a German visitor was asked to agree to
                a sentence in another language — and the sentence said "I agree
                to the Privacy Policy", which is the confusion privacy § 15 was
                just corrected for: a policy informs under Art. 13, it is not
                consented to. What is recorded is acceptance of the terms and
                acknowledgement of the notice, so that is what it now says. */}
            <label htmlFor="gdpr" className="text-xs text-zinc-500 leading-relaxed">
              {t.rich('gdprConsent', {
                terms: (chunks) => (
                  <Link href={`/${locale}/terms`} className="text-indigo-600 underline" target="_blank">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href={`/${locale}/privacy`} className="text-indigo-600 underline" target="_blank">
                    {chunks}
                  </Link>
                ),
              })}
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
          <Link href={withNext(`/${locale}/auth/login`)} className="text-indigo-600 hover:text-indigo-700 font-medium">
            {t('loginCta')}
          </Link>
        </p>
      </div>
    </div>
  );
}
