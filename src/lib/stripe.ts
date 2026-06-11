import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
  }
  return _stripe;
}

// Price IDs — these come from your Stripe dashboard
// Set them as env vars: STRIPE_PRICE_STARTER, STRIPE_PRICE_UNLIMITED, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_PER_COURSE
export const PRICE_IDS = {
  starter:    process.env.STRIPE_PRICE_STARTER    ?? '',
  unlimited:  process.env.STRIPE_PRICE_UNLIMITED  ?? '',
  business:   process.env.STRIPE_PRICE_BUSINESS   ?? '',
  per_course: process.env.STRIPE_PRICE_PER_COURSE ?? '',
} as const;
