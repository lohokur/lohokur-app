'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// A detected garment: label + bounding box (y0,x0,y1,x1 normalised 0–1000) + a
// grayscale mask PNG (white = the piece) that fills the box.
type Piece = { label: string; box: [number, number, number, number]; mask: string };
type Prepared = { piece: Piece; hl: HTMLCanvasElement; area: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

// turn a grayscale mask into a mint-tinted RGBA canvas (alpha = mask luminance)
async function makeHighlight(maskUrl: string): Promise<HTMLCanvasElement> {
  const im = await loadImage(maskUrl);
  const c = document.createElement('canvas');
  c.width = im.naturalWidth || 64;
  c.height = im.naturalHeight || 64;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(im, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const lum = d.data[i]; // grayscale → alpha
    d.data[i] = 124; d.data[i + 1] = 255; d.data[i + 2] = 176; d.data[i + 3] = lum;
  }
  ctx.putImageData(d, 0, 0);
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
  const prepared = useRef<Prepared[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [hover, setHover] = useState(-1);
  const [detecting, setDetecting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [status, setStatus] = useState('');

  const sizeOverlay = useCallback(() => {
    const img = imgRef.current, ov = overlayRef.current;
    if (!img || !ov) return;
    ov.width = img.clientWidth;
    ov.height = img.clientHeight;
  }, []);

  // detect garments whenever the panel opens with an image
  useEffect(() => {
    if (!open || !image) return;
    let cancelled = false;
    setPieces([]); prepared.current = []; setHover(-1); setExtracting(false);
    setDetecting(true); setStatus('detecting garments…');
    (async () => {
      try {
        const r = await fetch('/api/segment', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image }),
        });
        const j = await r.json();
        if (cancelled) return;
        const raw = (j.pieces ?? []) as { label?: string; box_2d?: number[]; mask?: string }[];
        const ps: Piece[] = raw
          .filter((p) => p.mask && Array.isArray(p.box_2d) && p.box_2d.length === 4 && p.label)
          .map((p) => ({ label: String(p.label), box: p.box_2d as [number, number, number, number], mask: String(p.mask) }));
        prepared.current = await Promise.all(
          ps.map(async (piece) => {
            const [y0, x0, y1, x1] = piece.box;
            const area = Math.max(1, (x1 - x0) * (y1 - y0));
            let hl: HTMLCanvasElement;
            try { hl = await makeHighlight(piece.mask); } catch { hl = document.createElement('canvas'); }
            return { piece, hl, area };
          }),
        );
        if (cancelled) return;
        setPieces(ps);
        setDetecting(false);
        setStatus(ps.length ? 'hover a garment · click to extract it off the model' : 'no garments detected — try another look');
      } catch {
        if (!cancelled) { setDetecting(false); setStatus('detection failed'); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, image]);

  // which piece is under the cursor (smallest containing box wins)
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const ov = overlayRef.current;
    if (!ov) return -1;
    const r = ov.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 1000;
    const ny = ((clientY - r.top) / r.height) * 1000;
    let best = -1, bestArea = Infinity;
    prepared.current.forEach((p, i) => {
      const [y0, x0, y1, x1] = p.piece.box;
      if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1 && p.area < bestArea) { best = i; bestArea = p.area; }
    });
    return best;
  }, []);

  // render loop — draw the hovered piece's mint highlight + shimmer
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const render = (now: number) => {
      const ov = overlayRef.current;
      if (ov) {
        const ctx = ov.getContext('2d')!;
        ctx.clearRect(0, 0, ov.width, ov.height);
        const p = prepared.current[hover];
        if (p && !extracting) {
          const [y0, x0, y1, x1] = p.piece.box;
          const bx = (x0 / 1000) * ov.width, by = (y0 / 1000) * ov.height;
          const bw = ((x1 - x0) / 1000) * ov.width, bh = ((y1 - y0) / 1000) * ov.height;
          ctx.save();
          ctx.globalAlpha = 0.28; ctx.drawImage(p.hl, bx, by, bw, bh);
          ctx.restore();
          ctx.save();
          ctx.shadowColor = '#7cffb0'; ctx.shadowBlur = 14; ctx.globalAlpha = 0.9;
          ctx.drawImage(p.hl, bx, by, bw, bh);
          ctx.restore();
          // shimmer sweep clipped to what's drawn (the mask)
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          const span = ov.width + ov.height, pos = (now * 0.3) % (span + 400) - 200;
          const g = ctx.createLinearGradient(pos - 160, -160, pos, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, ov.width, ov.height);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [open, hover, extracting]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (extracting) return;
    setHover(hitTest(e.clientX, e.clientY));
  }, [hitTest, extracting]);

  // click a garment → AI-extract it as a clean product shot (model removed)
  const pick = useCallback(async () => {
    const p = prepared.current[hover];
    if (!p || !image || extracting) return;
    setExtracting(true);
    setStatus(`extracting the ${p.piece.label}…`);
    try {
      const r = await fetch('/api/extract', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, label: p.piece.label }),
      });
      const j = await r.json();
      if (j.image) { onExtracted(j.image); onClose(); return; }
      setStatus(j.upgrade ? 'monthly generation limit reached — upgrade to extract more' : (j.error || 'extraction failed'));
    } catch {
      setStatus('extraction failed');
    }
    setExtracting(false);
  }, [hover, image, extracting, onExtracted, onClose]);

  const hoveredLabel = hover >= 0 ? pieces[hover]?.label : undefined;

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
              className={`ex-overlay${hover >= 0 && !extracting ? ' hot' : ''}`}
              onPointerMove={onMove}
              onPointerLeave={() => setHover(-1)}
              onClick={pick}
            />
            {(detecting || extracting) && (
              <div className="ex-busy"><span className="ex-spinner" />{detecting ? 'detecting garments…' : 'extracting…'}</div>
            )}
            {hoveredLabel && !extracting && <div className="ex-tag">{hoveredLabel}</div>}
          </>
        ) : (
          <div className="ex-empty">connect a visualised look, then open Extract</div>
        )}
      </div>
      <div className="ex-status">{status}</div>
    </aside>
  );
}
