// Production order — created when a user pays for a sample or bulk run on the
// Produce node. A (currently simulated) liaison agent advances it through the
// production stages, recording each "manufacturer update". Real manufacturer
// comms + a shipment-tracking API get wired in behind this same shape later.

import type { Address } from '@/lib/sample';

export type OrderMode = 'sample' | 'bulk';

export type OrderStatus = 'paid' | 'in_production' | 'complete' | 'shipping' | 'shipped';

// Production timeline shown as the node's progress bar / current stage.
export const PRODUCTION_STAGES: { key: string; label: string }[] = [
  { key: 'confirmed', label: 'Order confirmed' },
  { key: 'materials', label: 'Sourcing materials' },
  { key: 'sampling', label: 'Sampling' },
  { key: 'cutting', label: 'Cutting' },
  { key: 'sewing', label: 'Sewing' },
  { key: 'washing', label: 'Wash & finish' },
  { key: 'qc', label: 'Quality control' },
  { key: 'done', label: 'Production complete' },
];

export type OrderUpdate = { at: string; text: string; stageKey: string };

export type Order = {
  id: string;
  mode: OrderMode;
  manufacturerId: string;
  manufacturerName: string;
  location: string;
  qty: number;
  amount: number;          // USD total charged
  currency: 'usd';
  ship?: Address;          // delivery address collected at checkout
  status: OrderStatus;
  stageIndex: number;      // index into PRODUCTION_STAGES
  updates: OrderUpdate[];  // recorded manufacturer responses (newest last)
  paymentRef?: string;     // Stripe PaymentIntent id, or 'sim' for simulated
  simulated: boolean;      // charged for real, or a simulated (no-key) payment
  factoryOrderNo?: string; // the manufacturer's order number (for shipment tracking)
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
  nextTickAt: number;      // epoch ms the sim agent should next advance (0 = asap)
  engaged?: boolean;       // real liaison agent took over — pause the demo sim ticker
};

export const orderProgress = (o: Pick<Order, 'stageIndex'>): number =>
  Math.min(1, o.stageIndex / (PRODUCTION_STAGES.length - 1));

export const currentStageLabel = (o: Pick<Order, 'stageIndex'>): string =>
  PRODUCTION_STAGES[Math.min(o.stageIndex, PRODUCTION_STAGES.length - 1)]?.label ?? '';

export const isComplete = (o: Pick<Order, 'stageIndex'>): boolean =>
  o.stageIndex >= PRODUCTION_STAGES.length - 1;

// A short, plausible "manufacturer reply" for a given stage — what the real agent
// will one day parse out of an actual message and record.
function replyFor(stageKey: string, factoryOrderNo: string): string {
  const map: Record<string, string> = {
    confirmed: `Order ${factoryOrderNo} confirmed. Materials being sourced.`,
    materials: 'Main fabric and trims in. Moving to sampling.',
    sampling: 'Sample made and checked against the tech pack.',
    cutting: 'Panels cut and bundled for the run.',
    sewing: 'Assembly underway on the line.',
    washing: 'Garments washed and finished.',
    qc: 'QC passed, measurements within tolerance.',
    done: 'Production complete and packed, ready to ship.',
  };
  return map[stageKey] ?? 'Update received.';
}

// Record that the liaison agent reached out (pauses the sim, logs the contact).
export function recordOutreach(o: Order, note: string, now: number): Order {
  return {
    ...o,
    engaged: true,
    updates: [...o.updates, { at: new Date(now).toISOString(), text: note, stageKey: 'confirmed' }].slice(-20),
  };
}

// Apply a parsed manufacturer reply: advance to the reported stage (never
// backwards), record the note, and capture any order/tracking numbers.
export type StageUpdate = { stageKey: string; note: string; factoryOrderNo?: string; trackingNumber?: string; carrier?: string };
export function applyReply(o: Order, u: StageUpdate, now: number): Order {
  const idx = PRODUCTION_STAGES.findIndex((s) => s.key === u.stageKey);
  const stageIndex = idx >= 0 ? Math.max(o.stageIndex, idx) : o.stageIndex;
  const done = stageIndex >= PRODUCTION_STAGES.length - 1;
  const stageKey = u.stageKey || PRODUCTION_STAGES[stageIndex]?.key || 'confirmed';
  return {
    ...o,
    engaged: true,
    stageIndex,
    status: o.status === 'shipped' || o.status === 'shipping' ? o.status : done ? 'complete' : 'in_production',
    factoryOrderNo: u.factoryOrderNo || o.factoryOrderNo,
    trackingNumber: u.trackingNumber || o.trackingNumber,
    carrier: u.carrier || o.carrier,
    updates: [...o.updates, { at: new Date(now).toISOString(), text: u.note, stageKey }].slice(-20),
  };
}

// Advance a simulated order one stage and record the manufacturer's "reply".
// `now` is passed in (Date.now() is unavailable in some sandboxes) — callers use
// the browser clock. Returns a new Order (never mutates).
export function tickOrder(o: Order, now: number): Order {
  if (o.engaged) return o; // real liaison agent is driving progress from actual replies
  if (isComplete(o) || o.status === 'shipping' || o.status === 'shipped') return o;
  if (now < o.nextTickAt) return o;
  const nextIndex = Math.min(o.stageIndex + 1, PRODUCTION_STAGES.length - 1);
  const stage = PRODUCTION_STAGES[nextIndex];
  const factoryOrderNo = o.factoryOrderNo ?? `LK-${o.id.slice(-6).toUpperCase()}`;
  const update: OrderUpdate = { at: new Date(now).toISOString(), text: replyFor(stage.key, factoryOrderNo), stageKey: stage.key };
  const done = nextIndex >= PRODUCTION_STAGES.length - 1;
  // stages land every ~14s in the simulation so progress is visibly alive
  return {
    ...o,
    factoryOrderNo,
    stageIndex: nextIndex,
    status: done ? 'complete' : 'in_production',
    updates: [...o.updates, update].slice(-20),
    nextTickAt: now + 14_000,
  };
}
