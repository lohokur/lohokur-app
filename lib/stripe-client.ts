import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Lazily load Stripe.js with the publishable key. Returns null when no key is
// configured, so the caller can fall back to the simulated payment path.
let promise: Promise<Stripe | null> | null = null;

export function stripePromise(): Promise<Stripe | null> | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!promise) promise = loadStripe(key);
  return promise;
}

export const hasStripe = () => !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
