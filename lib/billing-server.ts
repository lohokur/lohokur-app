import 'server-only';
import { supabaseServer } from './supabase/server';
import { generationCap, entitlementsFor, type Entitlements } from './entitlements';
import { readTrial, effectiveTier } from './trial';
import { isAdmin } from './admin';

// Metering is skipped entirely when there's no Supabase backend (local dev fallback).
const HAS_DB = process.env.NEXT_PUBLIC_HAS_DB === '1';

export type MeterResult =
  | { ok: true; remaining: number; tier: string }
  | { ok: false; reason: 'unauth' | 'over' };

// Atomically consume one (or `cost`) AI generation for the signed-in user, enforcing
// their tier's monthly cap. Returns the user's tier so callers can pick the model
// (free → cheaper model, paid → Pro). Fail-open in local/no-DB mode so dev keeps working.
export async function consumeGeneration(cost = 1): Promise<MeterResult> {
  if (!HAS_DB) return { ok: true, remaining: Infinity, tier: 'studio' };

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'unauth' };

  const { data: profile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle();
  const baseTier = profile?.tier ?? 'free';
  // an active trial grants Studio-level caps/model
  const { onTrial } = readTrial(user.user_metadata as Record<string, unknown>);
  const tier = effectiveTier(baseTier, onTrial);
  const cap = generationCap(tier);

  const { data, error } = await sb.rpc('consume_generation', { p_cap: cap, p_cost: cost });
  // If metering is unavailable (function/table missing, DB hiccup) don't block the core
  // product — fail OPEN. Only a real -1 from the function means the user is over their cap.
  if (error) return { ok: true, remaining: Infinity, tier };
  const remaining = typeof data === 'number' ? data : -1;
  if (remaining < 0) return { ok: false, reason: 'over' };
  return { ok: true, remaining, tier };
}

// Give a consumed credit back (call when the AI request produced nothing usable).
export async function refundGeneration(cost = 1): Promise<void> {
  if (!HAS_DB) return;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  await sb.rpc('refund_generation', { p_cost: cost });
}

export type ProfileView = {
  email: string | null;
  tier: Entitlements['tier'];      // the account's real plan (free until they pay)
  entitlements: Entitlements;      // resolved for the EFFECTIVE tier (trial counts as Studio)
  gensUsed: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  isAdmin: boolean;
  onTrial: boolean;
  trialEndsAt: string | null;
  trialUsed: boolean;
};

// Full profile + resolved entitlements for the signed-in user (for /profile, /pricing).
export async function getProfileView(): Promise<ProfileView | null> {
  if (!HAS_DB) return null;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from('profiles')
    .select('tier, gens_used, subscription_status, current_period_end, stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  const tier = data?.tier ?? 'free';
  const { onTrial, trialEndsAt, trialUsed } = readTrial(user.user_metadata as Record<string, unknown>);
  const effTier = effectiveTier(tier, onTrial) as Entitlements['tier'];
  return {
    email: user.email ?? null,
    tier: tier as Entitlements['tier'],
    entitlements: entitlementsFor(effTier),
    gensUsed: data?.gens_used ?? 0,
    subscriptionStatus: data?.subscription_status ?? null,
    currentPeriodEnd: data?.current_period_end ?? null,
    stripeCustomerId: data?.stripe_customer_id ?? null,
    isAdmin: isAdmin(user.email),
    onTrial,
    trialEndsAt,
    trialUsed,
  };
}
