import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/imagegen';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

// Image generation can take a while (~30–90s).
export const maxDuration = 300;

// Accept both inline data-URLs and hosted image URLs (previous renders are now
// stored as Supabase Storage URLs, not base64) — fal fetches either kind.
const isImageRef = (x: unknown): x is string =>
  typeof x === 'string' && (/^data:.+?;base64,/.test(x) || /^https?:\/\//.test(x));

// Generic image endpoint:
//   { prompt }                    → text-to-image
//   { prompt, images: [dataUrl] } → transform/rebrand the given image(s) per the prompt
export async function POST(req: Request) {
  const { prompt, images } = await req.json().catch(() => ({}));
  if (!prompt || !String(prompt).trim()) {
    return NextResponse.json({ error: 'missing prompt' }, { status: 400 });
  }
  // meter this generation against the user's monthly tier allowance
  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }
  try {
    const refs = (Array.isArray(images) ? images : []).filter(isImageRef);
    const guide = refs.length
      ? 'You are given one or more source images. Transform / restyle / rebrand them exactly as described below, preserving the product itself faithfully unless told otherwise. Output a single photorealistic, high-resolution image. '
      : 'Generate a single photorealistic, high-resolution image as described below. ';

    const image = await generateImage(guide + String(prompt).trim(), refs);
    return NextResponse.json({ image });
  } catch (e) {
    await refundGeneration(); // generation failed — refund the credit
    let msg = (e as Error).message || 'generation failed';
    try { const p = JSON.parse(msg); msg = p?.error?.message || msg; } catch { /* not JSON */ }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
