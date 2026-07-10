import Stripe from 'stripe';
import type { Tier } from './entitlements';

// Lazy server-only Stripe client. Constructed on first use so that importing this
// module (at build time, or in routes) never throws when STRIPE_SECRET_KEY is unset.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export type Cadence = 'monthly' | 'annual';

// tier+cadence → Stripe Price ID (created in the Stripe dashboard, set as env vars).
export function priceId(tier: Exclude<Tier, 'free'>, cadence: Cadence): string | undefined {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${cadence.toUpperCase()}`;
  return process.env[key];
}

// Reverse lookup used by the webhook: a Stripe Price ID → our tier.
export function tierForPrice(id: string): Tier | null {
  const map: Array<[string | undefined, Tier]> = [
    [process.env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, 'pro'],
    [process.env.STRIPE_PRICE_STUDIO_MONTHLY, 'studio'],
    [process.env.STRIPE_PRICE_STUDIO_ANNUAL, 'studio'],
  ];
  for (const [pid, tier] of map) if (pid && pid === id) return tier;
  return null;
}
