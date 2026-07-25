import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getStripe, priceId, type Cadence } from '@/lib/stripe';

export const runtime = 'nodejs';

// Start a Stripe Checkout session for a paid plan. Returns { url } to redirect to.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  const { plan, cadence, trial } = await req.json().catch(() => ({}));
  if ((plan !== 'studio' && plan !== 'pro' && plan !== 'brand') || (cadence !== 'monthly' && cadence !== 'annual')) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 });
  }
  const price = priceId(plan, cadence as Cadence);
  if (!price) return NextResponse.json({ error: 'plan not configured' }, { status: 500 });

  const stripe = getStripe();

  // Reuse an existing Stripe customer for this user, or create one.
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();

  let customerId = profile?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
  // 7-day free trial: Stripe collects the card now and makes the first charge in
  // 7 days (cancel before then = no charge). Guard against re-trialing.
  let wantTrial = trial === true;
  if (wantTrial) {
    const { data: p } = await admin.from('profiles').select('trial_used').eq('id', user.id).maybeSingle();
    if (p?.trial_used) wantTrial = false;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
      ...(wantTrial ? { trial_period_days: 7 } : {}),
    },
    ...(wantTrial ? { payment_method_collection: 'always' as const } : {}),
    allow_promotion_codes: true,
    success_url: `${origin}/profile?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
