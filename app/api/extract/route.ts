import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 300;

function toPart(dataUrl: string) {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error('expected a base64 data URL');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

export async function POST(req: Request) {
  const { image, label } = await req.json().catch(() => ({}));
  if (!image || !label) return NextResponse.json({ error: 'missing image or label' }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  const prompt = [
    `From this photo, extract ONLY the ${label} that the figure is wearing.`,
    `Isolate that single piece as a clean e-commerce product shot — the ${label} on its own, centred,`,
    'on a plain seamless dark charcoal studio backdrop (about #101216) with soft even studio lighting and a subtle contact shadow.',
    'Remove the person/figure, all the other garments, and the background — nothing but this one piece.',
    'Keep its exact shape, panels, colour and material. Photorealistic, sharp, high detail, product-catalogue style. Square framing.',
  ].join(' ');
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
    const res = await ai.models.generateContent({ model, contents: [{ text: prompt }, toPart(image)] });
    const parts = res?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) {
        return NextResponse.json({ image: `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}` });
      }
    }
    return NextResponse.json({ error: 'model returned no image' }, { status: 502 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'extraction failed' }, { status: 500 });
  }
}
