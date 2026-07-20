import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

// Admin-only: fetch ANY user's project (bypasses RLS via the service role) so an
// admin can view someone else's canvas. Read path only — no writes here.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  const { data } = await supabaseAdmin()
    .from('projects').select('*').eq('id', id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    name: data.name,
    flow: data.flow ?? { nodes: [], edges: [] },
    createdAt: data.created_at ? Date.parse(data.created_at) : Date.now(),
    updatedAt: data.updated_at ? Date.parse(data.updated_at) : Date.now(),
  });
}
