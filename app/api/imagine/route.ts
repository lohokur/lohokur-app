import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Gemini image generation can take a while (~30–90s).
export const maxDuration = 300;

function toPart(dataUrl: string) {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null; // ignore non-base64 (e.g. svg/utf8) inputs
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

// Generic image endpoint:
//   { prompt }                    → text-to-image
//   { prompt, images: [dataUrl] } → transform/rebrand the given image(s) per the prompt
export async function POST(req: Request) {
  const { prompt, images } = await req.json().catch(() => ({}));
  if (!prompt || !String(prompt).trim()) {
    return NextResponse.json({ error: 'missing prompt' }, { status: 400 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
    const parts = (Array.isArray(images) ? images : [])
      .filter((x) => typeof x === 'string')
      .map(toPart)
      .filter((p): p is NonNullable<ReturnType<typeof toPart>> => !!p);

    const guide = parts.length
      ? 'You are given one or more source images. Transform / restyle / rebrand them exactly as described below, preserving the product itself faithfully unless told otherwise. Output a single photorealistic, high-resolution image. '
      : 'Generate a single photorealistic, high-resolution image as described below. ';

    const contents = [{ text: guide + String(prompt).trim() }, ...parts];
    const res = await ai.models.generateContent({ model, contents });
    const out = res?.candidates?.[0]?.content?.parts || [];
    for (const p of out) {
      if (p.inlineData?.data) {
        return NextResponse.json({ image: `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}` });
      }
    }
    const text = out.map((p) => p.text).filter(Boolean).join(' ');
    return NextResponse.json({ error: 'model returned no image', detail: text.slice(0, 300) }, { status: 502 });
  } catch (e) {
    let msg = (e as Error).message || 'generation failed';
    try { const p = JSON.parse(msg); msg = p?.error?.message || msg; } catch { /* not JSON */ }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
