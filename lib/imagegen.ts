import { getGenAI } from '@/lib/genai';
import { falEdit, falGenerate } from '@/lib/fal';
import { persistImage } from '@/lib/storage';

/**
 * Provider-agnostic image generation.
 *
 * - If FAL_KEY is set → fal.ai (Nano Banana Pro). This is the public/prod path
 *   (works on Vercel, no Google org-policy issues).
 * - Otherwise → Gemini via Vertex+ADC (local dev fallback, needs
 *   `gcloud auth application-default login`).
 *
 * Whatever the provider returns (a fal URL or a data URL) is uploaded to our own
 * Supabase Storage via persistImage() so the canvas stores a lightweight, durable
 * URL instead of a base64 blob.
 */
const useFal = () => !!process.env.FAL_KEY;

function toPart(dataUrl: string) {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

async function geminiImage(prompt: string, images: string[]): Promise<string> {
  const ai = getGenAI();
  const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image';
  const parts = images.map(toPart).filter((p): p is NonNullable<typeof p> => !!p);
  const res = await ai.models.generateContent({ model, contents: [{ text: prompt }, ...parts] });
  const out = res?.candidates?.[0]?.content?.parts || [];
  for (const p of out) {
    if (p.inlineData?.data) {
      return `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`;
    }
  }
  const text = out.map((p) => p.text).filter(Boolean).join(' ');
  throw new Error(text ? `model returned no image: ${text.slice(0, 200)}` : 'model returned no image');
}

/** Edit / transform input images per the prompt. `pro` picks Nano Banana Pro vs the cheaper model. */
export async function editImage(prompt: string, images: string[], pro = true): Promise<string> {
  const out = useFal() ? await falEdit(prompt, images, pro) : await geminiImage(prompt, images);
  return persistImage(out);
}

/** Generate from a prompt, optionally guided by reference images. `pro` picks the model. */
export async function generateImage(prompt: string, refs: string[] = [], pro = true): Promise<string> {
  const out = useFal() ? await falGenerate(prompt, refs, pro) : await geminiImage(prompt, refs);
  return persistImage(out);
}
