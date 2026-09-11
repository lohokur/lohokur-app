import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/imagegen';
import { usesProModel } from '@/lib/entitlements';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

// Image generation can take a while (~30–90s).
export const maxDuration = 300;

// Accept both inline data-URLs and hosted image URLs (previous renders are now
// stored as Supabase Storage URLs, not base64) — fal fetches either kind.
const isImageRef = (x: unknown): x is string =>
  typeof x === 'string' && (/^data:.+?;base64,/.test(x) || /^https?:\/\//.test(x));

// House style for garment prompts (the Sketch node). Every product a user types
// is rendered the same on-brand way: a clean ghost-mannequin shot floating in
// white — so it drops straight into the pipeline and onto the identities.
const ANGLE: Record<string, string> = {
  front: 'The garment is photographed straight from the FRONT.',
  side: 'The garment is photographed from a full SIDE PROFILE (viewed from directly beside it).',
  back: 'The garment is photographed straight from the BACK.',
};
const productStyle = (view: string) =>
  'Present the result as a clean, professional e-commerce PRODUCT SHOT: the single garment on an invisible GHOST MANNEQUIN — a hollow, filled-out worn 3D form with NO visible person at all (no head, no neck, no face, no hands, no arms, no legs, no skin) — so the garment holds a natural, worn shape as if a body were inside it. Float it centred in a completely empty, seamless PURE WHITE studio background with soft, even lighting and a subtle soft contact shadow beneath. Absolutely NO scenery, room, furniture, props, hanger, packaging, folding or flat-lay, NO added text or logos, NO human model and NO face. '
  + (ANGLE[view] ?? ANGLE.front)
  + ' The whole garment is in frame with clean margins and crisp focus — just the product floating in clean white space.';

// Generic image endpoint:
//   { prompt }                            → text-to-image
//   { prompt, images: [dataUrl] }         → transform/rebrand the given image(s)
//   { prompt, mode: 'product', view }     → ghost-mannequin house style at a given angle (Sketch node)
export async function POST(req: Request) {
  const { prompt, images, mode, view } = await req.json().catch(() => ({}));
  if (!prompt || !String(prompt).trim()) {
    return NextResponse.json({ error: 'missing prompt' }, { status: 400 });
  }
  const product = mode === 'product';
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
    let guide: string;
    if (product) {
      guide = refs.length
        ? 'You are given one or more source images of a garment design (a sketch or photo). Faithfully turn that exact design into a real, well-made garment. '
        : 'Design the single garment described below and render it as a real, well-made product. ';
    } else {
      guide = refs.length
        ? 'You are given one or more source images. Transform / restyle / rebrand them exactly as described below, preserving the product itself faithfully unless told otherwise. Output a single photorealistic, high-resolution image. '
        : 'Generate a single photorealistic, high-resolution image as described below. ';
    }

    const full = guide + '"' + String(prompt).trim() + '".' + (product ? ' ' + productStyle(String(view || 'front')) : '');
    const image = await generateImage(full, refs, usesProModel(gate.tier));
    return NextResponse.json({ image });
  } catch (e) {
    await refundGeneration(); // generation failed — refund the credit
    let msg = (e as Error).message || 'generation failed';
    try { const p = JSON.parse(msg); msg = p?.error?.message || msg; } catch { /* not JSON */ }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
