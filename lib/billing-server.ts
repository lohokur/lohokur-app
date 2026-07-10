import 'server-only';
import { supabaseServer } from './supabase/server';
import { generationCap, entitlementsFor, type Entitlements } from './entitlements';

// Metering is skipped entirely when there's no Supabase backend (local dev fallback).
const HAS_DB = process.env.NEXT_PUBLIC_HAS_DB === '1';

export type MeterResult =
  | { ok: true; remaining: number }
  | { ok: false; reason: 'unauth' | 'over' };

// Atomically consume one (or `cost`) AI generation for the signed-in user, enforcing
// their tier's monthly cap. Fail-open in local/no-DB mode so dev keeps working.
export async function consumeGeneration(cost = 1): Promise<MeterResult> {
  if (!HAS_DB) return { ok: true, remaining: Infinity };

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, reason: 'unauth' };

  const { data: profile } = await sb.from('profiles').select('tier').eq('id', user.id).maybeSingle();
  const cap = generationCap(profile?.tier);

  const { data, error } = await sb.rpc('consume_generation', { p_cap: cap, p_cost: cost });
  // If metering is unavailable (function/table missing, DB hiccup) don't block the core
  // product — fail OPEN. Only a real -1 from the function means the user is over their cap.
  if (error) return { ok: true, remaining: Infinity };
  const remaining = typeof data === 'number' ? data : -1;
  if (remaining < 0) return { ok: false, reason: 'over' };
  return { ok: true, remaining };
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
  tier: Entitlements['tier'];
  entitlements: Entitlements;
  gensUsed: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
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
  return {
    tier,
    entitlements: entitlementsFor(tier),
    gensUsed: data?.gens_used ?? 0,
    subscriptionStatus: data?.subscription_status ?? null,
    currentPeriodEnd: data?.current_period_end ?? null,
    stripeCustomerId: data?.stripe_customer_id ?? null,
  };
}
