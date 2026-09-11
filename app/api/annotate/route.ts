import { NextResponse } from 'next/server';
import { editImage } from '@/lib/imagegen';
import { usesProModel } from '@/lib/entitlements';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

// Editing can take a while (~30–90s).
export const maxDuration = 300;

// The incoming image is a photoreal garment render with hand-drawn edits on top:
// drawn shapes = new fabric panels/details to add; nearby words = the material for
// the nearest panel. Re-render the SAME image with those edits realised.
const PROMPT =
  'This image is a photorealistic garment render that has been edited on top of it. There are two kinds of edit to interpret. ' +
  '(1) DRAWN EDITS: any hand-drawn outlines, shapes or panels are NEW pieces of fabric or details to ADD to the garment, and any ' +
  'handwritten or typed words are LABELS specifying the material for the nearest drawn panel ("mesh outline" → a mesh panel, "leather" → leather, etc.). ' +
  '(2) RESHAPED / WARPED AREAS: parts of the garment may have been pushed, stretched or liquified into a NEW silhouette. Treat that new silhouette as ' +
  'the intended shape, but re-render it as a REAL, naturally draped garment — normal fabric fall, folds and movement — with NONE of the smeared, melted or ' +
  'distorted "warped" look; the cloth should look photographed, not digitally pushed. ' +
  'Re-create the EXACT same image — identical figure, face, body, pose, room, wall, floor, lighting, camera framing, crop and aspect ratio — ' +
  'incorporating each drawn panel as real, well-made fabric in its labelled material and honouring the reshaped silhouette, all integrated seamlessly. ' +
  'REMOVE every drawing line, mark and text label from the output — they are construction instructions only, not part of the finished garment. ' +
  'Output a single photorealistic, full-length image.';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { image } = body as { image?: string };
  if (!image) return NextResponse.json({ error: 'missing image' }, { status: 400 });

  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }
  try {
    const out = await editImage(PROMPT, [image], usesProModel(gate.tier));
    return NextResponse.json({ image: out });
  } catch (e) {
    console.error('[annotate] failed:', (e as Error).message);
    await refundGeneration();
    return NextResponse.json({ error: (e as Error).message || 'edit failed' }, { status: 500 });
  }
}
