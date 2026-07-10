import { NextResponse } from 'next/server';
import { editImage } from '@/lib/imagegen';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

// Image generation can take a while (~30–90s).
export const maxDuration = 300;

const FRAMING =
  'Reproduce the identical camera framing, crop, zoom, distance and ASPECT RATIO of the base photo: a FULL-LENGTH PORTRAIT with the ENTIRE figure visible from the top of the head down to the FEET on the floor, standing in the full room, same tall vertical proportions. Do NOT zoom in, crop to the upper body, or switch to a landscape/close-up composition.';

const BASE = 'The FIRST image is the base model: a real photo of a faceless figure in a plain black bodysuit, standing front-facing in a bare concrete room with a wiring panel on the wall.';

function promptFor(view: string) {
  if (view === 'back') {
    return [
      BASE,
      'The SECOND image is a sketch of the BACK of a garment / outfit design.',
      'Turn the figure AROUND so we see it from BEHIND — its back to the camera — in the exact same room, lighting and standing pose (mirrored). Dress it in the garment, faithfully showing the BACK design from the sketch.',
      FRAMING,
      'Only add the sketched clothing; anything it does not cover stays the black bodysuit. Photorealistic, sharp, full-length head to feet.',
    ].join(' ');
  }
  if (view === 'side') {
    return [
      BASE,
      'The SECOND image is a sketch of the SIDE of a garment / outfit design.',
      'Turn the figure to a SIDE PROFILE (facing to one side) in the exact same room, lighting and stance. Dress it in the garment, faithfully showing the SIDE design from the sketch.',
      FRAMING,
      'Only add the sketched clothing; anything it does not cover stays the black bodysuit. Photorealistic, sharp, full-length head to feet.',
    ].join(' ');
  }
  // front (default)
  return [
    BASE,
    'The SECOND image is a rough hand-drawn sketch of a garment / outfit design (front view).',
    'Dress the base figure in the garment(s) from the sketch, faithfully translating the sketched design — silhouette, proportions, layers, key details — into real, well-made clothing worn by the figure.',
    FRAMING,
    'KEEP EVERYTHING ELSE IDENTICAL to the base photo: same faceless figure, body, pose, room, wall, floor, wiring panel and lighting. Only add the sketched clothing; uncovered areas stay black bodysuit.',
    'Output a single photorealistic, full-length image — the base photo with the designed outfit now worn, head to feet.',
  ].join(' ');
}

// Combined mode: dress the base model in one or more design sketches, using any
// plugged-in reference images for material/colour/style. Image order passed to the
// model is: [base, ...sketches, ...references].
function combinedPrompt(nSketch: number, nRef: number) {
  const parts = [BASE];
  if (nSketch > 0) {
    parts.push(
      `The next ${nSketch} image${nSketch > 1 ? 's are' : ' is a'} hand-drawn DESIGN SKETCH${nSketch > 1 ? 'es' : ''} of garments/outfits. Dress the figure in ${nSketch > 1 ? 'these designs' : 'this design'}, faithfully translating the sketched design — silhouette, proportions, layers, key details — into real, well-made clothing worn by the figure.`,
    );
  }
  if (nRef > 0) {
    parts.push(
      nSketch > 0
        ? `The final ${nRef} image${nRef > 1 ? 's are' : ' is a'} STYLE REFERENCE${nRef > 1 ? 's' : ''} — use ${nRef > 1 ? 'them' : 'it'} ONLY for material, colour, texture, print and styling cues to inform how the garments look. Do NOT reproduce ${nRef > 1 ? 'them' : 'it'} as separate objects.`
        : `The next ${nRef} image${nRef > 1 ? 's show garments/outfits' : ' shows a garment/outfit'} to wear. Dress the figure in ${nRef > 1 ? 'them' : 'it'}, faithfully reproducing the garment${nRef > 1 ? 's' : ''} as real worn clothing.`,
    );
  }
  parts.push(FRAMING);
  parts.push(
    'KEEP EVERYTHING ELSE IDENTICAL to the base photo: same faceless figure, body, pose, room, wall, floor, wiring panel and lighting. Only add the clothing; uncovered areas stay the black bodysuit. Output a single photorealistic, full-length image head to feet.',
  );
  return parts.join(' ');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { sketch, base, view } = body as { sketch?: string; base?: string; view?: string };
  const sketches: string[] = Array.isArray(body.sketches) ? body.sketches.filter((x: unknown) => typeof x === 'string') : [];
  const refs: string[] = Array.isArray(body.images) ? body.images.filter((x: unknown) => typeof x === 'string') : [];
  const combined = sketches.length > 0 || refs.length > 0;

  if (!base) return NextResponse.json({ error: 'missing base image' }, { status: 400 });
  if (!combined && !sketch) return NextResponse.json({ error: 'plug in a sketch or image first' }, { status: 400 });

  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }
  try {
    // image order matters — the prompt refers to FIRST / next / final images by position
    const prompt = combined ? combinedPrompt(sketches.length, refs.length) : promptFor(view || 'front');
    const imgs = combined ? [base, ...sketches, ...refs] : [base, sketch!];
    const image = await editImage(prompt, imgs);
    return NextResponse.json({ image });
  } catch (e) {
    console.error('[visualise] failed:', (e as Error).message);
    await refundGeneration();
    return NextResponse.json({ error: (e as Error).message || 'generation failed' }, { status: 500 });
  }
}
