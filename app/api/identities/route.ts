import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Submit a generated visual to the LOHO KUR "identities" library (the orbital
// carousel on lohokur.com). ROUGH prototype: authenticates + validates the
// payload and records the intent; the actual publish to lohokur.com's identities
// collection is wired later (iron-out). Returns { ok } so the node can confirm.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });

  const { image, caption } = await req.json().catch(() => ({}));
  if (typeof image !== 'string' || !image) {
    return NextResponse.json({ error: 'no image' }, { status: 400 });
  }

  // TODO(iron-out): forward to lohokur.com identities collection (needs a
  // publish endpoint / shared store). For now we accept and acknowledge so the
  // canvas flow is real end-to-end from the user's side.
  console.log('[identities] submit', { user: user.email, bytes: image.length, caption: caption ?? null });

  return NextResponse.json({ ok: true, status: 'queued' });
}
