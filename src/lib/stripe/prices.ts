import type { Tier } from '@/types/job';

export interface TierConfig {
  tier: Tier;
  photoLimit: number;
  priceEurCents: number;
  stripePriceId: string | null;
}

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  free: {
    tier: 'free',
    photoLimit: 250,
    priceEurCents: 0,
    stripePriceId: null,
  },
  small: {
    tier: 'small',
    photoLimit: 1000,
    priceEurCents: 499,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_SMALL || null,
  },
  medium: {
    tier: 'medium',
    photoLimit: 2500,
    priceEurCents: 799,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_MEDIUM || null,
  },
  large: {
    tier: 'large',
    photoLimit: 5000,
    priceEurCents: 1099,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_LARGE || null,
  },
};
