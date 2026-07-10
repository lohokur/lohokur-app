'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMe, openPortal } from '@/lib/use-billing';

export default function ProfilePage() {
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const manage = async () => {
    setErr(null); setBusy(true);
    const error = await openPortal();
    if (error) { setErr(error); setBusy(false); }
  };

  const ent = me?.entitlements;
  const cap = ent?.generations ?? 0;
  const used = me?.gensUsed ?? 0;
  const pct = cap && cap !== Infinity ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const periodEnd = me?.currentPeriodEnd ? new Date(me.currentPeriodEnd).toLocaleDateString() : null;

  return (
    <main className="home">
      <div className="home-head">
        <h1 className="home-title" style={{ margin: 0 }}>My profile</h1>
        <Link href="/" className="ghost-link">← Projects</Link>
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
    </main>
  );
}
