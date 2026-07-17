import { NextResponse } from 'next/server';
import { editImage } from '@/lib/imagegen';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { image, label } = await req.json().catch(() => ({}));
  if (!image || !label) return NextResponse.json({ error: 'missing image or label' }, { status: 400 });
  const prompt = [
    `From this photo, extract ONLY the ${label} that the figure is wearing.`,
    `Isolate that single piece as a clean e-commerce product shot — the ${label} on its own, centred,`,
    'on a plain seamless dark charcoal studio backdrop (about #101216) with soft even studio lighting and a subtle contact shadow.',
    'Remove the person/figure, all the other garments, and the background — nothing but this one piece.',
    'Keep its exact shape, panels, colour and material. Photorealistic, sharp, high detail, product-catalogue style. Square framing.',
  ].join(' ');
  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }
  try {
    const out = await editImage(prompt, [image], gate.tier !== 'free');
    return NextResponse.json({ image: out });
  } catch (e) {
    await refundGeneration();
    return NextResponse.json({ error: (e as Error).message || 'extraction failed' }, { status: 500 });
  }
}
