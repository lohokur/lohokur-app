import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { recordLogin } from '@/lib/login-events';

// OAuth (e.g. Google) redirects here with a code → exchange it for a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user?.id) await recordLogin(data.user.id); // count this login
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?e=oauth`);
}
