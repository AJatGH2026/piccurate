'use client';

import { useTranslations, useLocale } from 'next-intl';
import { brandName } from '@/lib/brand';
import { PRICING_PLANS, formatPrice } from '@/types/pricing';
import { usePhotoStore } from '@/hooks/usePhotoStore';
import { BetaOfferDialog } from '@/components/checkout/BetaOfferDialog';
import type { Tier } from '@/types/job';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckoutConfirm } from '@/components/checkout/CheckoutConfirm';

export default function PricingPage() {
  const t = useTranslations('pricing');
  const tc = useTranslations('checkout');
  const locale = useLocale();
  const router = useRouter();
  const [chosen, setChosen] = useState<Tier | null>(null);
  const [offer, setOffer] = useState<'small' | 'medium' | 'large' | null>(null);
  const [busy, setBusy] = useState(false);
  // Photos the visitor already loaded, if any. Measurement only: it is what
  // makes the tier click readable — the allowance follows the tier, so the
  // click alone always points at "large".
  const photoCount = usePhotoStore((s) => s.photos.length);

  /**
   * Turn a chosen tier into a Stripe Checkout session.
   *
   * A purchase always requires a **permanent** account, regardless of
   * `BETA_OPEN_ACCESS`: an anonymous session can vanish with the browser
   * profile, and a paid job that its owner can never reach again is worse than
   * a refused sale. So an anonymous or absent user is sent to sign up first.
   */
  const startCheckout = async (tier: Tier) => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.is_anonymous) {
        const next = encodeURIComponent(`/${locale}/app/pricing`);
        router.push(`/${locale}/auth/register?next=${next}`);
        return;
      }

      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const jobJson = await jobRes.json();
      if (!jobRes.ok || !jobJson?.data?.jobId) {
        throw new Error(jobJson?.error || 'Could not create job');
      }

      const coRes = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobJson.data.jobId, tier, locale }),
      });
      const coJson = await coRes.json();
      if (!coRes.ok || !coJson?.data?.checkoutUrl) {
        throw new Error(coJson?.error || 'Could not start checkout');
      }
      window.location.href = coJson.data.checkoutUrl;
    } catch (err) {
      alert(tc('failed', { error: err instanceof Error ? err.message : 'Unknown error' }));
      setBusy(false);
      setChosen(null);
    }
  };

  // Photo volume is the primary tier differentiator; Custom Criteria (§5a) is
  // a paid-only feature per the pricing plan (see product-pipeline.md §9.3).
  // The technical enforcement is wired in at sales launch — until then the
  // feature is open for testers but the pricing copy already says paid-only.
  const baseFeatures = [t('features.allCriteria'), t('features.reviewAdjust'), t('features.downloadZip')];
  const plans = PRICING_PLANS.map((plan) => ({
    ...plan,
    highlight: plan.tier === 'medium',
    features: plan.tier === 'free' ? baseFeatures : [...baseFeatures, t('features.customCriteria')],
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="text-lg font-bold text-indigo-600">{brandName(locale)}</Link>
          <span className="text-sm text-zinc-500">{t('title')}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t('title')}</h1>
          <p className="mt-2 text-lg text-zinc-500">{t('subtitle')}</p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-600 shadow-xl scale-105'
                  : 'bg-white dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-zinc-700'
              }`}
            >
              <h3 className="text-lg font-semibold">
                {plan.tier === 'free' ? t('free') : plan.tier === 'small' ? t('small') : plan.tier === 'medium' ? t('medium') : t('large')}
              </h3>
              <div className="mt-3">
                <span className="text-3xl font-bold">
                  {plan.tier === 'free' ? t('free') : formatPrice(plan.priceEurCents, locale)}
                </span>
                {plan.tier !== 'free' && (
                  <span className={`ml-1 text-sm ${plan.highlight ? 'text-indigo-200' : 'text-zinc-500'}`}>
                    {t('perUse')}
                  </span>
                )}
              </div>
              {/* PAngV: the VAT statement belongs on the price itself, not only
                  in the order dialogue further down the funnel. */}
              {plan.tier !== 'free' && (
                <p className={`text-xs ${plan.highlight ? 'text-indigo-200' : 'text-zinc-500'}`}>
                  {t('inclVat')}
                </p>
              )}
              <p className={`mt-1 text-sm ${plan.highlight ? 'text-indigo-200' : 'text-zinc-500'}`}>
                {t('photosUpTo', { count: plan.photoLimit.toLocaleString() })}
              </p>
              {plan.tier === 'free' && (
                <p className={`text-xs ${plan.highlight ? 'text-indigo-200' : 'text-amber-600'}`}>
                  {t('oneTimeUse')}
                </p>
              )}
              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className={plan.highlight ? 'text-indigo-200' : 'text-green-500'}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {plan.tier === 'free' ? (
                <Link
                  href={`/${locale}/app/upload`}
                  className={`mt-6 w-full text-center rounded-full py-2.5 text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {t('cta')}
                </Link>
              ) : plan.stripePriceId ? (
                <button
                  onClick={() => setChosen(plan.tier)}
                  disabled={busy}
                  className={`mt-6 w-full text-center rounded-full py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    plan.highlight
                      ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {t('cta')}
                </button>
              ) : (
                // No Stripe price for this tier means selling is still off. The
                // click is not wasted on a dead label: it opens the beta offer,
                // which trades the tier's allowance for a look at which tier
                // people reach for. Flips to real checkout by itself the moment
                // the price ids are configured.
                <>
                  <button
                    onClick={() => setOffer(plan.tier as 'small' | 'medium' | 'large')}
                    className={`mt-6 w-full text-center rounded-full py-2.5 text-sm font-semibold transition-colors ${
                      plan.highlight
                        ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {t('betaCta')}
                  </button>
                  <p
                    className={`mt-2 text-center text-xs ${
                      plan.highlight ? 'text-indigo-200' : 'text-zinc-500'
                    }`}
                  >
                    {t('plannedPrice')}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>

        {chosen && (
          <CheckoutConfirm
            tierLabel={
              chosen === 'small' ? t('small') : chosen === 'medium' ? t('medium') : t('large')
            }
            priceDisplay={formatPrice(
              PRICING_PLANS.find((p) => p.tier === chosen)!.priceEurCents,
              locale
            )}
            locale={locale}
            busy={busy}
            onConfirm={() => startCheckout(chosen)}
            onCancel={() => setChosen(null)}
          />
        )}

        {offer && (
          <BetaOfferDialog
            tier={offer}
            tierLabel={offer === 'small' ? t('small') : offer === 'medium' ? t('medium') : t('large')}
            photoLimit={PRICING_PLANS.find((p) => p.tier === offer)!.photoLimit}
            locale={locale}
            photoCount={photoCount}
            onClose={() => setOffer(null)}
          />
        )}
      </main>
    </div>
  );
}
