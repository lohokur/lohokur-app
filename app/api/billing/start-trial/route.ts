import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Pay-first: the free trial has been retired. Everyone subscribes up front (with a
// 7-day money-back guarantee). This endpoint is kept as a safe no-op so any stale
// client that still calls it is simply told to subscribe instead of trialing.
export async function POST() {
  return NextResponse.json({ error: 'trials are no longer offered', upgrade: true }, { status: 410 });
}
