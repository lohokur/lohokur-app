import { NextResponse } from 'next/server';
import { getProfileView } from '@/lib/billing-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-user data — never cache in any shared/CDN layer.
const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' } as const;

// Lightweight "who am I / what's my plan" for client UI (dock locks, profile, pricing).
export async function GET() {
  const v = await getProfileView();
  if (!v) return NextResponse.json({ email: null, tier: 'free', gensUsed: 0, subscriptionStatus: null, currentPeriodEnd: null, hasSubscription: false, isAdmin: false, unlimited: false, onTrial: false, trialEndsAt: null, trialUsed: false }, { headers: NO_STORE });
  return NextResponse.json({
    email: v.email,
    tier: v.tier,
    gensUsed: v.gensUsed,
    subscriptionStatus: v.subscriptionStatus,
    currentPeriodEnd: v.currentPeriodEnd,
    hasSubscription: !!v.stripeCustomerId,
    isAdmin: v.isAdmin,
    unlimited: v.unlimited,
    onTrial: v.onTrial,
    trialEndsAt: v.trialEndsAt,
    trialUsed: v.trialUsed,
  }, { headers: NO_STORE });
}
