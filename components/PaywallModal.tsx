'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';
import { priceFor, TIERS } from '@/lib/entitlements';
import { TRIAL_DAYS } from '@/lib/trial';

// Tier-aware "you're out of generations" moment. Any generation path can open it
// via openPaywall() (lib/paywall). Upsells to the next tier with one tap; price
// comes from the single pricing source in lib/entitlements.
const NEXT_TIER: Record<string, 'studio' | 'pro' | 'brand' | null> = {
  free: 'studio',
  studio: 'pro',
  pro: 'brand',
  brand: null, // top self-serve tier
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

  // owner tier-preview override (set by the studio toggle) so the paywall reflects
  // the tier being previewed, not the owner's real plan
  const previewTier = typeof window !== 'undefined' ? localStorage.getItem('lk-tier-override') : null;
  const tier = previewTier || me?.tier || 'free';
  const nextTier = NEXT_TIER[tier] ?? null;
  const upsell = nextTier
    ? { plan: nextTier, label: TIERS[nextTier].label, price: priceFor(nextTier, 'monthly') }
    : null;
  // a free user who's never trialed gets the trial instead of a hard upsell
  const offerTrial = tier === 'free' && (previewTier === 'free' || me?.trialUsed === false);

  // Card-on-file 7-day trial: send them to Stripe Checkout with a 7-day trial —
  // the card is collected now, the first charge lands in 7 days.
  const beginTrial = async () => {
    setBusy(true); setErr(null);
    const error = await startCheckout('studio', 'monthly', { trial: true });
    if (error) { setErr(error); setBusy(false); } // otherwise startCheckout redirects to Stripe
  };

  const upgrade = async () => {
    if (!upsell) return;
    setBusy(true); setErr(null);
    const error = await startCheckout(upsell.plan, 'monthly');
    if (error) { setErr(error); setBusy(false); } // otherwise startCheckout redirects
  };

  return (
    <div className="pw-scrim" onClick={() => setOpen(false)}>
      <div className="pw-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="pw-title">{offerTrial ? 'Start your free trial' : 'You’re out of ink'}</h2>
        <p className="pw-body">
          {offerTrial
            ? `Try Studio free for ${TRIAL_DAYS} days — 1,000 generations a month, unlimited nodes and the full production line. Add your card now; your first payment is ${TRIAL_DAYS} days from today and you can cancel anytime before then.`
            : 'Your ink refills on the 1st.'}
          {!offerTrial && upsell
            ? ` Or upgrade to ${upsell.label} for more each month and keep creating now.`
            : ''}
        </p>

        {err && <p className="pw-err">{err}</p>}

        <div className="pw-actions">
          {offerTrial ? (
            <button className="pw-primary" onClick={beginTrial} disabled={busy}>
              {busy ? 'Starting…' : `Start your ${TRIAL_DAYS}-day free trial`}
            </button>
          ) : upsell ? (
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
