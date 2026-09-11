import { NextResponse } from 'next/server';
import { persistImage } from '@/lib/storage';
import { supabaseServer } from '@/lib/supabase/server';

export const maxDuration = 60;

// Offload a base64 image (a sketch drawing or an upload) to Supabase Storage and
// return a permanent public URL, so the canvas flow keeps only the URL instead of
// the bytes (Disk IO). Auth-gated; never throws away the image on failure.
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { image } = await req.json().catch(() => ({}));
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'expected a base64 image data URL' }, { status: 400 });
  }

  try {
    const url = await persistImage(image); // returns a Storage URL, or the input on fallback
    return NextResponse.json({ url });
  } catch (e) {
    // Never lose the image — hand it back so the client keeps the inline copy.
    console.error('[persist-image] failed:', (e as Error).message);
    return NextResponse.json({ url: image });
  }
}
