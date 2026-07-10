'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// A detected garment: friendly label + a full-image binary mask + a pre-tinted
// highlight canvas + pixel area (for smallest-wins hover).
type Piece = { label: string; w: number; h: number; hl: HTMLCanvasElement; area: number };

// SegFormer (ATR) clothing classes we treat as pickable garments; everything else
// (hair, face, skin, background) is ignored. Left/Right shoe merge into "shoes".
const GARMENT: Record<string, string> = {
  Hat: 'hat', Sunglasses: 'sunglasses', 'Upper-clothes': 'top', Skirt: 'skirt',
  Pants: 'trousers', Dress: 'dress', Belt: 'belt', 'Left-shoe': 'shoes',
  'Right-shoe': 'shoes', Bag: 'bag', Scarf: 'scarf',
};

// lazy singleton — the model downloads once and browser-caches after that
/* eslint-disable @typescript-eslint/no-explicit-any */
let segmenterPromise: Promise<any> | null = null;
function getSegmenter(onProgress?: (pct: number) => void): Promise<any> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.allowLocalModels = false; // fetch from the HF CDN, cache in the browser
      const hasGPU = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
      return pipeline('image-segmentation', 'mattmdjaga/segformer_b2_clothes', {
        device: hasGPU ? 'webgpu' : 'wasm',
        progress_callback: (x: any) => {
          if (x?.status === 'progress' && typeof x.progress === 'number') onProgress?.(x.progress);
        },
      });
    })();
  }
  return segmenterPromise;
}

// mint-tinted highlight canvas from a single-channel mask (RawImage)
function highlightFromMask(mask: any): HTMLCanvasElement {
  const { data, width, height } = mask;
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  for (let k = 0; k < width * height; k++) {
    if (data[k] > 127) { const i = k * 4; img.data[i] = 124; img.data[i + 1] = 255; img.data[i + 2] = 176; img.data[i + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function ExtractPanel({
  open,
  image,
  onExtracted,
  onClose,
}: {
  open: boolean;
  image?: string;
  onExtracted: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pieces = useRef<Piece[]>([]);
  const labelMap = useRef<{ map: Uint8Array; w: number; h: number } | null>(null);
  const [count, setCount] = useState(0);      // detected garment count (triggers re-render)
  const [hover, setHover] = useState(-1);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'detecting' | 'ready' | 'extracting'>('idle');
  const [loadPct, setLoadPct] = useState(0);
  const [status, setStatus] = useState('');

  const sizeOverlay = useCallback(() => {
    const img = imgRef.current, ov = overlayRef.current;
    if (!img || !ov) return;
    ov.width = img.clientWidth;
    ov.height = img.clientHeight;
  }, []);

  // detect garments in-browser whenever the panel opens with an image
  useEffect(() => {
    if (!open || !image) return;
    let cancelled = false;
    pieces.current = []; labelMap.current = null; setCount(0); setHover(-1);
    setPhase('loading'); setLoadPct(0); setStatus('preparing detector…');
    (async () => {
      try {
        const seg = await getSegmenter((pct) => { if (!cancelled) setLoadPct(pct); });
        if (cancelled) return;
        setPhase('detecting'); setStatus('detecting garments…');
        const out = await seg(image);
        if (cancelled) return;

        // keep garment classes, merge same friendly label (e.g. both shoes)
        const byLabel = new Map<string, { masks: any[]; }>(); // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const o of out) {
          const friendly = GARMENT[o.label as string];
          if (!friendly || !o.mask) continue;
          const g = byLabel.get(friendly) ?? { masks: [] };
          g.masks.push(o.mask);
          byLabel.set(friendly, g);
        }

        // build the label map (one pass) + a highlight canvas per garment
        const built: Piece[] = [];
        let mapW = 0, mapH = 0;
        for (const [label, g] of byLabel) {
          const first = g.masks[0];
          mapW = first.width; mapH = first.height;
          // union the masks for this label
          const union = new Uint8Array(mapW * mapH);
          for (const m of g.masks) for (let k = 0; k < mapW * mapH; k++) if (m.data[k] > 127) union[k] = 255;
          let area = 0; for (let k = 0; k < union.length; k++) if (union[k]) area++;
          if (area < 30) continue;
          built.push({ label, w: mapW, h: mapH, hl: highlightFromMask({ data: union, width: mapW, height: mapH }), area });
        }
        // smaller garments first so overlaps resolve to the more specific piece
        built.sort((a, b) => a.area - b.area);

        const map = new Uint8Array(mapW * mapH);
        built.forEach((p, i) => {
          const ctx = p.hl.getContext('2d')!;
          const d = ctx.getImageData(0, 0, p.w, p.h).data;
          for (let k = 0; k < mapW * mapH; k++) if (d[k * 4 + 3] > 0 && !map[k]) map[k] = i + 1;
        });

        if (cancelled) return;
        pieces.current = built;
        labelMap.current = mapW ? { map, w: mapW, h: mapH } : null;
        setCount(built.length);
        setPhase('ready');
        setStatus(built.length ? 'hover a garment · click to extract it off the model' : 'no garments detected');
      } catch (e) {
        if (!cancelled) { setPhase('idle'); setStatus(`detection failed: ${(e as Error).message?.slice(0, 80) || ''}`); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, image]);

  // which garment is under the cursor (label map lookup — instant)
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const ov = overlayRef.current, lm = labelMap.current;
    if (!ov || !lm) return -1;
    const r = ov.getBoundingClientRect();
    const mx = Math.floor(((clientX - r.left) / r.width) * lm.w);
    const my = Math.floor(((clientY - r.top) / r.height) * lm.h);
    if (mx < 0 || my < 0 || mx >= lm.w || my >= lm.h) return -1;
    return lm.map[my * lm.w + mx] - 1;
  }, []);

  // render loop — draw the hovered garment's mint highlight + shimmer
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const render = (now: number) => {
      const ov = overlayRef.current;
      if (ov) {
        const ctx = ov.getContext('2d')!;
        ctx.clearRect(0, 0, ov.width, ov.height);
        const p = pieces.current[hover];
        if (p && phase === 'ready') {
          ctx.save(); ctx.globalAlpha = 0.26; ctx.drawImage(p.hl, 0, 0, ov.width, ov.height); ctx.restore();
          ctx.save(); ctx.shadowColor = '#7cffb0'; ctx.shadowBlur = 14; ctx.globalAlpha = 0.9;
          ctx.drawImage(p.hl, 0, 0, ov.width, ov.height); ctx.restore();
          ctx.save(); ctx.globalCompositeOperation = 'source-atop';
          const span = ov.width + ov.height, pos = (now * 0.3) % (span + 400) - 200;
          const g = ctx.createLinearGradient(pos - 160, -160, pos, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, ov.width, ov.height); ctx.restore();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [open, hover, phase]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (phase !== 'ready') return;
    setHover(hitTest(e.clientX, e.clientY));
  }, [hitTest, phase]);

  // click a garment → AI-extract it as a clean product shot (model removed)
  const pick = useCallback(async () => {
    const p = pieces.current[hover];
    if (!p || !image || phase === 'extracting') return;
    setPhase('extracting'); setStatus(`extracting the ${p.label}…`);
    try {
      const r = await fetch('/api/extract', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, label: p.label }),
      });
      const j = await r.json();
      if (j.image) { onExtracted(j.image); onClose(); return; }
      setStatus(j.upgrade ? 'monthly generation limit reached — upgrade to extract more' : (j.error || 'extraction failed'));
    } catch {
      setStatus('extraction failed');
    }
    setPhase('ready');
  }, [hover, image, phase, onExtracted, onClose]);

  const busy = phase === 'loading' || phase === 'detecting' || phase === 'extracting';
  const hoveredLabel = hover >= 0 && count ? pieces.current[hover]?.label : undefined;

  return (
    <aside className={`extractpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sp-head">
        <span>Extract</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="ex-stage">
        {image ? (
          <>
            <img ref={imgRef} src={image} alt="Look" className="ex-img" onLoad={sizeOverlay} draggable={false} />
            <canvas
              ref={overlayRef}
              className={`ex-overlay${hover >= 0 && phase === 'ready' ? ' hot' : ''}`}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(-1)}
              onClick={pick}
            />
            {busy && (
              <div className="ex-busy">
                <span className="ex-spinner" />
                {phase === 'loading' ? `preparing detector… ${Math.round(loadPct)}%` : phase === 'detecting' ? 'detecting garments…' : 'extracting…'}
              </div>
            )}
            {hoveredLabel && phase === 'ready' && <div className="ex-tag">{hoveredLabel}</div>}
          </>
        ) : (
          <div className="ex-empty">connect a visualised look, then open Extract</div>
        )}
      </div>
      <div className="ex-status">{status}</div>
    </aside>
  );
}
