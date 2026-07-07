import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Gemini image generation can take a while.
export const maxDuration = 60;

function toPart(dataUrl: string) {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error('expected a base64 data URL');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

const PROMPT = [
  'The FIRST image is the base model: a real photo of a faceless figure in a plain black bodysuit,',
  'standing in a bare concrete room with a wiring panel on the wall.',
  'The SECOND image is a rough hand-drawn sketch of a garment / outfit design.',
  '',
  'Dress the base figure in the garment(s) from the sketch. Faithfully translate the sketched design —',
  'silhouette, proportions, layers, key details — into real, well-made clothing worn by the figure.',
  '',
  'KEEP EVERYTHING ELSE IDENTICAL to the first photo: the same faceless figure, same body, same pose and',
  'stance, the exact same room, wall, floor, wiring panel, lighting, camera angle and framing. Do not change',
  'the setting or the figure — only add the sketched clothing onto the body. Anything the new clothing does',
  'not cover stays as the black bodysuit.',
  '',
  'Output a single photorealistic image, sharp and high detail, that looks like the original photo with the',
  'designed outfit now worn by the figure.',
].join(' ');

export async function POST(req: Request) {
  const { sketch, base } = await req.json().catch(() => ({}));
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
    const contents = [{ text: PROMPT }, toPart(base), toPart(sketch)];
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
