// Tier → limits. This is the single source of truth for what each plan unlocks.
// Mirrors lohokur.com/pricing (Free / Studio / Pro / Brand).
// (The project-count numbers are mirrored in supabase/migrations/0001_billing.sql
//  `project_limit()` for server-side enforcement — keep them in sync.)

export type Tier = 'free' | 'studio' | 'pro' | 'brand';

export type Entitlements = {
  tier: Tier;
  label: string;
  projects: number; // max projects (Infinity = unlimited)
  generations: number; // AI credits per calendar month
  seats: number; // included seats
  stages: string[]; // node/stage types this tier can use
  maxPerStage: number; // max nodes of ONE category on a canvas (Infinity = unlimited)
  regenPerNode: number; // times a single node may (re)generate (Infinity = unlimited)
};

// Stage keys mirror lib/nodeTypes.ts. Free is the taster — sketch → model →
// worldbuild, one node of each and one generation each; the rest of the
// production line (pattern, techpack, sample, ship, …) unlocks on any paid plan.
const ALL_STAGES = ['sketch', 'visualise', 'studio', 'extract', 'pattern', 'techpack', 'sample', 'manufacture', 'retailer', 'ship'];

export const TIERS: Record<Tier, Entitlements> = {
  // Free users can place ANY node type — the limits are one node per category and
  // one generation per node, not which nodes they can touch.
  free:   { tier: 'free',   label: 'Free',   projects: 3,        generations: 20,    seats: 1,  stages: ALL_STAGES, maxPerStage: 1,        regenPerNode: 1 },
  studio: { tier: 'studio', label: 'Studio', projects: Infinity, generations: 1000,  seats: 1,  stages: ALL_STAGES,  maxPerStage: Infinity, regenPerNode: Infinity },
  pro:    { tier: 'pro',    label: 'Pro',    projects: Infinity, generations: 3000,  seats: 8,  stages: ALL_STAGES,  maxPerStage: Infinity, regenPerNode: Infinity },
  brand:  { tier: 'brand',  label: 'Brand',  projects: Infinity, generations: 10000, seats: 15, stages: ALL_STAGES,  maxPerStage: Infinity, regenPerNode: Infinity },
};

export type Cadence = 'monthly' | 'annual';

// Official display pricing (GBP). SINGLE SOURCE OF TRUTH for prices shown anywhere
// in the store (pricing page, paywall, profile). Annual = −20% (2.4 months free).
// `null` = not a paid/self-serve price. MUST match the amounts on the live Stripe
// Prices in the STRIPE_PRICE_* env vars — Stripe is what actually charges.
export const PRICING: Record<Tier, Record<Cadence, number | null>> = {
  free:   { monthly: null, annual: null },
  studio: { monthly: 29,   annual: 278 },
  pro:    { monthly: 59,   annual: 566 },
  brand:  { monthly: 199,  annual: 1910 },
};

// Monthly (or given cadence) price for a tier, or null if it has none.
export function priceFor(tier?: string | null, cadence: Cadence = 'monthly'): number | null {
  return PRICING[(tier as Tier)]?.[cadence] ?? null;
}

export const PG_INT_MAX = 2147483647; // Infinity → this when passing a cap to Postgres

export function entitlementsFor(tier?: string | null): Entitlements {
  return TIERS[(tier as Tier)] ?? TIERS.free;
}

export function generationCap(tier?: string | null): number {
  const g = entitlementsFor(tier).generations;
  return g === Infinity ? PG_INT_MAX : g;
}

export function stageAllowed(tier: string | null | undefined, stage: string): boolean {
  return entitlementsFor(tier).stages.includes(stage);
}
