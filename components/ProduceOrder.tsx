'use client';

import { useState } from 'react';
import {
  type Order, type OrderMode, PRODUCTION_STAGES, orderProgress, currentStageLabel, isComplete,
  recordOutreach, applyReply,
} from '@/lib/order';
import type { Address } from '@/lib/sample';
import { loadSavedAddress, saveAddress, addressValid } from '@/lib/saved-address';
import { hasStripe } from '@/lib/stripe-client';
import StripePayForm from '@/components/StripePayForm';

// The on-canvas "place order → pay → live progress" block, shared by the sample
// and bulk (Produce) flows. Payment happens right here — no redirect. With a
// Stripe publishable key it's a REAL in-canvas charge (card typed here or the
// saved card on the account); without one it falls back to a SIMULATED charge
// (no money) so the whole flow stays usable.
const HAS_STRIPE = hasStripe();

const usd = (n: number) => '$' + n.toLocaleString('en-US');
const newId = () => 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function ProduceOrder({
  mode, amount, qty, product, manufacturer, order, address, hasShipNode, onOrder, onShip,
}: {
  mode: OrderMode;
  amount: number;
  qty: number;
  product?: string;
  manufacturer: { id: string; name: string; location: string; email?: string; whatsapp?: string };
  order?: Order;
  address?: Address; // collected by the parent (sample flow) — skips the built-in form
  hasShipNode?: boolean;
  onOrder: (o: Order) => void;
  onShip: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState({ number: '', exp: '', cvc: '' });

  // delivery address — typed once at checkout, remembered & pre-filled after.
  // If the parent already collected one (sample flow), use that and hide the form.
  const [innerAddr, setInnerAddr] = useState<Address>(() => loadSavedAddress());
  const addr = address ?? innerAddr;
  const setA = (patch: Partial<Address>) => setInnerAddr((a) => ({ ...a, ...patch }));
  const addrOk = addressValid(addr);

  // liaison agent state
  const [email, setEmail] = useState(manufacturer.email ?? '');
  const [whatsapp, setWhatsapp] = useState(manufacturer.whatsapp ?? '');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ email?: string; whatsapp?: string; draft?: string } | null>(null);
  const [reply, setReply] = useState('');
  const [parsing, setParsing] = useState(false);
  const [liaisonErr, setLiaisonErr] = useState<string | null>(null);

  const contactManufacturer = async () => {
    if (!order) return;
    setLiaisonErr(null); setSending(true);
    try {
      const r = await fetch('/api/liaison/send', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ manufacturerName: order.manufacturerName, product, mode: order.mode, qty: order.qty, email, whatsapp, channel }),
      });
      const j = await r.json();
      if (!r.ok) { setLiaisonErr(j.error || 'Could not reach manufacturer'); setSending(false); return; }
      const chans: string[] = [];
      if (j.email?.status === 'sent') chans.push('email'); else if (j.email?.status === 'queued') chans.push('email (queued)');
      if (j.whatsapp?.status === 'sent') chans.push('WhatsApp'); else if (j.whatsapp?.status === 'queued') chans.push('WhatsApp (queued)');
      setSent({ email: j.email?.status, whatsapp: j.whatsapp?.status, draft: j.draft?.body });
      onOrder(recordOutreach(order, `Liaison agent contacted ${order.manufacturerName}${chans.length ? ` via ${chans.join(' + ')}` : ''}.`, Date.now()));
    } catch { setLiaisonErr('Could not reach manufacturer'); }
    setSending(false);
  };

  const logReply = async () => {
    if (!order || !reply.trim()) return;
    setLiaisonErr(null); setParsing(true);
    try {
      const r = await fetch('/api/liaison/parse', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reply }),
      });
      const j = await r.json();
      if (!r.ok) { setLiaisonErr(j.error || 'Could not read reply'); setParsing(false); return; }
      onOrder(applyReply(order, j.parsed, Date.now()));
      setReply('');
    } catch { setLiaisonErr('Could not read reply'); }
    setParsing(false);
  };

  // Build + persist the order once payment succeeds (real Stripe or simulated).
  const createOrder = (paymentRef: string, simulated: boolean) => {
    saveAddress(addr); // remember it for next time
    onOrder({
      id: newId(), mode, manufacturerId: manufacturer.id, manufacturerName: manufacturer.name,
      location: manufacturer.location, qty, amount, currency: 'usd', ship: addr,
      status: 'paid', stageIndex: 0, updates: [], paymentRef, simulated,
      createdAt: new Date().toISOString(), nextTickAt: Date.now() + 2500,
    });
  };

  // SIMULATED charge (used only when no publishable key is configured).
  const paySimulated = async () => {
    setErr(null);
    if (!addrOk) { setErr('Enter a delivery address'); return; }
    if (card.number.replace(/\s/g, '').length < 12) { setErr('Enter a card number'); return; }
    setPaying(true);
    await new Promise((r) => setTimeout(r, 900)); // mimic the charge round-trip
    createOrder('sim', true);
    setPaying(false);
  };

  // ---- ordered: live production progress -------------------------------------
  if (order) {
    const pct = Math.round(orderProgress(order) * 100);
    const complete = isComplete(order);
    return (
      <div className="po-order">
        <div className="po-order-head">
          <span className="po-order-title">{order.mode === 'bulk' ? 'Bulk order' : 'Sample order'}</span>
          <span className="po-order-amt">{usd(order.amount)} paid{order.simulated ? ' · sim' : ''}</span>
        </div>
        <div className="po-order-sub">
          {order.manufacturerName} · {order.qty} {order.qty === 1 ? 'unit' : 'units'}
          {order.factoryOrderNo && <> · order {order.factoryOrderNo}</>}
        </div>

        <div className="po-prog">
          <div className="po-prog-top">
            <span>{currentStageLabel(order)}</span>
            <span>{pct}%</span>
          </div>
          <div className="po-prog-track"><div className="po-prog-fill" style={{ width: `${pct}%` }} /></div>
          <div className="po-stages">
            {PRODUCTION_STAGES.map((s, i) => (
              <span key={s.key} className={`po-stage${i < order.stageIndex ? ' done' : ''}${i === order.stageIndex ? ' on' : ''}`}>{s.label}</span>
            ))}
          </div>
        </div>

        {order.updates.length > 0 && (
          <div className="po-updates">
            <div className="po-updates-h">Manufacturer updates</div>
            {[...order.updates].reverse().slice(0, 5).map((u, i) => (
              <div className="po-update" key={i}><span className="po-update-dot" />{u.text}</div>
            ))}
          </div>
        )}

        {!isComplete(order) && (
          <div className="po-liaison">
            <div className="po-updates-h">Liaison agent</div>
            {!order.engaged ? (
              <>
                <div className="po-chan">
                  {(['email', 'whatsapp', 'both'] as const).map((c) => (
                    <button key={c} className={channel === c ? 'on' : ''} onClick={() => setChannel(c)}>
                      {c === 'both' ? 'Both' : c === 'email' ? 'Email' : 'WhatsApp'}
                    </button>
                  ))}
                </div>
                {(channel === 'email' || channel === 'both') && (
                  <input className="po-liaison-in" placeholder="Manufacturer email" value={email} onChange={(e) => setEmail(e.target.value)} />
                )}
                {(channel === 'whatsapp' || channel === 'both') && (
                  <input className="po-liaison-in" placeholder="WhatsApp number (+8613…)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
                )}
                <button className="mf-select on" disabled={sending} onClick={contactManufacturer}>
                  {sending ? 'Drafting & sending…' : 'Contact manufacturer'}
                </button>
              </>
            ) : (
              <div className="po-ship-done">Agent engaged. Log the manufacturer&apos;s replies below and it advances the order.</div>
            )}
            {sent?.draft && (
              <details className="po-draft"><summary>View the message the agent sent</summary><pre>{sent.draft}</pre></details>
            )}
            <div className="po-reply">
              <textarea placeholder="Paste the manufacturer's reply…" value={reply} onChange={(e) => setReply(e.target.value)} rows={2} />
              <button className="mf-select" disabled={parsing || !reply.trim()} onClick={logReply}>
                {parsing ? 'Reading…' : 'Log reply → advance'}
              </button>
            </div>
            {liaisonErr && <div className="po-pay-err">{liaisonErr}</div>}
          </div>
        )}

        {complete && (
          order.status === 'shipped' || order.status === 'shipping' ? (
            <div className="po-ship-done">Handed off to shipping{order.trackingNumber ? ` · ${order.carrier ?? 'Tracking'} ${order.trackingNumber}` : ''}.</div>
          ) : hasShipNode ? (
            <button className="mf-select on" onClick={onShip}>Production complete — ship it →</button>
          ) : (
            <div className="po-ship-done">Production complete. Connect a Ship node to send it out.</div>
          )
        )}
      </div>
    );
  }

  // ---- not ordered yet: the on-canvas payment step ---------------------------
  return (
    <div className="po-pay">
      <div className="po-pay-head">
        <span>Place {mode === 'bulk' ? 'bulk order' : 'sample order'}</span>
        <span className="po-pay-amt">{usd(amount)}</span>
      </div>
      <div className="po-pay-sub">{manufacturer.name} · {qty} {qty === 1 ? 'unit' : 'units'}{mode === 'bulk' ? ' (MOQ)' : ''}</div>

      {/* deliver-to — typed once, remembered & pre-filled next time.
          Hidden when the parent (sample flow) already collected it. */}
      {!address && (
        <div className="po-ship">
          <div className="po-ship-h">Deliver to</div>
          <div className="smpl-addr">
            <input className="tp-in" placeholder="Full name" value={addr.name} onChange={(e) => setA({ name: e.target.value })} />
            <input className="tp-in" placeholder="Address" value={addr.line1} onChange={(e) => setA({ line1: e.target.value })} />
            <div className="smpl-addr-row">
              <input className="tp-in" placeholder="City" value={addr.city} onChange={(e) => setA({ city: e.target.value })} />
              <input className="tp-in" placeholder="Postcode" value={addr.postcode} onChange={(e) => setA({ postcode: e.target.value })} />
            </div>
            <input className="tp-in" placeholder="Country" value={addr.country} onChange={(e) => setA({ country: e.target.value })} />
          </div>
        </div>
      )}

      {!addrOk ? (
        <div className="po-pay-fine">{address ? 'Add a delivery address on the sample screen to continue.' : 'Enter a delivery address to continue to payment.'}</div>
      ) : HAS_STRIPE ? (
        <StripePayForm amount={amount} mode={mode} manufacturerName={manufacturer.name} onPaid={(piId) => createOrder(piId, false)} />
      ) : (
        <>
          <div className="po-pay-note">Simulated payment — no card is charged until a live Stripe key is connected.</div>
          <div className="po-card">
            <input className="po-card-num" inputMode="numeric" placeholder="Card number" value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })} />
            <div className="po-card-row">
              <input inputMode="numeric" placeholder="MM / YY" value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} />
              <input inputMode="numeric" placeholder="CVC" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
            </div>
          </div>
          {err && <div className="po-pay-err">{err}</div>}
          <button className="po-buy" disabled={paying} onClick={paySimulated}>
            {paying ? 'Charging…' : `Pay ${usd(amount)} & order`}
          </button>
          <div className="po-pay-fine">Secured by Stripe · LOHO KUR handles the factory relationship.</div>
        </>
      )}
    </div>
  );
}
