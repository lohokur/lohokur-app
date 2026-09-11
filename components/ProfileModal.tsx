'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMe, openPortal } from '@/lib/use-billing';
import { priceFor, CURRENCY } from '@/lib/entitlements';
import { supabaseBrowser } from '@/lib/supabase/client';
import { announcePopout, onPopout } from '@/lib/popout';

// Full settings modal (Flora-style): left nav + rich panels. Opened via
// openProfile() from the credits meter or the dock. Backdrop / Esc closes it and
// leaves you on the canvas — never the project dashboard.

type Section = 'profile' | 'billing' | 'usage';

export default function ProfileModal() {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>('profile');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const show = () => { setErr(null); setBusy(false); setSection('profile'); setOpen(true); announcePopout('profile'); };
    window.addEventListener('lk-profile', show);
    return () => window.removeEventListener('lk-profile', show);
  }, []);

  // close if another popout opens (one at a time)
  useEffect(() => onPopout('profile', () => setOpen(false)), []);

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
  const finite = cap !== Infinity;
  const pct = finite && cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const remaining = finite ? Math.max(0, cap - used) : Infinity;
  const price = priceFor(me?.tier, 'monthly');
  const email = me?.email ?? '—';
  const initial = (me?.email?.[0] ?? '?').toUpperCase();
  const periodEnd = me?.currentPeriodEnd ? new Date(me.currentPeriodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  // generations reset on the 1st of next month (calendar-month usage window)
  const resetDate = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 1).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }); })();

  const manage = async () => {
    setErr(null); setBusy(true);
    const error = await openPortal();
    if (error) { setErr(error); setBusy(false); }
  };
  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.push('/login'); router.refresh();
  };

  const title = section === 'profile' ? 'Profile' : section === 'billing' ? 'Plan & Billing' : 'Usage';

  return (
    <div className="pw-scrim" onClick={() => setOpen(false)}>
      <div className="set-modal" onClick={(e) => e.stopPropagation()}>
        {/* left nav */}
        <nav className="set-nav">
          <div className="set-nav-group">Account</div>
          <button className={`set-nav-item${section === 'profile' ? ' on' : ''}`} onClick={() => setSection('profile')}>Profile</button>
          <div className="set-nav-group">Plan</div>
          <button className={`set-nav-item${section === 'billing' ? ' on' : ''}`} onClick={() => setSection('billing')}>Plan &amp; Billing</button>
          <button className={`set-nav-item${section === 'usage' ? ' on' : ''}`} onClick={() => setSection('usage')}>Usage</button>
          {me?.isAdmin && (<>
            <div className="set-nav-sep" />
            <Link href="/admin" className="set-nav-item" onClick={() => setOpen(false)}>Analytics</Link>
          </>)}
        </nav>

        {/* main */}
        <div className="set-main">
          <div className="set-head">
            <h2 className="set-title">{title}</h2>
            <button className="set-x" aria-label="Close" onClick={() => setOpen(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
          </div>

          {section === 'profile' && (
            <div className="set-body">
              <div className="set-id">
                <div className="set-avatar">{initial}</div>
                <div>
                  <div className="set-id-email">{email}</div>
                  <div className="set-id-plan"><span className={`adm-tier adm-tier-${me?.tier}`}>{ent?.label ?? '—'}</span></div>
                </div>
              </div>
              <div className="set-card">
                <div className="set-row"><span className="set-k">Email</span><span className="set-v">{email}</span></div>
                <div className="set-row"><span className="set-k">Plan</span><span className="set-v">{ent?.label ?? '—'}</span></div>
                <div className="set-row"><span className="set-k">Ink remaining</span><span className="set-v">{remaining === Infinity ? 'Unlimited' : `${remaining} of ${cap}`}</span></div>
              </div>
              <button className="set-signout" onClick={signOut}>Sign out</button>
            </div>
          )}

          {section === 'billing' && (
            <div className="set-body">
              <div className="set-card">
                <div className="set-plan-top">
                  <div>
                    <div className="set-k">Current plan</div>
                    <div className="set-plan-name">{ent?.label ?? '—'}</div>
                    <div className="set-plan-price">{price == null ? 'Free' : `${CURRENCY}${price} / month`}</div>
                    {me?.subscriptionStatus && me.subscriptionStatus !== 'active' && <div className="set-plan-status">status: {me.subscriptionStatus}</div>}
                    {periodEnd && <div className="set-plan-status">{me?.subscriptionStatus === 'canceled' ? 'ends' : 'renews'} {periodEnd}</div>}
                  </div>
                  <div className="set-plan-actions">
                    {me?.hasSubscription
                      ? <button className="set-btn primary" disabled={busy} onClick={manage}>{busy ? 'Opening…' : 'Manage & invoices'}</button>
                      : me?.tier === 'studio'
                        ? <span className="set-toptier">Top tier</span>
                        : <Link href="/pricing" className="set-btn primary" onClick={() => setOpen(false)}>Upgrade</Link>}
                  </div>
                </div>
              </div>
              {err && <p className="set-err">{err}</p>}
              <Link href="/pricing" className="set-link" onClick={() => setOpen(false)}>See all plans →</Link>
            </div>
          )}

          {section === 'usage' && (
            <div className="set-body">
              <div className="set-card">
                <div className="set-usage-top">
                  <span className="set-k">Ink this period</span>
                  <span className="set-usage-pct">{finite ? `${pct}% used` : 'Unlimited'}</span>
                </div>
                <div className="set-usage-count">{used}{finite ? ` / ${cap}` : ''}</div>
                {finite && <div className="usage-bar"><div className="usage-fill" style={{ width: `${pct}%` }} /></div>}
                <div className="set-usage-sub">Resets on {resetDate}{finite ? ` · ${remaining} left` : ''}</div>
              </div>
              {me?.tier !== 'studio' && <Link href="/pricing" className="set-link" onClick={() => setOpen(false)}>Need more? See plans →</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
