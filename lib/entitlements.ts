// Tier → limits. This is the single source of truth for what each plan unlocks.
// (The project-count numbers are mirrored in supabase/migrations/0001_billing.sql
//  `project_limit()` for server-side enforcement — keep them in sync.)

export type Tier = 'free' | 'pro' | 'studio';

export type Entitlements = {
  tier: Tier;
  label: string;
  projects: number; // max projects (Infinity = unlimited)
  generations: number; // AI generations per calendar month
  stages: string[]; // node/stage types this tier can use
};

// Every node/stage is available to ALL tiers — plans differ only by project count
// and monthly generation cap (the real cost lever). Stage keys mirror lib/nodeTypes.ts.
const ALL_STAGES = ['sketch', 'visualise', 'studio', 'image', 'extract', 'pattern', 'techpack', 'sample', 'manufacture', 'ship'];

export const TIERS: Record<Tier, Entitlements> = {
  free:   { tier: 'free',   label: 'Free',   projects: 1,        generations: 3,    stages: ALL_STAGES },
  pro:    { tier: 'pro',    label: 'Pro',    projects: 10,       generations: 200,  stages: ALL_STAGES },
  studio: { tier: 'studio', label: 'Studio', projects: Infinity, generations: 1000, stages: ALL_STAGES },
};

export type Cadence = 'monthly' | 'annual';

// Official display pricing (GBP). SINGLE SOURCE OF TRUTH for prices shown anywhere
// in the store (pricing page, paywall, profile). `null` = not a paid/self-serve
// price. MUST match the amounts on the live Stripe Prices in the STRIPE_PRICE_*
// env vars — Stripe is what actually charges; this is only what we display.
export const PRICING: Record<Tier, Record<Cadence, number | null>> = {
  free:   { monthly: null, annual: null },
  pro:    { monthly: 30,   annual: 300 },
  studio: { monthly: 99,   annual: 990 },
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
