'use client';

import { useEffect, useState } from 'react';
import { entitlementsFor, type Entitlements } from './entitlements';
import { readTrial, effectiveTier } from './trial';

const HAS_DB = process.env.NEXT_PUBLIC_HAS_DB === '1';

export type Me = {
  email: string | null;
  tier: string;
  gensUsed: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
  isAdmin: boolean;
  unlimited: boolean; // never metered (owner) — distinct from isAdmin
  entitlements: Entitlements;
  onTrial: boolean;
  trialEndsAt: string | null;
  trialUsed: boolean;
  daysLeft: number;
};

// Resolve the client-side Me from the raw /api/billing/me payload, folding the
// trial into entitlements so every stage-lock check unlocks during a trial.
function hydrate(d: Record<string, unknown>): Me {
  const onTrial = d.onTrial === true;
  const trialEndsAt = typeof d.trialEndsAt === 'string' ? d.trialEndsAt : null;
  const t = readTrial({ trial_ends_at: trialEndsAt, trial_used: d.trialUsed });
  const eff = effectiveTier((d.tier as string) ?? 'free', onTrial);
  return {
    email: (d.email as string) ?? null,
    tier: (d.tier as string) ?? 'free',
    gensUsed: (d.gensUsed as number) ?? 0,
    subscriptionStatus: (d.subscriptionStatus as string) ?? null,
    currentPeriodEnd: (d.currentPeriodEnd as string) ?? null,
    hasSubscription: d.hasSubscription === true,
    isAdmin: d.isAdmin === true,
    unlimited: d.unlimited === true,
    entitlements: entitlementsFor(eff),
    onTrial,
    trialEndsAt,
    trialUsed: t.trialUsed,
    daysLeft: t.daysLeft,
  };
}

// Current user's plan + usage. Refreshes on window focus and on the 'lk-gen-used'
// event (fire notifyGenUsed() after a render so the meter ticks down live).
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (!HAS_DB) {
      setMe(hydrate({ tier: 'studio', isAdmin: true, unlimited: true }));
      return;
    }
    let live = true;
    const load = () => fetch('/api/billing/me')
      .then((r) => r.json())
      .then((d) => { if (live) setMe(hydrate(d)); })
      .catch(() => { if (live) setMe((prev) => prev ?? hydrate({ tier: 'free' })); });
    load();
    window.addEventListener('lk-gen-used', load);
    window.addEventListener('focus', load);
    return () => { live = false; window.removeEventListener('lk-gen-used', load); window.removeEventListener('focus', load); };
  }, []);
  return me;
}

// Fire after a successful AI generation so any visible usage meter refreshes.
export function notifyGenUsed() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lk-gen-used'));
}

// Start the card-free 7-day trial. Returns null on success (caller should refresh
// me via notifyGenUsed()), or an error string. `upgrade` is true when the trial
// was already used and the user should be sent to checkout instead.
export async function startTrial(): Promise<{ error: string | null; upgrade: boolean }> {
  const res = await fetch('/api/billing/start-trial', { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.ok) { notifyGenUsed(); return { error: null, upgrade: false }; }
  return { error: data.error || 'could not start trial', upgrade: !!data.upgrade };
}

// Redirect to Stripe Checkout for a paid plan.
export async function startCheckout(plan: 'studio' | 'pro' | 'brand', cadence: 'monthly' | 'annual', opts?: { trial?: boolean }): Promise<string | null> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan, cadence, trial: opts?.trial }),
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
