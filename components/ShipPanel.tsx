'use client';

import { useEffect, useRef, useState } from 'react';
import type { Techpack } from '@/lib/techpack';

type Tracking = { number: string; carrier: string; orderNo?: string };

// Ship node — reserved for handing a run to a 3PL fulfilment partner. Not live
// yet (coming soon). Delivery addresses are collected at produce checkout, so
// this node doesn't ask for one. It still surfaces tracking once an order ships.
export default function ShipPanel({
  open, techpack, tracking, onClose,
}: {
  open: boolean;
  techpack?: Partial<Techpack>;
  tracking?: Tracking;
  onClose: () => void;
}) {
  const name = techpack?.name && techpack.name !== 'Untitled garment' ? techpack.name : 'your product';
  const hero = techpack?.mockups?.front ?? techpack?.flats?.front ?? techpack?.references?.[0];

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) { setEntered(false); return; }
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const raf = requestAnimationFrame(() => document.addEventListener('pointerdown', onDown, true));
    return () => { cancelAnimationFrame(raf); document.removeEventListener('pointerdown', onDown, true); };
  }, [open, onClose]);

  return (
    <aside ref={panelRef} className={`mfpanel mfpanel-paper${entered ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Ship</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="pp-hero">
        <div className="pp-hero-img">
          {hero ? <img src={hero} alt={name} /> : <span>preview</span>}
        </div>
        <div className="pp-hero-txt">
          <span className="pp-hero-kicker">Fulfilment</span>
          <span className="pp-hero-name">{name}</span>
          <span className="pp-hero-sub">Hand your run to a 3PL that stores, picks and ships it for you.</span>
        </div>
      </div>

      <div className="mf-list">
        {tracking && (
          <div className="po-order">
            <div className="po-order-head">
              <span className="po-order-title">On its way</span>
              <span className="po-order-amt">{tracking.carrier}</span>
            </div>
            <div className="po-order-sub">Tracking {tracking.number}{tracking.orderNo ? ` · order ${tracking.orderNo}` : ''}</div>
          </div>
        )}

        <div className="pp-soon">
          <span className="pp-soon-tag">Coming soon</span>
          <span className="pp-soon-txt">
            Sending a full run to a 3PL fulfilment partner is coming soon. For now, delivery addresses are collected
            at checkout when you order a sample or a bulk run — no separate step needed.
          </span>
        </div>
      </div>
    </aside>
  );
}
