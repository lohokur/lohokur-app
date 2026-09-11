import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizeTechpack, techpackHtml } from '@/lib/techpack';
import { persistHtml } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Publish a tech pack as a standalone public web page and return its share URL,
// so it can be handed straight to a manufacturer — no app, no account needed.
export async function POST(req: Request) {
  const { techpack, shareId } = await req.json().catch(() => ({}));
  if (!techpack || !shareId) return NextResponse.json({ error: 'missing techpack' }, { status: 400 });

  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  } catch { /* local — allow */ }

  const clean = String(shareId).replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  try {
    const html = techpackHtml(normalizeTechpack(techpack));
    const stored = await persistHtml(`shared/${clean}`, html);
    if (!stored) return NextResponse.json({ error: 'sharing is not configured' }, { status: 500 });
    // return our own viewer URL — it re-serves the HTML with the right content-type
    const url = `${new URL(req.url).origin}/tp/${clean}`;
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'could not publish tech pack' }, { status: 500 });
  }
}
