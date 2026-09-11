// Transparent cost-plus pricing so a sample or bulk order never loses money.
//
//   charge = (factoryCost × buffer  +  shipping  +  handling) × (1 + margin)
//   charge = (charge + stripeFlat) / (1 − stripePct)   ← gross up so fees don't eat margin
//   charge = max(charge, floor)                         ← floor covers fixed costs on tiny items
//
// Every number the business depends on lives HERE — tune in one place.

export const PRICING = {
  sampleBuffer: 1.25, // safety margin on the ESTIMATED factory sample cost (covers quote error)
  sampleShip: 35,     // courier a sample to the customer (USD, worst-case intl)
  handling: 10,       // liaison / ops overhead booked per order (USD)
  brokerMargin: 0.40, // our cut on top of every real cost — this is the profit
  stripePct: 0.029,   // Stripe % fee
  stripeFlat: 0.30,   // Stripe flat fee (USD)
  sampleFloor: 60,    // minimum sample charge — nothing ships for less than this
  bulkBuffer: 1.15,   // safety margin on the estimated factory unit cost
  bulkMargin: 0.30,   // margin on a bulk run
};

const grossUp = (net: number) => (net + PRICING.stripeFlat) / (1 - PRICING.stripePct);
const round5 = (n: number) => Math.round(n / 5) * 5;

// What we CHARGE the customer for one sample, given the estimated factory cost.
export function samplePrice(factoryCost: number): number {
  const cost = factoryCost * PRICING.sampleBuffer + PRICING.sampleShip + PRICING.handling;
  const withMargin = cost * (1 + PRICING.brokerMargin);
  return round5(Math.max(grossUp(withMargin), PRICING.sampleFloor));
}

// Per-unit price for a bulk run (margin baked in; delivery handled by the 3PL/ship step).
export function bulkUnitPrice(factoryUnit: number): number {
  const withMargin = factoryUnit * PRICING.bulkBuffer * (1 + PRICING.bulkMargin);
  return Math.round(grossUp(withMargin) * 2) / 2; // nearest $0.50
}

// Line-item breakdown behind a sample charge — for showing the customer / debugging.
export function sampleBreakdown(factoryCost: number) {
  const factory = Math.round(factoryCost * PRICING.sampleBuffer);
  const charge = samplePrice(factoryCost);
  const margin = charge - grossUp(factory + PRICING.sampleShip + PRICING.handling);
  return { factory, shipping: PRICING.sampleShip, handling: PRICING.handling, margin: Math.max(0, Math.round(margin)), charge };
}
