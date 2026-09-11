import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Render persistence.
 *
 * Generated images used to be stored as base64 data-URLs *inside* the project
 * flow (Postgres JSONB) — which bloated rows and slowed every save/load. Instead
 * we upload each render to a public Supabase Storage bucket and keep only the
 * URL on the canvas.
 *
 * Safe / hybrid by design:
 *  - Old base64 images already on canvases keep working untouched (no backfill).
 *  - If storage isn't configured (local dev has no service-role key) we return
 *    the input unchanged, so the canvas still works with data-URLs.
 *  - If an upload fails we fall back to a self-contained data-URL, so a render
 *    is never lost.
 */

const BUCKET = process.env.RENDER_BUCKET || 'renders';

// Never let a slow Storage upload (or a slow fetch of the provider's result URL)
// hang the request to the serverless limit — bound both and fall back to an inline
// data-URL, so a render is quick and never lost even when Storage is degraded.
const FETCH_TIMEOUT_MS = Number(process.env.STORAGE_FETCH_TIMEOUT_MS || 30000);
const UPLOAD_TIMEOUT_MS = Number(process.env.STORAGE_UPLOAD_TIMEOUT_MS || 30000);
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t)) as Promise<T>;
}

const configured = () =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Create the public bucket on first use (idempotent, cached per process).
let bucketReady: Promise<void> | null = null;
function ensureBucket() {
  if (!bucketReady) {
    bucketReady = (async () => {
      const admin = supabaseAdmin();
      const { data } = await admin.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await admin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: '20MB',
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      });
      // Another concurrent request may have created it first — that's fine.
      if (error && !/exists/i.test(error.message)) throw error;
    })().catch((e) => {
      bucketReady = null; // let the next call retry
      throw e;
    });
  }
  return bucketReady;
}

function extFor(contentType: string): string {
  if (/webp/.test(contentType)) return 'webp';
  if (/jpe?g/.test(contentType)) return 'jpg';
  return 'png';
}

/**
 * Given a data-URL or a remote (e.g. fal) URL, store the bytes in our bucket and
 * return a permanent public URL. Returns the input unchanged when storage isn't
 * configured; falls back to a data-URL if the upload fails.
 */
export async function persistImage(src: string): Promise<string> {
  if (!configured()) return src;

  let buf: Buffer;
  let contentType: string;
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(src);
  if (m) {
    contentType = m[1];
    buf = Buffer.from(m[2], 'base64');
  } else {
    const r = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!r.ok) throw new Error(`failed to fetch generated image (${r.status})`);
    contentType = r.headers.get('content-type') || 'image/png';
    buf = Buffer.from(await r.arrayBuffer());
  }

  const toDataUrl = () => `data:${contentType};base64,${buf.toString('base64')}`;

  try {
    await withTimeout(ensureBucket(), UPLOAD_TIMEOUT_MS, 'storage ensureBucket');
    const path = `${crypto.randomUUID()}.${extFor(contentType)}`;
    const admin = supabaseAdmin();
    const { error } = await withTimeout(
      admin.storage.from(BUCKET).upload(path, buf, { contentType, upsert: false }),
      UPLOAD_TIMEOUT_MS,
      'storage upload',
    );
    if (error) throw error;
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || toDataUrl();
  } catch (e) {
    // Never lose a render — fall back to an inline data-URL.
    console.error('[storage] upload failed, keeping inline:', (e as Error).message);
    return m ? src : toDataUrl();
  }
}

// ---- shared tech pack HTML -------------------------------------------------
// A dedicated public bucket that serves rendered tech packs as standalone HTML,
// so a manufacturer can open the link with no account. Keyed by a stable share
// id so re-sharing updates the same URL.
const HTML_BUCKET = process.env.TECHPACK_BUCKET || 'techpacks';
let htmlBucketReady: Promise<void> | null = null;
function ensureHtmlBucket() {
  if (!htmlBucketReady) {
    htmlBucketReady = (async () => {
      const admin = supabaseAdmin();
      const { data } = await admin.storage.getBucket(HTML_BUCKET);
      if (data) return;
      // no allowedMimeTypes restriction — Supabase rejects "text/html; charset=…"
      // against a strict ['text/html'] list, which was silently failing the upload
      const { error } = await admin.storage.createBucket(HTML_BUCKET, { public: true, fileSizeLimit: '10MB' });
      if (error && !/exists/i.test(error.message)) throw error;
    })().catch((e) => { htmlBucketReady = null; throw e; });
  }
  return htmlBucketReady;
}

export async function persistHtml(id: string, html: string): Promise<string | null> {
  if (!configured()) return null;
  await ensureHtmlBucket();
  const admin = supabaseAdmin();
  const path = `${id}.html`;
  const { error } = await admin.storage
    .from(HTML_BUCKET)
    .upload(path, Buffer.from(html, 'utf8'), { contentType: 'text/html', upsert: true });
  if (error) throw error;
  return admin.storage.from(HTML_BUCKET).getPublicUrl(path).data.publicUrl || null;
}
