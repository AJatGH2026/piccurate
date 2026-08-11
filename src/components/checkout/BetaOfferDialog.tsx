'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PRICING_PLANS } from '@/types/pricing';

/**
 * How many photos a grant is worth.
 *
 * The stored number wins when it is there — what a tester was promised on the
 * day they unlocked must not change because a tier was repriced later. But a
 * row written before that column was populated reports null, and "your Large
 * plan with 0 photos" is worse than a slightly stale figure. The tier is the
 * authority the job creation already uses, so fall back to it.
 */
function allowanceOf(tier: string, stored: unknown): number {
  const n = Number(stored);
  if (Number.isFinite(n) && n > 0) return n;
  return PRICING_PLANS.find((p) => p.tier === tier)?.photoLimit ?? 0;
}

/**
 * What a click on a paid tier does during the beta: no checkout, an offer.
 *
 * Selling is off until the paid-contract points are settled and the operating
 * entity is decided. Rather than a dead "not available" label, the click turns
 * into the thing most worth knowing at this stage — which tier someone reaches
 * for — and pays the visitor back with that tier's allowance.
 *
 * The offer is deliberately **not** advertised on the pricing card. A tier that
 * shouts "free in the beta" makes the free plan pointless and trains people to
 * click the biggest box. It is a reward for having reached for a paid tier, so
 * it only appears here, after the click.
 *
 * The dialogue resolves who it is talking to *before* showing the offer:
 * signed out, already unlocked, or eligible. Offering an allowance and only
 * then discovering the visitor cannot have it is the worse order — it reads as
 * a promise being withdrawn.
 */
export function BetaOfferDialog({
  tier,
  tierLabel,
  photoLimit,
  locale,
  photoCount,
  labelFor,
  onClose,
}: {
  tier: 'small' | 'medium' | 'large';
  tierLabel: string;
  photoLimit: number;
  locale: string;
  /** Photos the visitor already has loaded, if any — measurement only. */
  photoCount?: number;
  /** Tier key → display name, for reporting a grant made on another tier. */
  labelFor: (tier: string) => string;
  onClose: () => void;
}) {
  const t = useTranslations('betaOffer');
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [state, setState] = useState<
    'checking' | 'needsAccount' | 'alreadyGranted' | 'idle' | 'sending' | 'done' | 'error'
  >('checking');
  const [granted, setGranted] = useState<{ tier: string; photos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const returnPath = encodeURIComponent(`/${locale}/app/pricing?offer=${tier}`);

  // Resolve eligibility on open. The parent remounts this per tier, so this
  // also re-runs when the visitor moves to another card — which is what stops
  // a stale "unlocked" screen from carrying over and reporting the previous
  // tier's numbers against the new one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        // An anonymous session counts as no account: it dies with the browser
        // profile and would take the allowance with it.
        if (!user || user.is_anonymous) {
          if (!cancelled) setState('needsAccount');
          return;
        }
        const { data: profile } = await supabase
          .from('profiles')
          .select('beta_grant_tier, beta_grant_photos')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.beta_grant_tier) {
          setGranted({
            tier: profile.beta_grant_tier as string,
            photos: allowanceOf(profile.beta_grant_tier as string, profile.beta_grant_photos),
          });
          setState('alreadyGranted');
          return;
        }
        setState('idle');
      } catch {
        // Cannot tell — let them try; the endpoint enforces both rules anyway.
        if (!cancelled) setState('idle');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tier]);

  const submit = async () => {
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/beta/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, locale, feedback, photoCount }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setState('needsAccount');
        return;
      }
      if (res.status === 409) {
        const t = String(data.tier ?? '');
        setGranted({ tier: t, photos: allowanceOf(t, data.photos) });
        setState('alreadyGranted');
        return;
      }
      if (!res.ok) {
        setError(data.error === 'rate_limited' ? t('errorRateLimited') : t('errorGeneric'));
        setState('error');
        return;
      }
      setGranted({ tier, photos: Number(data.photos ?? photoLimit) });
      setState('done');
    } catch {
      setError(t('errorGeneric'));
      setState('error');
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        {children}
      </div>
    </div>
  );

  if (state === 'checking') {
    return shell(<p className="text-sm text-zinc-500">{t('checking')}</p>);
  }

  if (state === 'needsAccount') {
    return shell(
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
    );
  }

  if (state === 'alreadyGranted') {
    return shell(
      <>
        <div className="text-3xl mb-3">✓</div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('alreadyTitle')}
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t('alreadyBody', {
            tier: labelFor(granted?.tier ?? ''),
            photos: (granted?.photos ?? 0).toLocaleString(locale),
          })}
        </p>
        {/* Both ways out matter. Closing drops you back on a pricing page whose
            every button now leads here, which is a loop; "upload" is the thing
            the allowance is actually for. */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => router.push(`/${locale}/app/upload`)}
            className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {t('doneCta')}
          </button>
          <button
            onClick={() => router.push(`/${locale}`)}
            className="w-full rounded-full border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t('home')}
          </button>
          <button
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {t('alreadyCta')}
          </button>
        </div>
      </>
    );
  }

  if (state === 'done') {
    return shell(
      <>
        <div className="text-3xl mb-3">🎁</div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('doneTitle')}</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {t('doneBody', { photos: (granted?.photos ?? photoLimit).toLocaleString(locale) })}
        </p>
        {/* Straight on to the upload — the allowance exists to be spent, and
            leaving someone on the pricing page after granting it is a dead end
            they have to find their own way out of. */}
        <button
          onClick={() => router.push(`/${locale}/app/upload`)}
          className="mt-6 w-full rounded-full bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {t('doneCta')}
        </button>
        <button
          onClick={() => router.push(`/${locale}`)}
          className="mt-3 w-full text-center text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {t('home')}
        </button>
      </>
    );
  }

  return shell(
    <>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('title')}</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t('body', { tier: tierLabel, photos: photoLimit.toLocaleString(locale) })}
      </p>
      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {t('onlyOne')}
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
  );
}
