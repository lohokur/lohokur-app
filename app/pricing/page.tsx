'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';
import { TIERS, priceFor, CURRENCY, type Tier, type Cadence } from '@/lib/entitlements';

// One-line positioning under each plan name (mirrors the on-brand pricing ladder).
const TAGLINE: Record<Tier, string> = {
  free: 'Sketch on the pad and explore the studio.',
  studio: 'Your own creative workspace.',
  pro: 'Full collaboration and workflow power.',
  brand: 'Creative infrastructure at scale.',
};

// Curated benefits per tier, on top of the generations / projects / seats lines.
const EXTRA_FEATURES: Record<Tier, string[]> = {
  free: ['Sketch freely on the pad', 'Full canvas & layer editor', 'Explore the whole production line'],
  studio: ['Everything in Free', 'The full production line — pattern, tech pack, sample, manufacture & ship', 'Bring sketches to life (front, side & back)', 'Tech pack PDF export', 'Watermark-free'],
  pro: ['Everything in Starter', 'Shared team workspace & assets', 'Priority generation', 'Usage analytics'],
  brand: ['Everything in Pro', 'Manufacturing & supplier rails', 'Per-seat usage caps', 'Dedicated onboarding & support'],
};

const featuresFor = (tier: Tier): string[] => {
  const e = TIERS[tier];
  return [
    e.generations === 0 ? 'Sketch only — no AI generations' : `${e.generations.toLocaleString()} generations / month`,
    e.projects === Infinity ? 'Unlimited projects' : `${e.projects} projects`,
    e.seats > 1 ? `Up to ${e.seats} seats` : '1 seat (solo)',
    ...EXTRA_FEATURES[tier],
  ];
};

export default function PricingPage() {
  const me = useMe();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = (me?.tier ?? 'free') as Tier;

  const go = async (plan: 'studio' | 'pro' | 'brand') => {
    setErr(null); setBusy(plan);
    const error = await startCheckout(plan, cadence);
    if (error) { setErr(error); setBusy(null); }
  };

  const order: Tier[] = ['free', 'studio', 'pro', 'brand'];

  return (
    <main className="home">
      <div className="home-head">
        <h1 className="home-title" style={{ margin: 0 }}>Plans</h1>
        <Link href="/" className="ghost-link">← Projects</Link>
      </div>
      <p className="home-sub">Sketch for free. A plan unlocks every AI generation — backed by a 7-day money-back guarantee.</p>

      <div className="cadence-toggle" role="tablist">
        <button className={cadence === 'monthly' ? 'on' : ''} onClick={() => setCadence('monthly')}>Monthly</button>
        <button className={cadence === 'annual' ? 'on' : ''} onClick={() => setCadence('annual')}>
          Annual <span className="save-pill">Save 20%</span>
        </button>
      </div>

      {err && <p className="pricing-err">{err}</p>}

      <div className="pricing-grid">
        {order.map((tier) => {
          const paid = tier !== 'free';
          const price = priceFor(tier, cadence) ?? 0;
          const isCurrent = current === tier;
          return (
            <div key={tier} className={`plan-card${tier === 'pro' ? ' featured' : ''}`}>
              {tier === 'pro' && <span className="plan-badge">Most popular</span>}
              <h2 className="plan-name">{TIERS[tier].label}</h2>
              <p className="plan-tagline">{TAGLINE[tier]}</p>
              <div className="plan-price">
                {paid ? <>{CURRENCY}{price}<span className="plan-per">/{cadence === 'annual' ? 'yr' : 'mo'}</span></> : 'Free'}
              </div>
              <ul className="plan-features">
                {featuresFor(tier).map((f) => <li key={f}>{f}</li>)}
              </ul>
              {isCurrent ? (
                <button className="plan-cta current" disabled>Current plan</button>
              ) : paid ? (
                <button className="plan-cta" disabled={busy === tier} onClick={() => go(tier as 'studio' | 'pro' | 'brand')}>
                  {busy === tier ? 'Redirecting…' : `Choose ${TIERS[tier].label}`}
                </button>
              ) : (
                <Link href="/" className="plan-cta ghost">Sketch for free</Link>
              )}
            </div>
          );
        })}
      </div>

      <p className="pricing-guarantee">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3.5z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8.5 12l2.4 2.4 4.6-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        7-day money-back guarantee — not happy in your first week? Email us for a full refund, no questions asked.
      </p>
    </main>
  );
}
