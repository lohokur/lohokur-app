import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseServer } from '@/lib/supabase/server';

// Create a PaymentIntent for a production order — LOHO KUR is the merchant of
// record (charges the customer; pays factories out-of-band). The client confirms
// it in-canvas with Stripe Elements (no redirect). Passing the customer surfaces
// their saved card so they can one-tap the card already on their account.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const amount = Number(body.amount);
  const mode = body.mode === 'bulk' ? 'bulk' : 'sample';
  const manufacturerName = typeof body.manufacturerName === 'string' ? body.manufacturerName.slice(0, 120) : '';
  if (!Number.isFinite(amount) || amount < 5 || amount > 100_000) {
    return NextResponse.json({ error: 'invalid amount' }, { status: 400 });
  }

  let customer: string | undefined;
  let email: string | undefined;
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
    email = user.email ?? undefined;
    const { data } = await sb.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
    customer = data?.stripe_customer_id ?? undefined;
  } catch { /* no DB — still allow the charge */ }

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      ...(customer ? { customer } : {}),
      ...(email && !customer ? { receipt_email: email } : {}),
      automatic_payment_methods: { enabled: true },
      description: `LOHO KUR ${mode} order${manufacturerName ? ` · ${manufacturerName}` : ''}`,
      metadata: { kind: 'production_order', mode, manufacturer: manufacturerName },
    });
    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'payment setup failed' }, { status: 500 });
  }
}
