import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { parseReply } from '@/lib/liaison';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Parse a manufacturer's reply (pasted now; auto-ingested from the inbox later)
// into a production-stage update the node can apply.
export async function POST(req: Request) {
  const { reply } = await req.json().catch(() => ({}));
  if (!reply || typeof reply !== 'string' || !reply.trim()) {
    return NextResponse.json({ error: 'missing reply' }, { status: 400 });
  }
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  } catch { /* local — allow */ }

  try {
    const parsed = await parseReply(reply);
    return NextResponse.json({ parsed });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'could not parse reply' }, { status: 502 });
  }
}
