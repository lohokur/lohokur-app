import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, tierForPrice } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

// Stripe → Supabase sync. Stripe is the source of truth for what a user is paying
// for; this webhook mirrors that into `profiles` so the app can gate on tier.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return NextResponse.json({ error: 'not configured' }, { status: 500 });

  const stripe = getStripe();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `bad signature: ${(e as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription as string);
          await syncSubscription(sub);
        }
        break;
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price?.id ?? '';
  const active = sub.status === 'active' || sub.status === 'trialing';
  const tier = active ? (tierForPrice(priceId) ?? 'free') : 'free';
  // period end lives on the subscription item in current Stripe API versions
  const periodEnd = sub.items.data[0]?.current_period_end ?? null;

  await supabaseAdmin()
    .from('profiles')
    .update({
      tier,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);
}
