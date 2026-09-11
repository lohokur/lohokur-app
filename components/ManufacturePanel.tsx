'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Techpack } from '@/lib/techpack';
import { briefFromTechpack, recommendFor, type ChosenManufacturer } from '@/lib/manufacturers';
import ProduceOrder from '@/components/ProduceOrder';
import ProductStrip from '@/components/ProductStrip';
import type { Order } from '@/lib/order';

export default function ManufacturePanel({
  open,
  techpack,
  techpacks,
  chosenId,
  order,
  hasShipNode,
  onChoose,
  onOrder,
  onShip,
  onClose,
  onSwitchToSample,
  toggle,
}: {
  open: boolean;
  techpack?: Partial<Techpack>;
  techpacks?: Techpack[];
  chosenId?: string;
  order?: Order;
  hasShipNode?: boolean;
  onChoose: (m: ChosenManufacturer) => void;
  onOrder?: (o: Order) => void;
  onShip?: () => void;
  onClose: () => void;
  onSwitchToSample?: () => void;
  toggle?: ReactNode; // Produce mode switch, rendered under the header
}) {
  const brief = useMemo(() => briefFromTechpack(techpack), [techpack]);
  const quotes = useMemo(() => recommendFor(brief), [brief]);
  const chosen = quotes.find((q) => q.id === chosenId);

  const usd = (n: number) => '$' + n.toLocaleString('en-US');
  const label = brief.name && brief.name !== 'Untitled garment' ? brief.name : 'this garment';

  // mount closed, flip to open next frame so the slide-in transition runs
  // (the parent only mounts this while open, which otherwise skips the animation).
  const [entered, setEntered] = useState(false);
  // Bulk is gated behind a full-screen "we recommend a sample first" confirmation.
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (!open) { setEntered(false); setAccepted(false); return; }
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  const showGate = open && !order && !accepted;

  // same cadence as the pad / tech pack: a pointer-down on the canvas retracts it.
  // Suspended while the confirmation gate is up — the gate handles dismissal.
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || showGate) return;
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    // defer a frame so the same tap that opened the panel can't immediately close it
    const raf = requestAnimationFrame(() => document.addEventListener('pointerdown', onDown, true));
    return () => { cancelAnimationFrame(raf); document.removeEventListener('pointerdown', onDown, true); };
  }, [open, showGate, onClose]);

  return (
    <>
      <aside ref={panelRef} className={`mfpanel mfpanel-paper${entered ? ' open' : ''}`} aria-hidden={!open}>
        <div className="tp-head">
          <span>Produce</span>
          <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {toggle}

        {/* what you're making — one render, or a strip of every connected piece */}
        {techpacks && techpacks.length > 1 ? (
          <div className="pp-hero pp-hero-multi">
            <ProductStrip products={techpacks} label={`${techpacks.length} pieces connected`} />
          </div>
        ) : (
          <div className="pp-hero">
            <div className="pp-hero-img">
              {(techpack?.mockups?.front ?? techpack?.flats?.front ?? techpack?.references?.[0])
                ? <img src={techpack?.mockups?.front ?? techpack?.flats?.front ?? techpack?.references?.[0]} alt={label} />
                : <span>preview</span>}
            </div>
            <div className="pp-hero-txt">
              <span className="pp-hero-kicker">Live render from your tech pack</span>
              <span className="pp-hero-name">{label}</span>
              <span className="pp-hero-sub">Make a full run. Prices are estimates for this piece.</span>
            </div>
          </div>
        )}

        <div className="mf-list">
          {quotes.map((q) => (
            <div className={`mf-card${chosenId === q.id ? ' chosen' : ''}`} key={q.id}>
              {q.photos && q.photos.length > 0 && (
                <div className="pp-maker-imgs">
                  {q.photos.slice(0, 2).map((src, k) => <img key={k} src={src} alt="" loading="lazy" />)}
                  <span className="pp-maker-caption">Factory floor</span>
                </div>
              )}
              <div className="mf-card-top">
                <div>
                  <div className="mf-name">{q.name}{q.recommended && <span className="mf-rec">recommended</span>}</div>
                  <div className="mf-loc">{q.location} · ready in {q.leadDays} days</div>
                </div>
              </div>

              <div className="mf-costs">
                <div className="mf-cost">
                  <span className="mf-cost-k">Per unit</span>
                  <span className="mf-cost-v">{usd(q.unitCost)}</span>
                  <span className="mf-cost-s">min {q.moq} pieces</span>
                </div>
                <div className="mf-cost">
                  <span className="mf-cost-k">Full run</span>
                  <span className="mf-cost-v">{usd(q.bulkTotal)}</span>
                  <span className="mf-cost-s">{q.moq} pieces total</span>
                </div>
              </div>

              <button
                className={`mf-select${chosenId === q.id ? ' on' : ''}`}
                onClick={() => onChoose({
                  id: q.id, name: q.name, location: q.location,
                  sampleCost: q.sampleCost, unitCost: q.unitCost, moq: q.moq, leadDays: q.leadDays,
                })}
              >
                {chosenId === q.id ? 'Selected' : 'Choose this factory'}
              </button>
            </div>
          ))}

          {(order || chosen) && onOrder && onShip && (
            <ProduceOrder
              mode="bulk"
              amount={chosen?.bulkTotal ?? order?.amount ?? 0}
              qty={chosen?.moq ?? order?.qty ?? 0}
              product={[techpack?.name, techpack?.category, techpack?.fabric].filter(Boolean).join(', ')}
              manufacturer={chosen
                ? { id: chosen.id, name: chosen.name, location: chosen.location, email: chosen.email, whatsapp: chosen.whatsapp }
                : { id: order!.manufacturerId, name: order!.manufacturerName, location: order!.location }}
              order={order}
              hasShipNode={hasShipNode}
              onOrder={onOrder}
              onShip={onShip}
            />
          )}
        </div>
      </aside>

      {/* full-screen confirmation: we recommend a sample before a full run */}
      {showGate && (
        <div className="pp-gate" onClick={onClose}>
          <div className="pp-gate-card" onClick={(e) => e.stopPropagation()}>
            <div className="pp-gate-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </div>
            <h3 className="pp-gate-title">Order a sample first</h3>
            <p className="pp-gate-body">
              We strongly recommend approving one physical sample before a full production run.
              It’s far cheaper to catch fit, fabric and finish issues on a single piece than on hundreds.
            </p>
            <div className="pp-gate-btns">
              {onSwitchToSample && (
                <button className="pp-gate-sample" onClick={onSwitchToSample}>Get a sample</button>
              )}
              <button className="pp-gate-accept" onClick={() => setAccepted(true)}>I accept — continue to bulk</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
