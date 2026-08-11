'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LegalModal } from '@/components/legal/LegalModal';

/**
 * The two declarations a purchase needs, kept apart on purpose.
 *
 * - **18.** This is where a contract is formed, so limited contractual capacity
 *   applies (§§ 104 ff. BGB). It used to read "18 or with a guardian's consent",
 *   which no longer holds: the Gemini API terms forbid clients aimed at or
 *   likely used by under-18s, and a guardian cannot consent that away. The
 *   confirmation before the analysis now asks for 18 as well, so this box
 *   restates the same threshold at the point a contract attaches to it.
 * - **Immediate performance, withdrawal right lapses on full performance**
 *   (§ 356 Abs. 5 BGB). Without this consent a digital service may not be
 *   delivered before the 14-day withdrawal period ends — and the whole product
 *   is instant delivery. Note what the consent does *not* do: for a service the
 *   right lapses only once the job has run to completion, never at its start.
 *   Withdrawing mid-run stays effective and costs pro-rata Wertersatz
 *   (§ 357a Abs. 2 BGB). The 2026-08-10 texts claimed expiry at the start; the
 *   Abmahn-Test made that its most serious finding.
 *
 * Bundling them into one box would make both hard to evidence and is exactly
 * what we untangled on the configure page.
 *
 * The Widerrufsbelehrung that consent refers to now exists — terms §4, with the
 * Muster-Widerrufsformular and the online withdrawal function (§ 356a BGB).
 *
 * ⚠️ The confirmation of the contract in text form is the third condition of
 * § 356 Abs. 5 BGB, on top of the two declarations below. It is sent from the
 * Stripe webhook (`sendOrderConfirmation`) — so if that mail is ever disabled or
 * silently fails, this dialogue is collecting a consent that achieves nothing.
 *
 * The confirm button carries the § 312j Abs. 3 BGB wording, because terms § 3
 * says the binding offer is made here. Stripe's own button then only takes the
 * payment; its label is not ours to set.
 */
export function CheckoutConfirm({
  tierLabel,
  priceDisplay,
  locale,
  busy,
  onConfirm,
  onCancel,
}: {
  tierLabel: string;
  priceDisplay: string;
  locale: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('checkout');
  const [ageOk, setAgeOk] = useState(false);
  const [withdrawalOk, setWithdrawalOk] = useState(false);
  const ready = ageOk && withdrawalOk && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('title', { tier: tierLabel })}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle', { price: priceDisplay })}</p>

        <label className="mt-5 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={ageOk}
            onChange={(e) => setAgeOk(e.target.checked)}
            className="mt-0.5 accent-indigo-600"
          />
          <span>{t('age18')}</span>
        </label>

        <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={withdrawalOk}
            onChange={(e) => setWithdrawalOk(e.target.checked)}
            className="mt-0.5 accent-indigo-600"
          />
          <span>
            {t('withdrawal')}{' '}
            <LegalModal
              href={`/${locale}/terms`}
              label={t('termsLink')}
              linkClassName="underline hover:text-indigo-600"
            />
          </span>
        </label>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!ready}
            className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
              ready
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed dark:bg-zinc-700'
            }`}
          >
            {busy ? t('redirecting') : t('toPayment')}
          </button>
        </div>
      </div>
    </div>
  );
}
