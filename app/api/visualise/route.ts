import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Gemini image generation can take a while (~30–90s).
export const maxDuration = 300;

function toPart(dataUrl: string) {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error('expected a base64 data URL');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

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

export async function POST(req: Request) {
  const { sketch, base, view } = await req.json().catch(() => ({}));
  if (!sketch || !base) {
    return NextResponse.json({ error: 'missing sketch or base image' }, { status: 400 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
    const contents = [{ text: promptFor(view || 'front') }, toPart(base), toPart(sketch)];
    const res = await ai.models.generateContent({ model, contents });
    const parts = res?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) {
        return NextResponse.json({
          image: `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`,
        });
      }
    }
    const text = parts.map((p) => p.text).filter(Boolean).join(' ');
    return NextResponse.json({ error: 'model returned no image', detail: text.slice(0, 300) }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'generation failed' }, { status: 500 });
  }
}
