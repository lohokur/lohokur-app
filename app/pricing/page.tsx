'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';
import { TIERS, type Tier } from '@/lib/entitlements';

type Cadence = 'monthly' | 'annual';

// Display pricing (marketing copy). MUST match the amounts on the Stripe Prices
// you create — Stripe is the source of truth for what's actually charged.
const PRICE: Record<Exclude<Tier, 'free'>, Record<Cadence, number>> = {
  pro: { monthly: 30, annual: 300 },
  studio: { monthly: 99, annual: 990 },
};

const featuresFor = (tier: Tier): string[] => {
  const e = TIERS[tier];
  return [
    `${e.generations.toLocaleString()} AI generations / month`,
    e.projects === Infinity ? 'Unlimited projects' : `${e.projects} project${e.projects > 1 ? 's' : ''}`,
    'Every node unlocked — full pipeline',
  ];
};

export default function PricingPage() {
  const me = useMe();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const current = (me?.tier ?? 'free') as Tier;

  const go = async (plan: 'pro' | 'studio') => {
    setErr(null); setBusy(plan);
    const error = await startCheckout(plan, cadence);
    if (error) { setErr(error); setBusy(null); }
  };

  const order: Tier[] = ['free', 'pro', 'studio'];

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
          Annual <span className="save-pill">2 months free</span>
        </button>
      </div>

      {err && <p className="pricing-err">{err}</p>}

      <div className="pricing-grid">
        {order.map((tier) => {
          const paid = tier !== 'free';
          const price = paid ? PRICE[tier as 'pro' | 'studio'][cadence] : 0;
          const isCurrent = current === tier;
          return (
            <div key={tier} className={`plan-card${tier === 'pro' ? ' featured' : ''}`}>
              {tier === 'pro' && <span className="plan-badge">Most popular</span>}
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
                <button className="plan-cta" disabled={busy === tier} onClick={() => go(tier as 'pro' | 'studio')}>
                  {busy === tier ? 'Redirecting…' : `Choose ${TIERS[tier].label}`}
                </button>
              ) : (
                <Link href="/" className="plan-cta ghost">Start free</Link>
              )}
            </div>
          );
        })}

        {/* Enterprise — no self-serve checkout; talk to sales */}
        <div className="plan-card">
          <h2 className="plan-name">Enterprise</h2>
          <div className="plan-price plan-price-custom">Let’s talk</div>
          <ul className="plan-features">
            <li>Everything in Studio</li>
            <li>Volume generation limits</li>
            <li>Priority support &amp; onboarding</li>
            <li>Custom terms &amp; invoicing</li>
          </ul>
          <a className="plan-cta ghost" href="mailto:studio@lohokur.com?subject=Enterprise%20enquiry">Contact sales</a>
        </div>
      </div>
    </main>
  );
}
