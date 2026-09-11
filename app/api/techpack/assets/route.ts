import { NextResponse } from 'next/server';
import { editImage } from '@/lib/imagegen';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';
import { usesProModel } from '@/lib/entitlements';

export const maxDuration = 300;

// Generate a tech-pack asset from the garment image: a technical flat vector of a
// view, or a material swatch that visually stems from the garment.
const PROMPTS: Record<string, string> = {
  vector:
    'Turn this garment photo into a clean 2D TECHNICAL FLAT drawing (flat-lay / CAD line-art): crisp black outlines on a PURE WHITE background, showing seams, panels, top-stitching, closures and construction lines. Flat, front-on, no shading, no gradients, no model, no background, no colour fill — just the technical line drawing, like a factory tech pack flat.',
  fabric:
    'Show a close-up SWATCH of the MAIN BODY FABRIC of this garment — a flat square fabric sample showing the exact colour, weave and texture, filling the frame, on a plain seamless white background, sharp product-photography lighting. Just the fabric swatch, nothing else.',
  binding:
    'Show a close-up SWATCH of the BINDING / RIB / trim material of this garment (the cuff, hem or neck finish) — a small folded fabric sample showing its colour and texture, on a plain seamless white background. Just the trim swatch.',
  thread:
    'Show a single SPOOL OF SEWING THREAD colour-matched to this garment\'s main colour — one cone/spool of thread, centred, on a plain seamless white background, product-photography style. Just the thread spool.',
  label:
    'Show a small woven BRAND / CARE LABEL for this garment — a folded fabric clothing label tag with subtle woven texture in a colour that suits the piece, centred on a plain seamless white background. Just the label tag.',
  'label-render':
    'The image is a hand-drawn LABEL DESIGN. Reproduce it EXACTLY as a real woven / printed fabric clothing label — a faithful, photorealistic material realisation of this precise drawing. Keep every element identical: the same COLOURS, the same SHAPE and outline of the label, the same text, wording, logos, icons, lines and marks, in the same positions, sizes and proportions as drawn. Do NOT add, remove, re-arrange, restyle or reinterpret anything, and do NOT change any colours — only translate the drawing into real fabric: give it woven/printed textile texture, thread detail and a neatly stitched or cut edge in the shape drawn. Centre it on a plain seamless white background, sharp product photography. Output only the finished label, faithful to the drawing.',
};

export async function POST(req: Request) {
  const { image, kind } = await req.json().catch(() => ({}));
  const prompt = PROMPTS[kind as string];
  if (!image || !prompt) return NextResponse.json({ error: 'missing image or kind' }, { status: 400 });

  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }
  try {
    const out = await editImage(prompt, [image], usesProModel(gate.tier));
    return NextResponse.json({ image: out });
  } catch (e) {
    await refundGeneration();
    return NextResponse.json({ error: (e as Error).message || 'asset generation failed' }, { status: 500 });
  }
}
