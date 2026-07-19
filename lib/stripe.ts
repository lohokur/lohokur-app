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

// Grandfathered prices from the old Free/Pro/Studio model — kept so anyone on a
// legacy subscription retains a tier instead of dropping to free on the next
// webhook. Old Studio (£99) and old Pro (£30) map to the new Studio entitlements.
const LEGACY_PRICE_TIER: Record<string, Tier> = {
  price_1TuIWpGy8yU5fgkqpeAws45e: 'studio', // old Studio £99/mo
  price_1TuIWpGy8yU5fgkqu4PerPWM: 'studio', // old Studio £990/yr
  price_1TuIWoGy8yU5fgkqDjzFOEuj: 'studio', // old Pro £30/mo
  price_1TuIWoGy8yU5fgkqecId1P3h: 'studio', // old Pro £300/yr
  price_1TrSOgGy8yU5fgkqD0KzuzYr: 'studio', // older Studio £30/mo
  price_1TrSOgGy8yU5fgkqCxgcO1zp: 'studio', // older Studio £300/yr
  price_1TrSOeGy8yU5fgkqkNs0ccjD: 'studio', // older Pro £12/mo
  price_1TrSOfGy8yU5fgkqFd30vAwB: 'studio', // older Pro £120/yr
};

// Reverse lookup used by the webhook: a Stripe Price ID → our tier.
export function tierForPrice(id: string): Tier | null {
  const map: Array<[string | undefined, Tier]> = [
    [process.env.STRIPE_PRICE_STUDIO_MONTHLY, 'studio'],
    [process.env.STRIPE_PRICE_STUDIO_ANNUAL, 'studio'],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, 'pro'],
    [process.env.STRIPE_PRICE_BRAND_MONTHLY, 'brand'],
    [process.env.STRIPE_PRICE_BRAND_ANNUAL, 'brand'],
  ];
  for (const [pid, tier] of map) if (pid && pid === id) return tier;
  return LEGACY_PRICE_TIER[id] ?? null;
}
