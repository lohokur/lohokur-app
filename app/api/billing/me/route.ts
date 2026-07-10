import { NextResponse } from 'next/server';
import { getProfileView } from '@/lib/billing-server';

export const runtime = 'nodejs';

// Lightweight "who am I / what's my plan" for client UI (dock locks, profile, pricing).
export async function GET() {
  const v = await getProfileView();
  if (!v) return NextResponse.json({ tier: 'free', gensUsed: 0, subscriptionStatus: null, currentPeriodEnd: null, hasSubscription: false });
  return NextResponse.json({
    tier: v.tier,
    gensUsed: v.gensUsed,
    subscriptionStatus: v.subscriptionStatus,
    currentPeriodEnd: v.currentPeriodEnd,
    hasSubscription: !!v.stripeCustomerId,
  });
}
