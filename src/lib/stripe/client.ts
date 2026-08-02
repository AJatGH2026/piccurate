import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // Pinned deliberately: it must match the version the installed SDK types
      // expect, so a stripe bump is always a conscious API-version change.
      apiVersion: '2026-07-29.dahlia',
    });
  }
  return _stripe;
}
