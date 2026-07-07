'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Piece = { label: string; box: number[]; sil: HTMLCanvasElement; area: number };

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
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
  const piecesRef = useRef<Piece[]>([]);
  const hoveredRef = useRef<Piece | null>(null);
  const [status, setStatus] = useState<string>('');
  const [hoverLabel, setHoverLabel] = useState<string>('');

  // build green silhouette canvases from Gemini masks (grayscale → green alpha)
  const build = useCallback(async (pieces: { label: string; box_2d: number[]; mask: string }[]) => {
    const out: Piece[] = [];
    for (const p of pieces) {
      if (!p.mask || !Array.isArray(p.box_2d) || p.box_2d.length !== 4) continue;
      try {
        const m = await loadImg(p.mask);
        const c = document.createElement('canvas');
        c.width = m.naturalWidth || 64;
        c.height = m.naturalHeight || 64;
        const cx = c.getContext('2d')!;
        cx.drawImage(m, 0, 0, c.width, c.height);
        const d = cx.getImageData(0, 0, c.width, c.height);
        const px = d.data;
        for (let k = 0; k < px.length; k += 4) {
          const on = px[k] > 110; // luminance threshold
          px[k] = 124; px[k + 1] = 255; px[k + 2] = 176; px[k + 3] = on ? 255 : 0;
        }
        cx.putImageData(d, 0, 0);
        const [y0, x0, y1, x1] = p.box_2d;
        out.push({ label: p.label, box: [y0, x0, y1, x1], sil: c, area: (y1 - y0) * (x1 - x0) });
      } catch {
        /* skip bad mask */
      }
    }
    out.sort((a, b) => a.area - b.area); // smaller pieces win hover priority
    piecesRef.current = out;
  }, []);

  const sizeOverlay = useCallback(() => {
    const img = imgRef.current, ov = overlayRef.current;
    if (!img || !ov) return;
    ov.width = img.clientWidth;
    ov.height = img.clientHeight;
  }, []);

  // segment when opened
  useEffect(() => {
    if (!open || !image) return;
    piecesRef.current = [];
    hoveredRef.current = null;
    setHoverLabel('');
    setStatus('detecting pieces…');
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/segment', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image }),
        });
        const j = await r.json();
        if (cancelled) return;
        if (j.pieces?.length) {
          await build(j.pieces);
          setStatus(`${piecesRef.current.length} pieces — hover to highlight, click to extract`);
        } else {
          setStatus('no pieces detected');
        }
      } catch {
        if (!cancelled) setStatus('detection failed');
      }
    })();
    return () => { cancelled = true; };
  }, [open, image, build]);

  const drawHalo = useCallback((p: Piece | null) => {
    const ov = overlayRef.current;
    if (!ov) return;
    const ctx = ov.getContext('2d')!;
    ctx.clearRect(0, 0, ov.width, ov.height);
    if (!p) return;
    const [y0, x0, y1, x1] = p.box;
    const bx = (x0 / 1000) * ov.width, by = (y0 / 1000) * ov.height;
    const bw = ((x1 - x0) / 1000) * ov.width, bh = ((y1 - y0) / 1000) * ov.height;
    ctx.save();
    ctx.shadowColor = '#7cffb0';
    ctx.shadowBlur = 16;
    for (let k = 0; k < 3; k++) ctx.drawImage(p.sil, bx, by, bw, bh);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.28;
    ctx.drawImage(p.sil, bx, by, bw, bh);
    ctx.restore();
  }, []);

  const hitTest = useCallback((cx: number, cy: number): Piece | null => {
    const ov = overlayRef.current;
    if (!ov) return null;
    const ix = (cx / ov.width) * 1000, iy = (cy / ov.height) * 1000;
    for (const p of piecesRef.current) {
      const [y0, x0, y1, x1] = p.box;
      if (ix < x0 || ix > x1 || iy < y0 || iy > y1) continue;
      const rx = Math.max(0, Math.min(p.sil.width - 1, Math.floor(((ix - x0) / (x1 - x0)) * p.sil.width)));
      const ry = Math.max(0, Math.min(p.sil.height - 1, Math.floor(((iy - y0) / (y1 - y0)) * p.sil.height)));
      if (p.sil.getContext('2d')!.getImageData(rx, ry, 1, 1).data[3] > 0) return p;
    }
    return null;
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    const ov = overlayRef.current;
    if (!ov) return;
    const r = ov.getBoundingClientRect();
    const p = hitTest(e.clientX - r.left, e.clientY - r.top);
    if (p !== hoveredRef.current) {
      hoveredRef.current = p;
      setHoverLabel(p?.label ?? '');
      drawHalo(p);
    }
  }, [hitTest, drawHalo]);

  const onLeave = useCallback(() => {
    hoveredRef.current = null;
    setHoverLabel('');
    drawHalo(null);
  }, [drawHalo]);

  const onClick = useCallback(async () => {
    const p = hoveredRef.current;
    if (!p || !image) return;
    setStatus(`extracting ${p.label}…`);
    try {
      const r = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, label: p.label }),
      });
      const j = await r.json();
      if (j.image) { onExtracted(j.image); onClose(); }
      else setStatus('extraction failed');
    } catch {
      setStatus('extraction failed');
    }
  }, [image, onExtracted, onClose]);

  return (
    <aside className={`extractpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sp-head">
        <span>Extract{hoverLabel ? ` · ${hoverLabel}` : ''}</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="ex-stage">
        {image ? (
          <>
            <img ref={imgRef} src={image} alt="Look" className="ex-img" onLoad={sizeOverlay} draggable={false} />
            <canvas
              ref={overlayRef}
              className="ex-overlay"
              onPointerMove={onMove}
              onPointerLeave={onLeave}
              onClick={onClick}
            />
          </>
        ) : (
          <div className="ex-empty">connect a visualised look, then open Extract</div>
        )}
      </div>
      <div className="ex-status">{status}</div>
    </aside>
  );
}
