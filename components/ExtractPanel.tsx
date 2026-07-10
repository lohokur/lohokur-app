'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// A detected garment: friendly label + reveal mask (alpha=garment) + contour edge
// canvas + centroid (for the traveling ring) + pixel area (smallest-wins hover).
type Piece = { label: string; w: number; h: number; mask: HTMLCanvasElement; edge: HTMLCanvasElement; cx: number; cy: number; area: number };

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
/* eslint-enable @typescript-eslint/no-explicit-any */

// solid mask canvas (alpha = garment) — used to punch the sharp garment back through
function maskCanvas(data: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d')!; const img = ctx.createImageData(width, height);
  for (let k = 0; k < width * height; k++) if (data[k] > 127) img.data[k * 4 + 3] = 255;
  ctx.putImageData(img, 0, 0);
  return c;
}

// mint contour of the mask (a pixel is edge if it's garment and touches non-garment),
// thickened so it stays visible when scaled down
function edgeCanvas(data: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const on = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : data[y * width + x]);
  const thin = document.createElement('canvas'); thin.width = width; thin.height = height;
  const tctx = thin.getContext('2d')!; const img = tctx.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!data[y * width + x]) continue;
    if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) {
      const i = (y * width + x) * 4; img.data[i] = 198; img.data[i + 1] = 255; img.data[i + 2] = 218; img.data[i + 3] = 255;
    }
  }
  tctx.putImageData(img, 0, 0);
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  const ctx = c.getContext('2d')!;
  for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(thin, dx, dy);
  return c;
}

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
  const fxRef = useRef<HTMLCanvasElement | null>(null);
  const [count, setCount] = useState(0);
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

        // group garment classes by friendly label (merges both shoes)
        const byLabel = new Map<string, any[]>(); // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const o of out) {
          const friendly = GARMENT[o.label as string];
          if (!friendly || !o.mask) continue;
          (byLabel.get(friendly) ?? byLabel.set(friendly, []).get(friendly)!).push(o.mask);
        }

        const built: Piece[] = [];
        let mapW = 0, mapH = 0;
        for (const [label, masks] of byLabel) {
          mapW = masks[0].width; mapH = masks[0].height;
          const union = new Uint8Array(mapW * mapH);
          for (const m of masks) for (let k = 0; k < mapW * mapH; k++) if (m.data[k] > 127) union[k] = 255;
          let area = 0, sx = 0, sy = 0;
          for (let y = 0; y < mapH; y++) for (let x = 0; x < mapW; x++) if (union[y * mapW + x]) { area++; sx += x; sy += y; }
          if (area < 30) continue;
          built.push({
            label, w: mapW, h: mapH, area,
            mask: maskCanvas(union, mapW, mapH),
            edge: edgeCanvas(union, mapW, mapH),
            cx: sx / area / mapW, cy: sy / area / mapH,
          });
        }
        built.sort((a, b) => a.area - b.area); // smaller garments win overlaps

        const map = new Uint8Array(mapW * mapH);
        built.forEach((p, i) => {
          const d = p.mask.getContext('2d')!.getImageData(0, 0, p.w, p.h).data;
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

  const hitTest = useCallback((clientX: number, clientY: number) => {
    const ov = overlayRef.current, lm = labelMap.current;
    if (!ov || !lm) return -1;
    const r = ov.getBoundingClientRect();
    const mx = Math.floor(((clientX - r.left) / r.width) * lm.w);
    const my = Math.floor(((clientY - r.top) / r.height) * lm.h);
    if (mx < 0 || my < 0 || mx >= lm.w || my >= lm.h) return -1;
    return lm.map[my * lm.w + mx] - 1;
  }, []);

  // render loop — spotlight the hovered garment: blur+darken everything else, keep
  // the garment sharp, and trace a glowing ring that travels round its contour
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const render = (now: number) => {
      const ov = overlayRef.current, img = imgRef.current;
      if (ov && img && ov.width) {
        const ctx = ov.getContext('2d')!;
        ctx.clearRect(0, 0, ov.width, ov.height);
        const p = pieces.current[hover];
        if (p && phase === 'ready') {
          // a whisper of dim on everything but the hovered garment (no blur — subtle)
          ctx.save();
          ctx.fillStyle = 'rgba(6,7,8,0.18)';
          ctx.fillRect(0, 0, ov.width, ov.height);
          ctx.globalCompositeOperation = 'destination-out';
          ctx.drawImage(p.mask, 0, 0, ov.width, ov.height);
          ctx.restore();

          // animated ring on a scratch canvas, then composite on top
          let fx = fxRef.current;
          if (!fx) { fx = document.createElement('canvas'); fxRef.current = fx; }
          if (fx.width !== ov.width || fx.height !== ov.height) { fx.width = ov.width; fx.height = ov.height; }
          const fc = fx.getContext('2d')!;
          fc.clearRect(0, 0, ov.width, ov.height);
          fc.save(); fc.shadowColor = '#7cffb0'; fc.shadowBlur = 12; fc.globalAlpha = 0.85;
          fc.drawImage(p.edge, 0, 0, ov.width, ov.height);
          fc.drawImage(p.edge, 0, 0, ov.width, ov.height);
          fc.restore();
          // a bright arc that rotates around the garment's centroid → light "round and around"
          if (typeof fc.createConicGradient === 'function') {
            fc.save(); fc.globalCompositeOperation = 'source-atop';
            const cg = fc.createConicGradient((now * 0.0018) % (Math.PI * 2), p.cx * ov.width, p.cy * ov.height);
            cg.addColorStop(0, 'rgba(255,255,255,0)');
            cg.addColorStop(0.06, 'rgba(255,255,255,0.95)');
            cg.addColorStop(0.14, 'rgba(255,255,255,0)');
            cg.addColorStop(1, 'rgba(255,255,255,0)');
            fc.fillStyle = cg; fc.fillRect(0, 0, ov.width, ov.height);
            fc.restore();
          }
          ctx.drawImage(fx, 0, 0);
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
