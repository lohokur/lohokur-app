import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 120;

function toPart(dataUrl: string) {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) throw new Error('expected a base64 data URL');
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

const PROMPT = [
  'Give the segmentation masks for each distinct GARMENT, clothing or accessory piece worn by the figure in this photo',
  '(for example: jacket, top, trousers or leggings, boots, cap/hat, gloves, bag, belt).',
  'Do NOT include the body, skin, the plain black bodysuit base, or the background — only the distinct designed pieces.',
  'Output ONLY a JSON array. Each element must have exactly:',
  '"label" (short name of the piece), "box_2d" ([y0, x0, y1, x1] as integers normalized to 0-1000), and',
  '"mask" (a base64 PNG data URL — a grayscale mask that fills the bounding box, white = the piece).',
].join(' ');

export async function POST(req: Request) {
  const { image } = await req.json().catch(() => ({}));
  if (!image) return NextResponse.json({ error: 'missing image' }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_SEG_MODEL || 'gemini-2.5-flash';
    const res = await ai.models.generateContent({
      model,
      contents: [{ text: PROMPT }, toPart(image)],
    });
    const text = (res?.candidates?.[0]?.content?.parts || []).map((p) => p.text).filter(Boolean).join('');
    // strip code fences / leading prose, grab the JSON array
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart < 0 || jsonEnd < 0) {
      return NextResponse.json({ error: 'no JSON in response', detail: text.slice(0, 300) }, { status: 502 });
    }
    let pieces: unknown[];
    try {
      pieces = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    } catch {
      return NextResponse.json({ error: 'bad JSON', detail: text.slice(0, 300) }, { status: 502 });
    }
    return NextResponse.json({ pieces });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'segmentation failed' }, { status: 500 });
  }
}
