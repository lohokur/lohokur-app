import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { recordLogin } from '@/lib/login-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Called by the login page right after a successful email/password sign-in.
// (OAuth logins are counted in /auth/callback instead.) Identity comes from the
// freshly-established session cookie — the client can't spoof whose count ticks.
export async function POST() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await recordLogin(user.id);
  return NextResponse.json({ ok: true });
}
