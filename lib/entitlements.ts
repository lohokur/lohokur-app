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

// Stage keys mirror lib/nodeTypes.ts StageKey.
// Free: draw, render, drop images. Pro: brand-studio prompt + garment tooling.
// Studio: production + fulfilment. (Adjust these arrays to retune what each plan unlocks.)
const FREE_STAGES = ['sketch', 'visualise', 'image'];
const PRO_STAGES = [...FREE_STAGES, 'studio', 'techpack', 'extract', 'pattern'];
const ALL_STAGES = [...PRO_STAGES, 'manufacture', 'sample', 'ship'];

export const TIERS: Record<Tier, Entitlements> = {
  free:   { tier: 'free',   label: 'Free',   projects: 1,        generations: 10,   stages: FREE_STAGES },
  pro:    { tier: 'pro',    label: 'Pro',    projects: 10,       generations: 200,  stages: PRO_STAGES },
  studio: { tier: 'studio', label: 'Studio', projects: Infinity, generations: 1000, stages: ALL_STAGES },
};

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
