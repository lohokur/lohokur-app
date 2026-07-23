import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { readTrial, TRIAL_DAYS } from '@/lib/trial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Start the one-time, card-free 7-day trial of the full production line.
// Writes trial_ends_at + trial_used to auth user_metadata (server-authoritative;
// the client can't grant itself a trial). Idempotent while already on trial.
export async function POST() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  // paid users don't need a trial
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from('profiles').select('tier').eq('id', user.id).maybeSingle();
  if (profile?.tier && profile.tier !== 'free') {
    return NextResponse.json({ error: 'already subscribed' }, { status: 400 });
  }

  const md = (user.user_metadata ?? {}) as Record<string, unknown>;
  const state = readTrial(md);
  if (state.onTrial) {
    return NextResponse.json({ ok: true, trialEndsAt: state.trialEndsAt }); // already running
  }
  if (state.trialUsed) {
    return NextResponse.json({ error: 'trial already used', upgrade: true }, { status: 403 });
  }

  const now = Date.now();
  const trialEndsAt = new Date(now + TRIAL_DAYS * 86_400_000).toISOString();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...md, trial_started_at: new Date(now).toISOString(), trial_ends_at: trialEndsAt, trial_used: true },
  });

  return NextResponse.json({ ok: true, trialEndsAt });
}
