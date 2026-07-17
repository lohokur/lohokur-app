'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';

// Tier-aware "you're out of generations" moment. Any generation path can open it
// via openPaywall() (lib/paywall). Upsells to the next tier with one tap.
const UPSELL: Record<string, { plan: 'pro' | 'studio'; label: string; price: number; gens: number } | null> = {
  free: { plan: 'pro', label: 'Pro', price: 30, gens: 200 },
  pro: { plan: 'studio', label: 'Studio', price: 99, gens: 1000 },
  studio: null, // top self-serve tier — Enterprise is contact-sales only
};

export default function PaywallModal() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const show = () => { setErr(null); setBusy(false); setOpen(true); };
    window.addEventListener('lk-paywall', show);
    return () => window.removeEventListener('lk-paywall', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const tier = me?.tier || 'free';
  const cap = me?.entitlements.generations ?? 3;
  const capLabel = cap === Infinity ? '∞' : cap.toLocaleString();
  const upsell = UPSELL[tier] ?? null;

  const upgrade = async () => {
    if (!upsell) return;
    setBusy(true); setErr(null);
    const error = await startCheckout(upsell.plan, 'monthly');
    if (error) { setErr(error); setBusy(false); } // otherwise startCheckout redirects
  };

  return (
    <div className="pw-scrim" onClick={() => setOpen(false)}>
      <div className="pw-card" onClick={(e) => e.stopPropagation()}>
        <div className="pw-bolt">⚡</div>
        <h2 className="pw-title">You’re out of generations</h2>
        <p className="pw-body">
          You’ve used all {capLabel} of your {tier === 'free' ? 'free' : `${tier} `}generations this month.
          {upsell
            ? ` Upgrade to ${upsell.label} for ${upsell.gens.toLocaleString()} a month and keep creating.`
            : ' Your generations reset on the 1st.'}
        </p>

        {err && <p className="pw-err">{err}</p>}

        <div className="pw-actions">
          {upsell ? (
            <button className="pw-primary" onClick={upgrade} disabled={busy}>
              {busy ? 'Redirecting…' : `Upgrade to ${upsell.label} — £${upsell.price}/mo`}
            </button>
          ) : (
            <button className="pw-primary" onClick={() => setOpen(false)}>Got it</button>
          )}
          <div className="pw-secondary">
            <Link href="/pricing" onClick={() => setOpen(false)}>See all plans →</Link>
            <button className="pw-dismiss" onClick={() => setOpen(false)}>Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}
