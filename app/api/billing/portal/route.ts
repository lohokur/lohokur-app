import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

// Open the Stripe Customer Portal so the user can change plan / update card / cancel.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'no subscription' }, { status: 400 });
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/profile`,
  });
  return NextResponse.json({ url: session.url });
}
