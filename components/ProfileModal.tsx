'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe, openPortal } from '@/lib/use-billing';

// In-canvas "My profile" — plan + monthly usage + manage/upgrade. Opened via
// openProfile() (lib/profile) from the credits meter or the dock. Clicking the
// backdrop or Esc closes it and leaves you on the canvas (no navigation).
export default function ProfileModal() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const show = () => { setErr(null); setBusy(false); setOpen(true); };
    window.addEventListener('lk-profile', show);
    return () => window.removeEventListener('lk-profile', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const ent = me?.entitlements;
  const cap = ent?.generations ?? 0;
  const used = me?.gensUsed ?? 0;
  const pct = cap && cap !== Infinity ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const periodEnd = me?.currentPeriodEnd ? new Date(me.currentPeriodEnd).toLocaleDateString() : null;

  const manage = async () => {
    setErr(null); setBusy(true);
    const error = await openPortal();
    if (error) { setErr(error); setBusy(false); } // otherwise openPortal redirects
  };

  return (
    <div className="pw-scrim" onClick={() => setOpen(false)}>
      <div className="pf-card" onClick={(e) => e.stopPropagation()}>
        <div className="pf-head">
          <span>My profile</span>
          <button className="pf-x" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
        </div>

        <section className="billing-card">
          <div className="billing-row">
            <div>
              <div className="billing-label">Current plan</div>
              <div className="billing-plan">{ent?.label ?? '—'}</div>
              {me?.subscriptionStatus && me.subscriptionStatus !== 'active' && (
                <div className="billing-status">status: {me.subscriptionStatus}</div>
              )}
              {periodEnd && <div className="billing-status">renews / ends {periodEnd}</div>}
            </div>
            <div className="billing-actions">
              {me?.hasSubscription ? (
                <button className="new-btn" disabled={busy} onClick={manage}>{busy ? 'Opening…' : 'Manage subscription'}</button>
              ) : (
                <Link href="/pricing" className="new-btn">Upgrade</Link>
              )}
            </div>
          </div>

          <div className="billing-usage">
            <div className="billing-label">
              AI generations this month — {used}{cap === Infinity ? '' : ` / ${cap}`}
            </div>
            {cap !== Infinity && (
              <div className="usage-bar"><div className="usage-fill" style={{ width: `${pct}%` }} /></div>
            )}
          </div>

          {err && <p className="pricing-err">{err}</p>}
          {me?.tier !== 'studio' && (
            <Link href="/pricing" className="ghost-link" style={{ marginTop: 6, display: 'inline-block' }}>See all plans →</Link>
          )}
        </section>
      </div>
    </div>
  );
}
