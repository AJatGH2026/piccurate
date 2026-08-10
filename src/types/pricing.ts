import type { Tier } from './job';

/**
 * Price as a consumer must see it: gross, in the locale's own notation.
 *
 * `priceDisplay` below is a fixed "€4.99" string, which is wrong for a German
 * buyer — the PAngV wants the final price, and German writes "4,99 €". Use this
 * wherever a price is shown to a user; keep `priceDisplay` only for places that
 * are not customer-facing.
 */
export function formatPrice(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'de' ? 'de-DE' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export interface PricingPlan {
  tier: Tier;
  photoLimit: number;
  priceEurCents: number; // 0 for free
  priceDisplay: string; // "Free", "€4.99", etc.
  stripePriceId: string | null; // null for free tier
  features: string[];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    tier: 'free',
    photoLimit: 250,
    priceEurCents: 0,
    priceDisplay: 'Free',
    stripePriceId: null,
    features: [
      'Up to 250 photos',
      'All AI criteria',
      'Review & adjust',
      'Download ZIP',
      'One-time use',
    ],
  },
  {
    tier: 'small',
    photoLimit: 1000,
    priceEurCents: 499,
    priceDisplay: '€4.99',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SMALL ?? null,
    features: [
      'Up to 1,000 photos',
      'All AI criteria',
      'Review & adjust',
      'Download ZIP',
    ],
  },
  {
    tier: 'medium',
    photoLimit: 2500,
    priceEurCents: 799,
    priceDisplay: '€7.99',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MEDIUM ?? null,
    features: [
      'Up to 2,500 photos',
      'All AI criteria',
      'Review & adjust',
      'Download ZIP',
    ],
  },
  {
    tier: 'large',
    photoLimit: 5000,
    priceEurCents: 1099,
    priceDisplay: '€10.99',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LARGE ?? null,
    features: [
      'Up to 5,000 photos',
      'All AI criteria',
      'Review & adjust',
      'Download ZIP',
    ],
  },
];

/** Get the plan for a given tier */
export function getPlan(tier: Tier): PricingPlan {
  const plan = PRICING_PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown tier: ${tier}`);
  return plan;
}

/** Largest photo count any tier covers. Derived, so adding a tier updates it. */
export const MAX_TIER_PHOTOS = Math.max(...PRICING_PLANS.map((p) => p.photoLimit));

/**
 * Which tier covers this photo count — or `null` when it exceeds every tier.
 *
 * Returns null rather than throwing: "more photos than any tier" is an expected
 * situation with a defined answer (talk to support), not a programming error.
 * The null forces every caller to handle it, which an exception did not — the
 * previous version threw, and the one caller turned that into a bare "Analysis
 * failed" with no hint at what to do about it.
 */
export function getTierForPhotoCount(count: number): Tier | null {
  if (count <= 250) return 'free';
  if (count <= 1000) return 'small';
  if (count <= 2500) return 'medium';
  if (count <= MAX_TIER_PHOTOS) return 'large';
  return null;
}
