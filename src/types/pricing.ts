import type { Tier } from './job';

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

/** Determine which tier is needed for a given photo count */
export function getTierForPhotoCount(count: number): Tier {
  if (count <= 250) return 'free';
  if (count <= 1000) return 'small';
  if (count <= 2500) return 'medium';
  if (count <= 5000) return 'large';
  throw new Error(`Photo count ${count} exceeds maximum tier (5000)`);
}
