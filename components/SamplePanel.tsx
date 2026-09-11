'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Techpack } from '@/lib/techpack';
import { briefFromTechpack, samplersFor, complexity } from '@/lib/manufacturers';
import { samplePrice } from '@/lib/pricing';
import { type Sample, type Address, defaultSample } from '@/lib/sample';
import { loadSavedAddress } from '@/lib/saved-address';
import type { Order } from '@/lib/order';
import ProduceOrder from '@/components/ProduceOrder';

const heroOf = (tp: Partial<Techpack>) => tp.mockups?.front ?? tp.flats?.front ?? tp.references?.[0];

export default function SamplePanel({
  open, techpack, techpacks, value, hasShipNode, order, onChange, onOrder, onShip, onClose, toggle,
}: {
  open: boolean;
  techpack?: Partial<Techpack>;
  techpacks?: Techpack[];
  value?: Sample;
  hasShipNode?: boolean;
  order?: Order;
  onChange: (s: Sample) => void;
  onOrder?: (o: Order) => void;
  onShip?: () => void;
  onClose: () => void;
  toggle?: ReactNode;
}) {
  const sample = value ?? defaultSample();
  const usd = (n: number) => '$' + n.toLocaleString('en-US');

  // every piece wired into the produce node — always at least one cart line
  const products = useMemo<Partial<Techpack>[]>(
    () => (techpacks && techpacks.length ? techpacks : techpack ? [techpack] : [{}]),
    [techpacks, techpack],
  );
  const multi = products.length > 1;
  const briefs = useMemo(() => products.map((p) => briefFromTechpack(p)), [products]);
  const samplers = useMemo(() => samplersFor(briefs[0]), [briefs]);
  // our piece's render + its vectorized flats — shown as cards on the factory photo
  const overlayImgs = useMemo<string[]>(() => {
    const imgs: string[] = [];
    for (const p of products) {
      const render = p.mockups?.front ?? p.references?.[0];
      if (render && !imgs.includes(render)) imgs.push(render);
      for (const v of Object.values(p.flats ?? {})) if (typeof v === 'string' && v && !imgs.includes(v)) imgs.push(v);
    }
    return imgs.slice(0, 3);
  }, [products]);
  const prodName = products.length === 1 && products[0]?.name && products[0].name !== 'Untitled garment' ? products[0].name : null;

  const nameOf = (tp: Partial<Techpack>, i: number) => (tp.name && tp.name !== 'Untitled garment' ? tp.name : multi ? `Piece ${i + 1}` : 'your design');
  const pk = (tp: Partial<Techpack>, i: number) => `${(tp.name ?? '').trim() || 'item'}#${i}`;

  const chosen = samplers.find((q) => q.id === sample.samplerId);

  // per-product quantity (checkout style), defaulting to 1
  const qtyOf = (i: number) => sample.qtys?.[pk(products[i], i)] ?? 1;
  const setQty = (i: number, n: number) => {
    const clamped = Math.max(1, Math.min(20, n));
    onChange({ ...sample, qtys: { ...(sample.qtys ?? {}), [pk(products[i], i)]: clamped } });
  };
  // loss-proof per-piece sample price, ×quantity, summed
  const unitPrice = (i: number, q: (typeof samplers)[number]) => samplePrice(q.sampleBase * complexity(briefs[i]));
  const orderTotal = (q: (typeof samplers)[number]) => products.reduce((sum, _p, i) => sum + unitPrice(i, q) * qtyOf(i), 0);
  const totalQty = products.reduce((s, _p, i) => s + qtyOf(i), 0);

  // Estimated breakdown of what the sample price pays for. The percentages are a
  // representative allocation of a cut-and-sew sample; shipping is the balance so
  // the parts always add up to exactly what's charged.
  const breakdown = (total: number) => {
    const parts = [
      { label: 'Materials & trims', pct: 0.34 },
      { label: 'Pattern & cutting', pct: 0.18 },
      { label: 'Labour & finishing', pct: 0.33 },
    ];
    const rows = parts.map((c) => ({ label: c.label, amount: Math.round(total * c.pct) }));
    const shipping = total - rows.reduce((s, r) => s + r.amount, 0);
    return [...rows, { label: 'Shipping', amount: shipping }];
  };

  const set = (patch: Partial<Sample>) => onChange({ ...sample, ...patch });
  const [addr, setAddr] = useState<Address>(() => {
    const a = value?.address;
    return a && (a.line1 || a.city || a.name) ? a : loadSavedAddress();
  });
  const setA = (patch: Partial<Address>) => { const next = { ...addr, ...patch }; setAddr(next); onChange({ ...sample, address: next }); };

  // keyless address autocomplete (Photon / OpenStreetMap — no API key)
  const [sug, setSug] = useState<{ label: string; line1: string; city: string; postcode: string; country: string }[]>([]);
  const sugTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchAddr = (query: string) => {
    clearTimeout(sugTimer.current);
    if (query.trim().length < 4) { setSug([]); return; }
    sugTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`);
        const j = await r.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items = ((j.features ?? []) as any[]).map((f) => {
          const p = f.properties ?? {};
          const line1 = [p.housenumber, p.street ?? p.name].filter(Boolean).join(' ');
          const city = p.city ?? p.town ?? p.village ?? p.county ?? '';
          const label = [line1, city, p.country].filter(Boolean).join(', ');
          return { label, line1, city, postcode: p.postcode ?? '', country: p.country ?? '' };
        }).filter((x) => x.label && x.line1);
        setSug(items);
      } catch { setSug([]); }
    }, 300);
  };

  const choose = (q: (typeof samplers)[number]) => {
    set({ samplerId: q.id, samplerName: q.name, samplerLocation: q.location, sampleCost: q.sampleCost, leadDays: q.leadDays });
    try { localStorage.setItem('lk-sampler', q.id); } catch { /* ignore */ }
    setTimeout(() => setStep(2), 480); // picked → glide to the last step
  };

  const [expanded, setExpanded] = useState<string | null>(null); // maker whose "more info" is open
  const [step, setStep] = useState(0); // wizard step: 0 your pieces · 1 who makes it · 2 deliver & pay
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) { setEntered(false); return; }
    setStep(0); // start each open at step 1
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, [open]);

  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose(); };
    const raf = requestAnimationFrame(() => document.addEventListener('pointerdown', onDown, true));
    return () => { cancelAnimationFrame(raf); document.removeEventListener('pointerdown', onDown, true); };
  }, [open, onClose]);

  // pre-select the recommended (or last-used) maker so a first-timer can just tap Next
  useEffect(() => {
    if (sample.samplerId || !samplers.length) return;
    let pick = samplers.find((s) => s.recommended) ?? samplers[0];
    try { const last = localStorage.getItem('lk-sampler'); const m = last ? samplers.find((s) => s.id === last) : undefined; if (m) pick = m; } catch { /* ignore */ }
    onChange({ ...sample, samplerId: pick.id, samplerName: pick.name, samplerLocation: pick.location, sampleCost: pick.sampleCost, leadDays: pick.leadDays });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samplers, sample.samplerId]);

  // once the address (name + line + city + country) is filled, glide down to checkout
  const payRef = useRef<HTMLDivElement>(null);
  const addrValid = !!(addr.name.trim() && addr.line1.trim() && addr.city.trim() && addr.country.trim());
  useEffect(() => {
    if (step !== 2 || !addrValid) return;
    const t = setTimeout(() => payRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 260);
    return () => clearTimeout(t);
  }, [step, addrValid]);

  return (
    <aside ref={panelRef} className={`mfpanel mfpanel-paper${entered ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Produce</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      {toggle}

      {order ? (
        <div className="mf-list">
          <ProduceOrder
            mode="sample"
            amount={order.amount}
            qty={order.qty}
            product={multi ? `${products.length} pieces` : nameOf(products[0], 0)}
            manufacturer={{ id: order.manufacturerId, name: order.manufacturerName, location: order.location }}
            order={order}
            hasShipNode={hasShipNode}
            onOrder={onOrder ?? (() => {})}
            onShip={onShip ?? (() => {})}
          />
        </div>
      ) : (
        <>
          {/* wizard progress */}
          <div className="wiz-steps">
            {['Your pieces', 'Who makes it', 'Deliver & pay'].map((label, i) => (
              <div key={label} className={`wiz-step${i === step ? ' on' : ''}${i < step ? ' done' : ''}`}>
                <span className="wiz-dot">{i < step ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg> : i + 1}</span>
                <span className="wiz-label">{label}</span>
              </div>
            ))}
          </div>

          <div className="mf-list wiz-body" key={step}>
            {step === 0 && (
              <>
            {/* what you're making + how many — a checkout line per connected piece */}
            <div className="smpl-sec-h">Your samples</div>
            <div className="pp-cart">
              {products.map((p, i) => {
                const img = heroOf(p);
                const q = qtyOf(i);
                return (
                  <div className="pp-cart-row" key={pk(p, i)}>
                    <div className="pp-cart-img">{img ? <img src={img} alt={nameOf(p, i)} /> : <span>{i + 1}</span>}</div>
                    <div className="pp-cart-info">
                      <span className="pp-cart-name">{nameOf(p, i)}</span>
                      <span className="pp-cart-sub">sample{chosen ? ` · ${usd(unitPrice(i, chosen))} each` : ''}</span>
                    </div>
                    <div className="pp-stepper">
                      <button onClick={() => setQty(i, q - 1)} disabled={q <= 1} aria-label="less">−</button>
                      <span>{q}</span>
                      <button onClick={() => setQty(i, q + 1)} aria-label="more">+</button>
                    </div>
                    {chosen && <span className="pp-cart-line">{usd(unitPrice(i, chosen) * q)}</span>}
                  </div>
                );
              })}
            </div>

            {/* where the money goes — materials, pattern, labour, then shipping */}
            {chosen && (
              <div className="pp-cost">
                <div className="pp-cost-h">Estimated cost</div>
                {breakdown(orderTotal(chosen)).map((r) => (
                  <div className="pp-cost-row" key={r.label}><span>{r.label}</span><span>{usd(r.amount)}</span></div>
                ))}
                <div className="pp-cost-row pp-cost-total"><span>Total</span><span>{usd(orderTotal(chosen))}</span></div>
              </div>
            )}

            {/* what's included — official, reassuring, nothing else to figure out */}
            <div className="pp-included">
              <span className="pp-included-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M8.5 12h7M8.5 15.5h4.5" /></svg>
              </span>
              <span className="pp-included-body">
                <span className="pp-included-title">{prodName ? `${prodName}: tech pack included` : 'Full tech pack included'}
                  <svg className="pp-included-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                </span>
                <span className="pp-included-sub">Its measurements, materials, colourways &amp; construction — factory-ready, in every sample.</span>
              </span>
            </div>
              </>
            )}

            {step === 1 && (
              <>
            {/* who makes it — pick one like sweets, low-pressure */}
            <div className="smpl-sec-h">Who makes it</div>
            <div className="pp-makers">
              {samplers.map((q) => {
                const on = sample.samplerId === q.id;
                const hasInfo = !!(q.about || q.ethics || q.vetted);
                return (
                  <div key={q.id} className={`pp-maker-card${on ? ' on' : ''}`}>
                    <button className="pp-maker-select" onClick={() => choose(q)} aria-pressed={on}>
                      {on && <span className="pp-maker-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg></span>}
                      {q.photos && q.photos.length > 0 && (
                        <span className="pp-maker-hero">
                          <img className="pp-maker-factory" src={q.photos[0]} alt="" loading="lazy" />
                          {overlayImgs.length > 0 && (
                            <span className="pp-maker-overlay">
                              {overlayImgs.map((src, k) => (
                                <span className="pp-mini-card" key={k}><img src={src} alt="" /></span>
                              ))}
                            </span>
                          )}
                        </span>
                      )}
                      <span className="pp-maker-row">
                        <span className="pp-maker-name">{q.name}{q.recommended && <em>Recommended</em>}</span>
                        <span className="pp-maker-price">{usd(orderTotal(q))}</span>
                      </span>
                      <span className="pp-maker-stats">
                        <span className="pp-stat"><span className="pp-stat-k">Location</span><span className="pp-stat-v">{q.location}</span></span>
                        <span className="pp-stat"><span className="pp-stat-k">Est. lead time</span><span className="pp-stat-v">~{q.leadDays} days</span></span>
                      </span>
                    </button>

                    {hasInfo && (
                      <>
                        <button className="pp-maker-more" onClick={() => setExpanded(expanded === q.id ? null : q.id)} aria-expanded={expanded === q.id}>
                          {q.vetted && (
                            <span className="pp-vetted"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.5 1.8 3-.2 1 2.8 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-1 2.8-3-.2L12 22l-2.5-1.8-3 .2-1-2.8L3.1 16 4 13.1 3.1 10.2 5.5 8.4l1-2.8 3 .2z" /><path d="M8.5 12.2l2.4 2.4 4.6-4.8" /></svg>Vetted by LOHO KUR</span>
                          )}
                          <span className="pp-more-toggle">More info<svg viewBox="0 0 24 24" className={expanded === q.id ? 'open' : ''} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg></span>
                        </button>
                        {expanded === q.id && (
                          <div className="pp-maker-info">
                            {q.about && <p><span className="pp-info-k">About</span>{q.about}</p>}
                            {q.ethics && <p><span className="pp-info-k">Ethics &amp; vetting</span>{q.ethics}</p>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
              </>
            )}

            {step === 2 && (
              <>
            {/* what you're getting — a compact recap above the step */}
            <div className="pp-recap">
              {products.map((p, i) => {
                const img = heroOf(p);
                return (
                  <div className="pp-recap-item" key={pk(p, i)}>
                    <div className="pp-recap-img">{img ? <img src={img} alt="" /> : <span>{i + 1}</span>}</div>
                    <span className="pp-recap-name">{nameOf(p, i)}</span>
                    <span className="pp-recap-qty">×{qtyOf(i)}</span>
                  </div>
                );
              })}
            </div>

            {/* deliver + pay — the final step */}
            <div className="smpl-sec-h">Deliver &amp; pay</div>
            <div className="smpl-addr">
              <input className="tp-in" placeholder="Full name" autoComplete="name" value={addr.name} onChange={(e) => setA({ name: e.target.value })} />
              <div className="pp-addr-field">
                <input
                  className="tp-in"
                  placeholder="Start typing your address…"
                  autoComplete="address-line1"
                  value={addr.line1}
                  onChange={(e) => { setA({ line1: e.target.value }); searchAddr(e.target.value); }}
                  onBlur={() => setTimeout(() => setSug([]), 150)}
                />
                {sug.length > 0 && (
                  <div className="pp-sug">
                    {sug.map((s, k) => (
                      <button
                        key={k}
                        type="button"
                        className="pp-sug-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setA({ line1: s.line1, city: s.city, postcode: s.postcode, country: s.country }); setSug([]); }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="smpl-addr-row">
                <input className="tp-in" placeholder="City" autoComplete="address-level2" value={addr.city} onChange={(e) => setA({ city: e.target.value })} />
                <input className="tp-in" placeholder="Postcode" autoComplete="postal-code" value={addr.postcode} onChange={(e) => setA({ postcode: e.target.value })} />
              </div>
              <input className="tp-in" placeholder="Country" autoComplete="country-name" value={addr.country} onChange={(e) => setA({ country: e.target.value })} />
            </div>

            {/* payment — appears inline once a maker is picked (same as bulk) */}
            {chosen && (
              <div ref={payRef}>
              <ProduceOrder
                mode="sample"
                amount={orderTotal(chosen)}
                qty={totalQty}
                product={multi ? `${products.length} pieces` : nameOf(products[0], 0)}
                manufacturer={{ id: chosen.id, name: chosen.name, location: chosen.location }}
                address={addr}
                hasShipNode={hasShipNode}
                onOrder={onOrder ?? (() => {})}
                onShip={onShip ?? (() => {})}
              />

              {/* trust row — kill payment anxiety */}
              <div className="pp-trust">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3.5zm-1.2 14.2-3.3-3.3 1.4-1.4 1.9 1.9 4.4-4.4 1.4 1.4-5.8 5.8z" /></svg>
                <span>Secured by Stripe — we never see your card details.</span>
              </div>
              </div>
            )}
              </>
            )}
          </div>

          <div className="tp-foot wiz-foot">
            {step > 0 && <button className="wiz-back" onClick={() => setStep(step - 1)}>← Back</button>}
            {step < 2 && (
              <button className="wiz-next" onClick={() => setStep(step + 1)} disabled={step === 1 && !chosen}>
                {step === 0 ? 'Pick who makes it' : 'Deliver & pay'} →
              </button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
