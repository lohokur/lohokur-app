import { fal } from '@fal-ai/client';

/**
 * Image generation via fal.ai (aggregator) — Nano Banana Pro = Gemini 3 Pro Image.
 *
 * We go through fal instead of calling Google directly because the Google org
 * policy blocks API keys and ADC only works on a local machine. fal gives a
 * single key (FAL_KEY) that works anywhere, including Vercel.
 *
 * fal accepts base64 data-URIs directly in image_urls, and returns a hosted
 * URL. fal's hosted URLs are temporary, so the caller (imagegen) persists the
 * result to our own storage — we just return fal's URL here.
 */

// Pro (paid tiers) → Nano Banana Pro (~$0.15). Free tier → Nano Banana (~$0.039).
const EDIT_MODEL_PRO = process.env.FAL_EDIT_MODEL || 'fal-ai/nano-banana-pro/edit';
const EDIT_MODEL_FREE = process.env.FAL_EDIT_MODEL_FREE || 'fal-ai/nano-banana/edit';
const GEN_MODEL_PRO = process.env.FAL_GEN_MODEL || 'fal-ai/nano-banana-pro';
const GEN_MODEL_FREE = process.env.FAL_GEN_MODEL_FREE || 'fal-ai/nano-banana';
const RESOLUTION = process.env.FAL_RESOLUTION || '1K';

// Hard ceiling on a single fal job. fal.subscribe polls the queue with no timeout
// of its own, so a stuck job would otherwise hang until the serverless function is
// killed at maxDuration — stacking into minutes when several run in a row. We race
// it instead and fail fast so the caller can move on (or skip that asset).
const FAL_TIMEOUT_MS = Number(process.env.FAL_TIMEOUT_MS || 120000);
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t)) as Promise<T>;
}

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not configured');
  fal.config({ credentials: key });
  configured = true;
}

type FalImageResult = { data?: { images?: Array<{ url?: string }>; description?: string } };

function firstImageUrl(result: FalImageResult): string {
  const url = result?.data?.images?.[0]?.url;
  if (!url) throw new Error(result?.data?.description || 'model returned no image');
  return url;
}

// Run a fal job with a timeout, and turn account-level failures (exhausted balance,
// locked account, 403) into ONE clear, user-safe message instead of a raw "Forbidden".
async function subscribeSafe(model: string, input: Record<string, unknown>, label: string): Promise<FalImageResult> {
  try {
    return (await withTimeout(fal.subscribe(model, { input }), FAL_TIMEOUT_MS, label)) as FalImageResult;
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const any = e as any;
    const detail = `${any?.message ?? ''} ${JSON.stringify(any?.body ?? '')} ${any?.status ?? ''}`;
    if (/locked|exhausted balance|insufficient|\bforbidden\b|\b403\b|quota|billing/i.test(detail)) {
      throw new Error('The image service is temporarily unavailable — please try again shortly.');
    }
    throw e;
  }
}

/** Edit / transform one or more input images per the prompt. `pro` picks the model. */
export async function falEdit(prompt: string, imageDataUrls: string[], pro = true): Promise<string> {
  ensureConfigured();
  const result = await subscribeSafe(pro ? EDIT_MODEL_PRO : EDIT_MODEL_FREE,
    { prompt, image_urls: imageDataUrls, num_images: 1, output_format: 'png', resolution: RESOLUTION }, 'fal edit');
  return firstImageUrl(result);
}

/** Generate an image from a prompt (optionally guided by reference images). `pro` picks the model. */
export async function falGenerate(prompt: string, imageDataUrls: string[] = [], pro = true): Promise<string> {
  if (imageDataUrls.length) return falEdit(prompt, imageDataUrls, pro);
  ensureConfigured();
  const result = await subscribeSafe(pro ? GEN_MODEL_PRO : GEN_MODEL_FREE,
    { prompt, num_images: 1, output_format: 'png', resolution: RESOLUTION }, 'fal generate');
  return firstImageUrl(result);
}
