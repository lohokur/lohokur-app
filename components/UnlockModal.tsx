'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe, startTrial, startCheckout, notifyGenUsed } from '@/lib/use-billing';
import { STAGE_VALUE } from '@/lib/unlock';
import { priceFor } from '@/lib/entitlements';
import { TRIAL_DAYS } from '@/lib/trial';
import type { StageKey } from '@/lib/nodeTypes';

// The value-selling gate a free user hits when they reach for a paid stage.
// If they haven't used their trial → one-tap 7-day free trial (unlocks the whole
// line, no card). If they have → upgrade to Studio. Opened via openUnlock(stage).
export default function UnlockModal() {
  const me = useMe();
  const [stage, setStage] = useState<StageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const show = (e: Event) => {
      setErr(null); setBusy(false); setStarted(false);
      setStage((e as CustomEvent).detail as StageKey);
    };
    window.addEventListener('lk-unlock', show);
    return () => window.removeEventListener('lk-unlock', show);
  }, []);

  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStage(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  if (!stage) return null;

  const value = STAGE_VALUE[stage];
  const canTrial = !me?.trialUsed;         // never trialed → offer the free trial
  const studioPrice = priceFor('studio', 'monthly');

  const beginTrial = async () => {
    setBusy(true); setErr(null);
    const { error, upgrade } = await startTrial();
    if (error) {
      if (upgrade) { await startCheckout('studio', 'monthly'); return; } // trial spent → checkout
      setErr(error); setBusy(false); return;
    }
    notifyGenUsed(); // refresh entitlements so the line unlocks immediately
    setBusy(false); setStarted(true);
    setTimeout(() => setStage(null), 1400); // let the confirmation land, then reveal the unlocked canvas
  };

  const upgrade = async () => {
    setBusy(true); setErr(null);
    const error = await startCheckout('studio', 'monthly');
    if (error) { setErr(error); setBusy(false); } // else redirects to Stripe
  };

  return (
    <div className="pw-scrim" onClick={() => setStage(null)}>
      <div className="pw-card unlock" onClick={(e) => e.stopPropagation()}>
        {started ? (
          <div className="ul-done">
            <span className="ul-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg></span>
            <h2 className="pw-title">Trial started</h2>
            <p className="pw-body">The full production line is open for {TRIAL_DAYS} days. Picking up where you left off…</p>
          </div>
        ) : (
          <>
            <span className="ul-kicker">{canTrial ? 'Unlock the production line' : 'Upgrade to continue'}</span>
            <h2 className="pw-title">{value?.title ?? 'The full production line'}</h2>
            <p className="pw-body">{value?.blurb ?? 'Take your design all the way from idea to shipment.'}</p>

            <ul className="ul-list">
              <li>Extract · pattern · tech pack</li>
              <li>Sample · manufacture · ship</li>
              <li>1,000 generations a month</li>
            </ul>

            {err && <p className="pw-err">{err}</p>}

            <div className="pw-actions">
              {canTrial ? (
                <button className="pw-primary" onClick={beginTrial} disabled={busy}>
                  {busy ? 'Starting…' : `Start your ${TRIAL_DAYS}-day free trial`}
                </button>
              ) : (
                <button className="pw-primary" onClick={upgrade} disabled={busy}>
                  {busy ? 'Redirecting…' : `Upgrade to Studio — £${studioPrice}/mo`}
                </button>
              )}
              {canTrial && <p className="ul-fine">No card required. Free for {TRIAL_DAYS} days, then £{studioPrice}/mo if you keep it.</p>}
              <div className="pw-secondary">
                <Link href="/pricing" onClick={() => setStage(null)}>See all plans →</Link>
                <button className="pw-dismiss" onClick={() => setStage(null)}>Not now</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
