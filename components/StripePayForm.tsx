'use client';

import { useEffect, useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe-client';
import type { OrderMode } from '@/lib/order';

const usd = (n: number) => '$' + n.toLocaleString('en-US');

// The actual in-canvas card form (real charge). Confirms the PaymentIntent with
// Stripe Elements — card typed here or the saved card on the account — no redirect.
function CardForm({ amount, onPaid }: { amount: number; onPaid: (paymentIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
    if (error) { setErr(error.message ?? 'Payment failed'); setBusy(false); return; }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onPaid(paymentIntent.id);
      return; // parent unmounts this on success
    }
    setErr('Payment could not be completed.'); setBusy(false);
  };

  return (
    <>
      <PaymentElement options={{ layout: 'tabs' }} />
      {err && <div className="po-pay-err">{err}</div>}
      <button className="po-buy" disabled={busy || !stripe} onClick={pay}>
        {busy ? 'Charging…' : `Pay ${usd(amount)} & order`}
      </button>
      <div className="po-pay-fine">Secured by Stripe · LOHO KUR handles the factory relationship.</div>
    </>
  );
}

// Creates the PaymentIntent (server), then renders the card form once we have a
// client secret. Falls back to a message if payment setup fails.
export default function StripePayForm({
  amount, mode, manufacturerName, onPaid,
}: {
  amount: number;
  mode: OrderMode;
  manufacturerName: string;
  onPaid: (paymentIntentId: string) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/produce/pay', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount, mode, manufacturerName }),
    })
      .then((r) => r.json())
      .then((j) => { if (!live) return; j.clientSecret ? setClientSecret(j.clientSecret) : setErr(j.error || 'Payment setup failed'); })
      .catch(() => { if (live) setErr('Payment setup failed'); });
    return () => { live = false; };
  }, [amount, mode, manufacturerName]);

  const sp = stripePromise();
  if (err) return <div className="po-pay-err">{err}</div>;
  if (!sp || !clientSecret) return <div className="po-pay-fine">Loading secure payment…</div>;

  return (
    <Elements
      stripe={sp}
      options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#141414', colorBackground: '#ffffff', colorText: '#141414', borderRadius: '8px' } } }}
    >
      <CardForm amount={amount} onPaid={onPaid} />
    </Elements>
  );
}
