'use client';

import { useEffect, useState } from 'react';
import { entitlementsFor, type Entitlements } from './entitlements';

const HAS_DB = process.env.NEXT_PUBLIC_HAS_DB === '1';

export type Me = {
  tier: string;
  gensUsed: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
  entitlements: Entitlements;
};

// Current user's plan + usage. In local/no-DB mode everything is unlocked (dev).
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!HAS_DB) {
      setMe({ tier: 'studio', gensUsed: 0, subscriptionStatus: null, currentPeriodEnd: null, hasSubscription: false, entitlements: entitlementsFor('studio') });
      return;
    }
    let live = true;
    fetch('/api/billing/me')
      .then((r) => r.json())
      .then((d) => { if (live) setMe({ ...d, entitlements: entitlementsFor(d.tier) }); })
      .catch(() => { if (live) setMe({ tier: 'free', gensUsed: 0, subscriptionStatus: null, currentPeriodEnd: null, hasSubscription: false, entitlements: entitlementsFor('free') }); });
    return () => { live = false; };
  }, []);
  return me;
}

// Redirect to Stripe Checkout for a paid plan.
export async function startCheckout(plan: 'pro' | 'studio', cadence: 'monthly' | 'annual'): Promise<string | null> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, cadence }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.url) { window.location.href = data.url; return null; }
  return data.error || 'could not start checkout';
}

// Open the Stripe Customer Portal (manage / cancel / update card).
export async function openPortal(): Promise<string | null> {
  const res = await fetch('/api/billing/portal', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (data.url) { window.location.href = data.url; return null; }
  return data.error || 'could not open billing portal';
}
