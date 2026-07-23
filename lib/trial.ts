// Card-free 7-day trial of the full production line. State lives in the Supabase
// auth user_metadata (no schema work): `trial_ends_at` (ISO) + `trial_used`.
// Pure + isomorphic — safe to import from server and client.

export const TRIAL_DAYS = 7;

export type TrialState = {
  onTrial: boolean;        // trial is active right now
  trialEndsAt: string | null;
  trialUsed: boolean;      // has ever started a trial (can't start a second)
  daysLeft: number;        // whole days remaining while onTrial (else 0)
};

export function readTrial(meta: Record<string, unknown> | null | undefined, now = Date.now()): TrialState {
  const endsRaw = meta?.trial_ends_at;
  const trialEndsAt = typeof endsRaw === 'string' ? endsRaw : null;
  const trialUsed = meta?.trial_used === true || !!trialEndsAt;
  const end = trialEndsAt ? new Date(trialEndsAt).getTime() : 0;
  const onTrial = end > now;
  const daysLeft = onTrial ? Math.max(1, Math.ceil((end - now) / 86_400_000)) : 0;
  return { onTrial, trialEndsAt, trialUsed, daysLeft };
}

// During an active trial a free user is treated as Studio for entitlements/caps.
// Paid users are already above the trial, so it never downgrades them.
export function effectiveTier(baseTier: string | null | undefined, onTrial: boolean): string {
  const t = baseTier ?? 'free';
  return t === 'free' && onTrial ? 'studio' : t;
}
