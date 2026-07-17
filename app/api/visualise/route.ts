import { NextResponse } from 'next/server';
import { editImage } from '@/lib/imagegen';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

// Image generation can take a while (~30–90s).
export const maxDuration = 300;

const FRAMING =
  'Reproduce the identical camera framing, crop, zoom, distance and ASPECT RATIO of the base photo: a FULL-LENGTH PORTRAIT with the ENTIRE figure visible from the top of the head down to the FEET on the floor, standing in the full room, same tall vertical proportions. Do NOT zoom in, crop to the upper body, or switch to a landscape/close-up composition.';

const BASE = 'The FIRST image is the base model: a real photo of a faceless figure in a plain black bodysuit, standing front-facing in a bare concrete room with a wiring panel on the wall.';

// Ordered mode: the FIRST plugged-in input is the primary design to realise; any
// remaining inputs are style/material references. Image order to the model is
// [base, primary, ...references].
function orderedPrompt(primaryKind: string, nRef: number) {
  const parts = [BASE];
  parts.push(
    primaryKind === 'sketch'
      ? 'The SECOND image is a hand-drawn DESIGN SKETCH of a garment / outfit. Dress the figure in this design, faithfully translating the sketch — silhouette, proportions, layers, key details — into real, well-made clothing worn by the figure.'
      : 'The SECOND image is a garment / outfit. Dress the figure in it, faithfully reproducing it as real, well-made clothing worn by the figure.',
  );
  if (nRef > 0) {
    parts.push(
      `The remaining ${nRef} image${nRef > 1 ? 's are' : ' is a'} STYLE REFERENCE${nRef > 1 ? 's' : ''} — use ${nRef > 1 ? 'them' : 'it'} ONLY for material, colour, texture, print and styling cues to inform how the garment looks. Do NOT reproduce ${nRef > 1 ? 'them' : 'it'} as separate objects.`,
    );
  }
  parts.push(FRAMING);
  parts.push(
    'KEEP EVERYTHING ELSE IDENTICAL to the base photo: same faceless figure, body, pose, room, wall, floor, wiring panel and lighting. Only add the clothing; uncovered areas stay the black bodysuit. Output a single photorealistic, full-length image head to feet.',
  );
  return parts.join(' ');
}

type Input = { url: string; kind: string };

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { sketch, base } = body as { sketch?: string; base?: string };
  const inputs: Input[] = Array.isArray(body.inputs)
    ? body.inputs.filter((i: unknown): i is Input => !!i && typeof (i as Input).url === 'string')
    : [];
  const ordered = inputs.length > 0;

  if (!base) return NextResponse.json({ error: 'missing base image' }, { status: 400 });
  if (!ordered && !sketch) return NextResponse.json({ error: 'plug in a sketch or image first' }, { status: 400 });

  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }
  try {
    // image order matters — the prompt refers to images by position (base, primary, refs)
    const primary = ordered ? inputs[0] : { url: sketch!, kind: 'sketch' };
    const refs = ordered ? inputs.slice(1) : [];
    const prompt = orderedPrompt(primary.kind, refs.length);
    const imgs = [base, primary.url, ...refs.map((r) => r.url)];
    const image = await editImage(prompt, imgs, gate.tier !== 'free');
    return NextResponse.json({ image });
  } catch (e) {
    console.error('[visualise] failed:', (e as Error).message);
    await refundGeneration();
    return NextResponse.json({ error: (e as Error).message || 'generation failed' }, { status: 500 });
  }
}
