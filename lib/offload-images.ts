'use client';

// Move base64 images OUT of the canvas flow and into Supabase Storage, keeping
// only the URL. Runs at save time and walks node data generically, so it catches
// every image field — sketch views, uploads, techpack mockups/flats/materials/
// labels — current and future — without per-field wiring.
//
// Safe by design: uploads are deduped per save; any failure keeps the inline
// base64 (the /api/persist-image route hands the original back), so nothing is
// ever lost. Already-hosted URLs (fal / Storage) are left untouched.

import type { Node } from '@xyflow/react';

const IMG_RE = /^data:image\/[a-z0-9.+-]+;base64,/i;

async function persist(dataUrl: string): Promise<string> {
  try {
    const r = await fetch('/api/persist-image', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
    });
    if (!r.ok) return dataUrl;
    const j = await r.json().catch(() => ({}));
    return typeof j.url === 'string' && j.url ? j.url : dataUrl;
  } catch {
    return dataUrl; // network hiccup → keep the inline copy
  }
}

type Cache = Record<string, string>;
// Shared per-call budget so a big canvas migrates over several saves instead of
// one burst, and so we STOP the moment uploads start failing (a sign the DB is
// struggling — the app must not pile on).
type Budget = { left: number; aborted: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mapValue(value: any, cache: Cache, budget: Budget): Promise<{ v: any; changed: boolean }> {
  if (typeof value === 'string') {
    if (!IMG_RE.test(value)) return { v: value, changed: false };
    if (budget.aborted || budget.left <= 0) return { v: value, changed: false }; // leave inline for a later save
    if (!(value in cache)) {
      budget.left--;
      const url = await persist(value);
      if (url === value) { budget.aborted = true; return { v: value, changed: false }; } // upload failed → back off
      cache[value] = url;
    }
    const url = cache[value];
    return { v: url, changed: url !== value };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out: unknown[] = [];
    for (const x of value) { const r = await mapValue(x, cache, budget); if (r.changed) changed = true; out.push(r.v); }
    return { v: changed ? out : value, changed };
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(value)) { const r = await mapValue(x, cache, budget); if (r.changed) changed = true; out[k] = r.v; }
    return { v: changed ? out : value, changed };
  }
  return { v: value, changed: false };
}

// Returns a new nodes array with base64 images replaced by Storage URLs, or null
// if nothing needed offloading. Offloads at most `maxPerCall` images per save
// (spreads a big migration) and stops entirely if an upload fails (backs off a
// struggling DB — the leftover images just migrate on a later, healthier save).
export async function offloadFlowImages(nodes: Node[], maxPerCall = 4): Promise<Node[] | null> {
  const cache: Cache = {};
  const budget: Budget = { left: maxPerCall, aborted: false };
  let changed = false;
  const out: Node[] = [];
  for (const n of nodes) {
    const r = await mapValue(n.data, cache, budget);
    if (r.changed) { out.push({ ...n, data: r.v }); changed = true; }
    else out.push(n);
  }
  return changed ? out : null;
}
