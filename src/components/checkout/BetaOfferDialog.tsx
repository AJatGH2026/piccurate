'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * What a click on a paid tier does during the beta: no checkout, an offer.
 *
 * Selling is switched off — there is no Stripe account yet, and until the
 * paid-contract points from the Pruefauftrag are settled it should stay off.
 * Rather than a dead "not available" label, the click becomes the thing we
 * most want to know: which tier people reach for, and why.
 *
 * The tester gets that tier's photo allowance once, free. Feedback is asked for
 * but never required — an allowance handed out in exchange for an answer buys
 * the answer the tester thinks we want.
 */
export function BetaOfferDialog({
  tier,
  tierLabel,
  photoLimit,
  locale,
  photoCount,
  onClose,
}: {
  tier: 'small' | 'medium' | 'large';
  tierLabel: string;
  photoLimit: number;
  locale: string;
  /** Photos the visitor already has loaded, if any — measurement only. */
  photoCount?: number;
  onClose: () => void;
}) {
  const t = useTranslations('betaOffer');
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'needsAccount'>(
    'idle'
  );
  const [granted, setGranted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Where sign-in/sign-up should return to. Carries the tier so the offer
  // reopens on the way back instead of leaving the tester on a page that looks
  // untouched.
  const returnPath = encodeURIComponent(`/${locale}/app/pricing?offer=${tier}`);

  const submit = async () => {
    setState('sending');
    setError(null);
    try {
      // A grant needs a permanent account, for the same reason a purchase would:
      // an anonymous session dies with the browser profile and takes the
      // allowance with it.
      //
      // Note that an anonymous session counts as "no account" here even though
      // the visitor is technically signed in — starting an analysis mints one
      // silently, so someone who already registered can still land in this
      // branch on a browser that never signed in. Teleporting them straight to
      // the sign-up form was the confusing part: they have an account, they
      // just need to use it. So we say what is needed and offer both doors.
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        setState('needsAccount');
        return;
      }

      const res = await fetch('/api/beta/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, locale, feedback, photoCount }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        // Already has one. Not a failure worth an error screen — tell them what
        // they hold and let them get on with it.
        setGranted(typeof data.photos === 'number' ? data.photos : null);
        setState('done');
        return;
      }
      if (!res.ok) {
        setError(data.error === 'rate_limited' ? t('errorRateLimited') : t('errorGeneric'));
        setState('error');
        return;
      }
      setGranted(data.photos ?? photoLimit);
      setState('done');
    } catch {
      setError(t('errorGeneric'));
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        {state === 'needsAccount' ? (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('accountTitle')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t('accountBody', { photos: photoLimit.toLocaleString(locale) })}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => router.push(`/${locale}/auth/login?next=${returnPath}`)}
                className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {t('accountLogin')}
              </button>
              <button
                onClick={() => router.push(`/${locale}/auth/register?next=${returnPath}`)}
                className="w-full rounded-full border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t('accountRegister')}
              </button>
              <button
                onClick={onClose}
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {t('cancel')}
              </button>
            </div>
          </>
        ) : state === 'done' ? (
          <>
            <div className="text-3xl mb-3">🎁</div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('doneTitle')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t('doneBody', { photos: (granted ?? photoLimit).toLocaleString(locale) })}
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {t('doneCta')}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('title')}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t('body', { tier: tierLabel, photos: photoLimit.toLocaleString(locale) })}
            </p>

            <label
              htmlFor="beta-feedback"
              className="mt-5 block text-sm font-medium text-zinc-800 dark:text-zinc-200"
            >
              {t('feedbackLabel')}
            </label>
            <textarea
              id="beta-feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={2000}
              placeholder={t('feedbackPlaceholder')}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <p className="mt-1 text-xs text-zinc-500">{t('feedbackOptional')}</p>

            {error && (
              <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-full border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={submit}
                disabled={state === 'sending'}
                className="flex-1 rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {state === 'sending' ? t('sending') : t('cta')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
