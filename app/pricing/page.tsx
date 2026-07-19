'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';
import { TIERS, priceFor, type Tier, type Cadence } from '@/lib/entitlements';

const EXTRA_FEATURES: Record<Tier, string[]> = {
  free: ['Full node canvas', 'Watermarked visuals'],
  studio: ['Techpack PDF export', 'Watermark-free', 'Pattern engine'],
  pro: ['Pooled credits & shared workspace', 'Priority generation', 'Usage analytics'],
  brand: ['Manufacturing rails', 'Supplier & size-mix data', 'Dedicated onboarding'],
};

const featuresFor = (tier: Tier): string[] => {
  const e = TIERS[tier];
  return [
    `${e.generations.toLocaleString()} credits / month`,
    e.projects === Infinity ? 'Unlimited projects' : `${e.projects} projects`,
    e.seats > 1 ? `Up to ${e.seats} seats` : '1 seat',
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
      <p className="home-sub">Design freely on Free. Upgrade when you need more room and more generations.</p>

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
            <div key={tier} className={`plan-card${tier === 'studio' ? ' featured' : ''}`}>
              {tier === 'studio' && <span className="plan-badge">Most popular</span>}
              <h2 className="plan-name">{TIERS[tier].label}</h2>
              <div className="plan-price">
                {paid ? <>£{price}<span className="plan-per">/{cadence === 'annual' ? 'yr' : 'mo'}</span></> : 'Free'}
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
                <Link href="/" className="plan-cta ghost">Start free</Link>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
