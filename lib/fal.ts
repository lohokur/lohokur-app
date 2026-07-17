import { fal } from '@fal-ai/client';

/**
 * Image generation via fal.ai (aggregator) — Nano Banana Pro = Gemini 3 Pro Image.
 *
 * We go through fal instead of calling Google directly because the Google org
 * policy blocks API keys and ADC only works on a local machine. fal gives a
 * single key (FAL_KEY) that works anywhere, including Vercel.
 *
 * fal accepts base64 data-URIs directly in image_urls, and returns a hosted
 * URL. We fetch that back into a self-contained data URL so the result persists
 * on the canvas (fal's hosted URLs are temporary).
 */

// Pro (paid tiers) → Nano Banana Pro (~$0.15). Free tier → Nano Banana (~$0.039).
const EDIT_MODEL_PRO = process.env.FAL_EDIT_MODEL || 'fal-ai/nano-banana-pro/edit';
const EDIT_MODEL_FREE = process.env.FAL_EDIT_MODEL_FREE || 'fal-ai/nano-banana/edit';
const GEN_MODEL_PRO = process.env.FAL_GEN_MODEL || 'fal-ai/nano-banana-pro';
const GEN_MODEL_FREE = process.env.FAL_GEN_MODEL_FREE || 'fal-ai/nano-banana';
const RESOLUTION = process.env.FAL_RESOLUTION || '1K';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not configured');
  fal.config({ credentials: key });
  configured = true;
}

async function toDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`failed to fetch generated image (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || 'image/png';
  return `data:${ct};base64,${buf.toString('base64')}`;
}

type FalImageResult = { data?: { images?: Array<{ url?: string }>; description?: string } };

function firstImageUrl(result: FalImageResult): string {
  const url = result?.data?.images?.[0]?.url;
  if (!url) throw new Error(result?.data?.description || 'model returned no image');
  return url;
}

/** Edit / transform one or more input images per the prompt. `pro` picks the model. */
export async function falEdit(prompt: string, imageDataUrls: string[], pro = true): Promise<string> {
  ensureConfigured();
  const result = (await fal.subscribe(pro ? EDIT_MODEL_PRO : EDIT_MODEL_FREE, {
    input: { prompt, image_urls: imageDataUrls, num_images: 1, output_format: 'png', resolution: RESOLUTION },
  })) as FalImageResult;
  return toDataUrl(firstImageUrl(result));
}

/** Generate an image from a prompt (optionally guided by reference images). `pro` picks the model. */
export async function falGenerate(prompt: string, imageDataUrls: string[] = [], pro = true): Promise<string> {
  if (imageDataUrls.length) return falEdit(prompt, imageDataUrls, pro);
  ensureConfigured();
  const result = (await fal.subscribe(pro ? GEN_MODEL_PRO : GEN_MODEL_FREE, {
    input: { prompt, num_images: 1, output_format: 'png', resolution: RESOLUTION },
  })) as FalImageResult;
  return toDataUrl(firstImageUrl(result));
}
