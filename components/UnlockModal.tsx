'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMe, startCheckout } from '@/lib/use-billing';
import { STAGE_VALUE } from '@/lib/unlock';
import { priceFor, entitlementsFor, CURRENCY } from '@/lib/entitlements';
import { announcePopout, onPopout } from '@/lib/popout';
import type { StageKey } from '@/lib/nodeTypes';

// The value-selling gate a free user hits when they reach for a paid stage.
// One tap upgrades them to Studio (the next tier) and unlocks the whole line —
// no free trial. Opened via openUnlock(stage). Techpack-style slide-in drawer;
// only one popout shows at a time (see lib/popout).
export default function UnlockModal() {
  const me = useMe();
  const [stage, setStage] = useState<StageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const show = (e: Event) => {
      setErr(null); setBusy(false);
      setStage((e as CustomEvent).detail as StageKey);
      announcePopout('unlock');
    };
    window.addEventListener('lk-unlock', show);
    return () => window.removeEventListener('lk-unlock', show);
  }, []);

  // close if another popout opens (one at a time)
  useEffect(() => onPopout('unlock', () => setStage(null)), []);

  useEffect(() => {
    if (!stage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStage(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  if (!stage) return null;

  const value = STAGE_VALUE[stage];
  const studioPrice = priceFor('studio', 'monthly');
  const starter = entitlementsFor('studio');
  const studioGens = starter.generations;
  const starterLabel = starter.label; // "Starter"

  const upgrade = async () => {
    setBusy(true); setErr(null);
    const error = await startCheckout('studio', 'monthly');
    if (error) { setErr(error); setBusy(false); } // else redirects to Stripe
  };

  return (
    <>
      <div className="popout-catch" onClick={() => setStage(null)} />
      <aside className="popout open" role="dialog" aria-modal="true" aria-labelledby="ul-title">
        <div className="tp-head">
          <span>Unlock</span>
          <button className="sp-x" onClick={() => setStage(null)} aria-label="Close">×</button>
        </div>

        <div className="po-body">
          <span className="po-kicker">Unlock the production line</span>
          <h2 className="po-title" id="ul-title">{value?.title ?? 'The full production line'}</h2>
          <p className="po-lead">{value?.blurb ?? 'Take your design all the way from idea to shipment.'}</p>

          <div className="po-tier">
            <div className="po-tier-head">
              <span className="po-tier-name">{starterLabel}</span>
              <span className="po-tier-price">
                {studioPrice != null ? <><strong>{CURRENCY}{studioPrice}</strong><span>/mo</span></> : null}
              </span>
            </div>
            <ul className="po-perks">
              <li>Extract · pattern · tech pack · sample · manufacture · ship</li>
              <li>Unlimited projects, nodes &amp; regenerations</li>
              <li>{studioGens.toLocaleString()} generations a month</li>
            </ul>
          </div>

          {err && <p className="po-err">{err}</p>}
        </div>

        <div className="tp-foot tp-foot-row">
          <Link className="tp-export" href="/pricing" onClick={() => setStage(null)}>Compare plans</Link>
          <button className="sp-done" onClick={upgrade} disabled={busy}>
            {busy ? 'Redirecting…' : `Upgrade to ${starterLabel}`}
          </button>
        </div>
      </aside>
    </>
  );
}
