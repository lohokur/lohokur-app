import { NextResponse } from 'next/server';
import { getProfileView } from '@/lib/billing-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-user data — never cache in any shared/CDN layer.
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

// Lightweight "who am I / what's my plan" for client UI (dock locks, profile, pricing).
export async function GET() {
  const v = await getProfileView();
  if (!v) return NextResponse.json({ tier: 'free', gensUsed: 0, subscriptionStatus: null, currentPeriodEnd: null, hasSubscription: false }, { headers: NO_STORE });
  return NextResponse.json({
    tier: v.tier,
    gensUsed: v.gensUsed,
    subscriptionStatus: v.subscriptionStatus,
    currentPeriodEnd: v.currentPeriodEnd,
    hasSubscription: !!v.stripeCustomerId,
  }, { headers: NO_STORE });
}
