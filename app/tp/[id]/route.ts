import { NextResponse } from 'next/server';

// Public tech-pack viewer. Fetches the stored HTML from Supabase Storage and
// re-serves it with a proper text/html content-type so it RENDERS in the browser
// (Supabase serves the raw object as text). No auth — a manufacturer just opens it.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clean = String(id).replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !clean) return new NextResponse('Not found', { status: 404 });

  const url = `${base}/storage/v1/object/public/${process.env.TECHPACK_BUCKET || 'techpacks'}/shared/${clean}.html`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return new NextResponse('Tech pack not found or no longer shared.', { status: 404 });

  const html = await r.text();
  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' },
  });
}
