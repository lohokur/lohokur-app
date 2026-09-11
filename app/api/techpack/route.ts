import { NextResponse } from 'next/server';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';
import { editImage } from '@/lib/imagegen';
import { usesProModel } from '@/lib/entitlements';

// Same technical-flat prompt as /api/techpack/assets 'vector' — the front flat is
// generated inline with the pack (one charge) so it's guaranteed on every plan.
const FLAT_PROMPT =
  'Turn this garment photo into a clean 2D TECHNICAL FLAT drawing (flat-lay / CAD line-art): crisp black outlines on a PURE WHITE background, showing seams, panels, top-stitching, closures and construction lines. Flat, front-on, no shading, no gradients, no model, no background, no colour fill — just the technical line drawing, like a factory tech pack flat.';
import { supabaseServer } from '@/lib/supabase/server';
import { rowId } from '@/lib/techpack';
import { nearestPantone } from '@/lib/pantone';

// Vision → tech pack. An AI model looks at whatever design is plugged into the
// Techpack node and drafts a full, factory-ready pack (measurements, materials,
// construction, sewing, colourways) that the user can then edit + export.
// Uses OpenAI vision (gpt-4o) — the Gemini key is out of prepaid credits.
export const maxDuration = 300;

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PROMPT = `You are a senior technical apparel designer. Look at this garment image and produce a complete, factory-ready TECH PACK for it as JSON. Base EVERYTHING on what you actually see — silhouette, panels, seams, closures, trims, materials and colours.

Return ONLY a JSON object (no markdown, no commentary) with exactly these keys:
{
  "name": string,
  "subtitle": string,
  "category": string,
  "fabric": string,
  "season": string,
  "sizeRange": "XS – XXL",
  "info": { "type": string, "silhouette": string, "construction": string },
  "poms": [ { "name": string, "tol": string, "v": { "XS": string, "S": string, "M": string, "L": string, "XL": string, "XXL": string } } ],
  "materials": [ { "ref": string, "name": string, "placement": string, "desc": string } ],
  "trims": [ { "section": string, "type": string, "desc": string } ],
  "sewing": [ string ],
  "colorways": [ { "placement": string, "pantone": string, "hex": string } ]
}

Rules:
- name: short product name (e.g. "Oversized zip hoodie"). subtitle: one line — main fabric + key features.
- poms (points of measure): pick the measurements that ACTUALLY matter for THIS garment type (a hoodie differs from trousers). 10-16 rows. Give realistic values in CENTIMETRES for every size XS-XXL, graded sensibly (~3-5 cm apart, larger steps for widths). "tol" like "±1.0".
- materials: the real bill of materials you'd expect (shell, ribs, trims, zips, thread, labels) with ref "1","2",... short placement + spec. 5-9 rows.
- trims: construction detail rows — section + type + short description. 3-6 rows.
- sewing: ordered construction steps. 5-8 steps.
- colorways: the colours visible on the piece, each with a plausible Pantone code and a matching hex.
- All measurements in cm, sample size M. Output ONLY the JSON object.`;

const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : x == null ? '' : String(x));
const fillSizes = (v: unknown): Record<string, string> => {
  const src = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const o: Record<string, string> = {};
  for (const s of SIZES) o[s] = src[s] != null ? String(src[s]) : '';
  return o;
};
const hex = (x: unknown): string => {
  const h = str(x);
  if (/^#[0-9a-f]{3,8}$/i.test(h)) return h;
  if (/^[0-9a-f]{6}$/i.test(h)) return `#${h}`;
  return '#333333';
};
function rows<T>(arr: unknown, fn: (x: Record<string, unknown>, i: number) => T | null): T[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out = arr.map((x, i) => (x && typeof x === 'object' ? fn(x as Record<string, unknown>, i) : null)).filter((x): x is T => x != null);
  return out.length ? out : undefined;
}

// OpenAI vision accepts a data: URL or a public https URL directly as image_url.
export async function POST(req: Request) {
  const { image } = await req.json().catch(() => ({}));
  if (!image || typeof image !== 'string') return NextResponse.json({ error: 'missing image' }, { status: 400 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'vision model not configured' }, { status: 500 });

  const gate = await consumeGeneration();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }

  try {
    const model = process.env.OPENAI_TECHPACK_MODEL || 'gpt-4o';
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: image } },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      await refundGeneration();
      return NextResponse.json({ error: 'vision model error', detail }, { status: 502 });
    }
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s < 0 || e < 0) { await refundGeneration(); return NextResponse.json({ error: 'no JSON from model', detail: text.slice(0, 300) }, { status: 502 }); }

    let raw: Record<string, unknown>;
    try { raw = JSON.parse(text.slice(s, e + 1)); } catch { await refundGeneration(); return NextResponse.json({ error: 'bad JSON from model' }, { status: 502 }); }

    // vendor = the signed-in user's name (from OAuth), else their email handle
    let vendor = '';
    try {
      const sb = await supabaseServer();
      const { data: { user } } = await sb.auth.getUser();
      const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
      vendor = String(meta.full_name || meta.name || (user?.email ? user.email.split('@')[0] : '') || '').trim();
    } catch { /* ignore */ }

    const info = (raw.info && typeof raw.info === 'object' ? raw.info : {}) as Record<string, unknown>;
    // partial Techpack — the client merges it over defaults (normalizeTechpack) and adds the flat
    const techpack = {
      name: str(raw.name) || 'Untitled garment',
      subtitle: str(raw.subtitle),
      vendor,
      category: str(raw.category),
      fabric: str(raw.fabric),
      season: str(raw.season),
      sizeRange: str(raw.sizeRange) || 'XS – XXL',
      sizes: SIZES,
      sampleSize: 'M',
      unit: 'cm',
      info: { type: str(info.type), silhouette: str(info.silhouette), construction: str(info.construction) },
      poms: rows(raw.poms, (p) => (str(p.name) ? { id: rowId(), name: str(p.name), tol: str(p.tol) || '±1.0', v: fillSizes(p.v) } : null)),
      materials: rows(raw.materials, (m, i) => (str(m.name) || str(m.desc) ? { id: rowId(), ref: str(m.ref) || String(i + 1), name: str(m.name), placement: str(m.placement), desc: str(m.desc) } : null)),
      trims: rows(raw.trims, (t) => (str(t.section) || str(t.type) || str(t.desc) ? { id: rowId(), section: str(t.section), type: str(t.type), desc: str(t.desc) } : null)),
      sewing: Array.isArray(raw.sewing) ? (raw.sewing as unknown[]).map(str).filter(Boolean) : undefined,
      // colourways synced to the nearest official Pantone colour
      colorways: rows(raw.colorways, (c) => { const h = hex(c.hex); return { id: rowId(), placement: str(c.placement), pantone: nearestPantone(h), hex: h }; }),
    };

    // The FRONT technical flat is part of the tech pack itself — generated here under
    // the pack's single charge so every plan (free included) always gets it. Side/back
    // flats + material swatches stay separately metered (paid). A flat failure never
    // fails the pack — the JSON still ships.
    let frontFlat: string | undefined;
    try { frontFlat = await editImage(FLAT_PROMPT, [image], usesProModel(gate.tier)); }
    catch (e) { console.error('[techpack] front flat failed:', (e as Error).message); /* pack ships without it; client recovers */ }

    return NextResponse.json({ techpack, frontFlat });
  } catch (err) {
    await refundGeneration();
    return NextResponse.json({ error: (err as Error).message || 'tech pack generation failed' }, { status: 500 });
  }
}
