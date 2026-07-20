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
};

// Stage keys mirror lib/nodeTypes.ts. Free is the taster — idea → visual only;
// the rest of the production line (extract, pattern, techpack, sample,
// manufacture, retailer, ship, brand studio) unlocks on any paid plan.
const ALL_STAGES = ['sketch', 'visualise', 'studio', 'image', 'extract', 'pattern', 'techpack', 'sample', 'manufacture', 'retailer', 'ship'];
const FREE_STAGES = ['sketch', 'image', 'visualise'];

export const TIERS: Record<Tier, Entitlements> = {
  free:   { tier: 'free',   label: 'Free',   projects: 3,        generations: 20,    seats: 1,  stages: FREE_STAGES },
  studio: { tier: 'studio', label: 'Studio', projects: Infinity, generations: 1000,  seats: 1,  stages: ALL_STAGES },
  pro:    { tier: 'pro',    label: 'Pro',    projects: Infinity, generations: 3000,  seats: 8,  stages: ALL_STAGES },
  brand:  { tier: 'brand',  label: 'Brand',  projects: Infinity, generations: 10000, seats: 15, stages: ALL_STAGES },
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
