'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';
import { priceFor, entitlementsFor, TIERS, CURRENCY } from '@/lib/entitlements';
import { announcePopout, onPopout } from '@/lib/popout';

// Tier-aware "you're out of generations" moment. Any generation path can open it
// via openPaywall() (lib/paywall). It always upsells to the next tier with one
// tap — no free trial. Rendered as a techpack-style slide-in drawer; only one
// popout shows at a time (see lib/popout).
const NEXT_TIER: Record<string, 'studio' | 'pro' | 'brand' | null> = {
  free: 'studio',
  studio: 'pro',
  pro: 'brand',
  brand: null, // top self-serve tier
};

// Three concrete things you unlock by moving up one tier — real entitlement
// numbers, not marketing fluff.
function unlocks(from: string, to: 'studio' | 'pro' | 'brand'): string[] {
  const next = entitlementsFor(to);
  const gens = `${next.generations.toLocaleString()} generations a month`;
  if (from === 'free') {
    return [gens, 'Unlimited projects, nodes & regenerations', 'The full production line, end to end'];
  }
  return [gens, `${next.seats} seats for your team`, 'Priority generation & support'];
}

export default function PaywallModal() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const show = () => { setErr(null); setBusy(false); setOpen(true); announcePopout('paywall'); };
    window.addEventListener('lk-paywall', show);
    return () => window.removeEventListener('lk-paywall', show);
  }, []);

  // close if another popout opens (one at a time)
  useEffect(() => onPopout('paywall', () => setOpen(false)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  // owner tier-preview override (set by the studio toggle) so the paywall reflects
  // the tier being previewed, not the owner's real plan
  const previewTier = typeof window !== 'undefined' ? localStorage.getItem('lk-tier-override') : null;
  const tier = previewTier || me?.tier || 'free';
  const usedCap = entitlementsFor(tier).generations;
  const nextTier = NEXT_TIER[tier] ?? null;
  const upsell = nextTier
    ? { plan: nextTier, label: TIERS[nextTier].label, price: priceFor(nextTier, 'monthly'), perks: unlocks(tier, nextTier) }
    : null;

  const upgrade = async () => {
    if (!upsell) return;
    setBusy(true); setErr(null);
    const error = await startCheckout(upsell.plan, 'monthly');
    if (error) { setErr(error); setBusy(false); } // otherwise startCheckout redirects to Stripe
  };

  return (
    <>
      <div className="popout-catch" onClick={() => setOpen(false)} />
      <aside className="popout open" role="dialog" aria-modal="true" aria-labelledby="pw-title">
        <div className="tp-head">
          <span>Upgrade</span>
          <button className="sp-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <div className="po-body">
          <span className="po-kicker">Out of generations</span>
          <h2 className="po-title" id="pw-title">
            {upsell ? `Upgrade to ${upsell.label}` : 'You’re on the top plan'}
          </h2>
          <p className="po-lead">
            {upsell
              ? `You’ve used all ${usedCap.toLocaleString()} generations on ${TIERS[tier as keyof typeof TIERS]?.label ?? 'your plan'} this month. Move up to ${upsell.label} and keep creating right now — your ink refills the moment you upgrade.`
              : 'Your generations refill on the 1st. Reach out if you need more this month.'}
          </p>

          {upsell && (
            <div className="po-tier">
              <div className="po-tier-head">
                <span className="po-tier-name">{upsell.label}</span>
                <span className="po-tier-price">
                  {upsell.price != null ? <><strong>{CURRENCY}{upsell.price}</strong><span>/mo</span></> : null}
                </span>
              </div>
              <ul className="po-perks">
                {upsell.perks.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          )}

          {err && <p className="po-err">{err}</p>}

          {upsell && (
            <p className="pw-guarantee">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3.5z" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M8.5 12l2.4 2.4 4.6-4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              7-day money-back guarantee — full refund if it&apos;s not for you.
            </p>
          )}
        </div>

        <div className="tp-foot tp-foot-row">
          <Link className="tp-export" href="/pricing" onClick={() => setOpen(false)}>Compare plans</Link>
          {upsell ? (
            <button className="sp-done" onClick={upgrade} disabled={busy}>
              {busy ? 'Redirecting…' : `Upgrade to ${upsell.label}`}
            </button>
          ) : (
            <button className="sp-done" onClick={() => setOpen(false)}>Got it</button>
          )}
        </div>
      </aside>
    </>
  );
}
