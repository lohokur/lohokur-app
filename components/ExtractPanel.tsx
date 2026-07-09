'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Work = { cv: HTMLCanvasElement; data: Uint8ClampedArray; w: number; h: number };

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
  const workRef = useRef<Work | null>(null);        // downscaled source pixels for flood fill
  const maskRef = useRef<Uint8Array | null>(null);  // work-res binary mask
  const edgeRef = useRef<HTMLCanvasElement | null>(null);
  const silRef = useRef<HTMLCanvasElement | null>(null);
  const scribble = useRef<{ x: number; y: number }[]>([]); // overlay coords
  const drawing = useRef(false);
  const [status, setStatus] = useState('');
  const [hasMask, setHasMask] = useState(false);
  const [tol, setTol] = useState(48);

  const sizeOverlay = useCallback(() => {
    const img = imgRef.current, ov = overlayRef.current;
    if (!img || !ov) return;
    ov.width = img.clientWidth;
    ov.height = img.clientHeight;
  }, []);

  // build the downscaled working canvas (for fast flood fill) when the image loads
  const onImgLoad = useCallback(() => {
    sizeOverlay();
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
    const s = Math.min(1, 700 / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * s)), h = Math.max(1, Math.round(nh * s));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    workRef.current = { cv, data: ctx.getImageData(0, 0, w, h).data, w, h };
    maskRef.current = null; edgeRef.current = null; silRef.current = null;
    scribble.current = []; setHasMask(false);
    setStatus('scribble over a piece to lift it');
  }, [sizeOverlay]);

  // region-grow a mask from the scribbled pixels (flood fill within a colour tolerance)
  const grow = useCallback(() => {
    const wk = workRef.current, ov = overlayRef.current;
    if (!wk || !ov || scribble.current.length === 0) return;
    const { data, w, h } = wk;
    const sx = w / ov.width, sy = h / ov.height;
    const mask = new Uint8Array(w * h);
    const q: number[] = [];
    let mr = 0, mg = 0, mb = 0, sc = 0;
    const brush = 3;
    for (const p of scribble.current) {
      const cx = Math.round(p.x * sx), cy = Math.round(p.y * sy);
      for (let dy = -brush; dy <= brush; dy++) for (let dx = -brush; dx <= brush; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const idx = y * w + x, i = idx * 4;
        mr += data[i]; mg += data[i + 1]; mb += data[i + 2]; sc++;
        if (!mask[idx]) { mask[idx] = 1; q.push(idx); }
      }
    }
    if (!sc) return;
    mr /= sc; mg /= sc; mb /= sc;
    const t2 = tol * tol;
    while (q.length) {
      const idx = q.pop()!, x = idx % w, y = (idx / w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0), ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nidx = ny * w + nx;
        if (mask[nidx]) continue;
        const i = nidx * 4;
        const dr = data[i] - mr, dg = data[i + 1] - mg, db = data[i + 2] - mb;
        if (dr * dr + dg * dg + db * db < t2) { mask[nidx] = 1; q.push(nidx); }
      }
    }
    maskRef.current = mask;

    // faint fill (mint) for the selected region
    const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
    const scx = sil.getContext('2d')!; const sd = scx.createImageData(w, h);
    let area = 0;
    for (let k = 0; k < w * h; k++) if (mask[k]) { const i = k * 4; sd.data[i] = 124; sd.data[i + 1] = 255; sd.data[i + 2] = 176; sd.data[i + 3] = 255; area++; }
    scx.putImageData(sd, 0, 0); silRef.current = sil;

    // edge band (a pixel is on the edge if it's filled but touches empty) — no AI
    const on = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
    const thin = document.createElement('canvas'); thin.width = w; thin.height = h;
    const ecx = thin.getContext('2d')!; const ed = ecx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) {
        const i = (y * w + x) * 4; ed.data[i] = 198; ed.data[i + 1] = 255; ed.data[i + 2] = 218; ed.data[i + 3] = 255;
      }
    }
    ecx.putImageData(ed, 0, 0);
    const edge = document.createElement('canvas'); edge.width = w; edge.height = h;
    const etx = edge.getContext('2d')!;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) etx.drawImage(thin, dx, dy);
    edgeRef.current = edge;

    setHasMask(area > 40);
    setStatus(area > 40 ? 'lift it — or drag the slider / re-scribble to refine' : 'try a longer scribble across the piece');
  }, [tol]);

  // re-grow live when the tolerance changes
  useEffect(() => { if (!drawing.current && scribble.current.length) grow(); }, [tol, grow]);

  // reset when opened
  useEffect(() => {
    if (!open) return;
    maskRef.current = null; edgeRef.current = null; silRef.current = null; scribble.current = [];
    setHasMask(false); setStatus('scribble over a piece to lift it');
  }, [open, image]);

  // render loop — scribble stroke while drawing, glowing outline + shimmer once a mask exists
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const render = (now: number) => {
      const ov = overlayRef.current;
      if (ov) {
        const ctx = ov.getContext('2d')!;
        ctx.clearRect(0, 0, ov.width, ov.height);
        if (drawing.current && scribble.current.length) {
          ctx.save();
          ctx.strokeStyle = 'rgba(124,255,176,.85)'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.shadowColor = '#7cffb0'; ctx.shadowBlur = 10;
          ctx.beginPath();
          const pts = scribble.current; ctx.moveTo(pts[0].x, pts[0].y);
          for (const p of pts) ctx.lineTo(p.x, p.y);
          ctx.stroke(); ctx.restore();
        } else if (edgeRef.current && silRef.current) {
          const e = edgeRef.current, s = silRef.current;
          ctx.save(); ctx.globalAlpha = 0.12; ctx.drawImage(s, 0, 0, ov.width, ov.height); ctx.restore();
          ctx.save(); ctx.shadowColor = '#7cffb0'; ctx.shadowBlur = 12;
          ctx.drawImage(e, 0, 0, ov.width, ov.height); ctx.drawImage(e, 0, 0, ov.width, ov.height); ctx.restore();
          ctx.save(); ctx.globalCompositeOperation = 'source-atop';
          const span = ov.width + ov.height, pos = (now * 0.28) % (span + 400) - 200;
          const g = ctx.createLinearGradient(pos - 160, -160, pos, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, ov.width, ov.height); ctx.restore();
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const down = useCallback((e: React.PointerEvent) => {
    const ov = overlayRef.current; if (!ov) return;
    const r = ov.getBoundingClientRect();
    drawing.current = true;
    scribble.current = [{ x: e.clientX - r.left, y: e.clientY - r.top }];
    edgeRef.current = null; silRef.current = null; maskRef.current = null; setHasMask(false);
    ov.setPointerCapture?.(e.pointerId);
  }, []);
  const move = useCallback((e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ov = overlayRef.current; if (!ov) return;
    const r = ov.getBoundingClientRect();
    scribble.current.push({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);
  const up = useCallback(() => { if (!drawing.current) return; drawing.current = false; grow(); }, [grow]);

  // client-side cutout: source pixels masked onto transparent — instant, no AI
  const lift = useCallback(() => {
    const wk = workRef.current, mask = maskRef.current, img = imgRef.current;
    if (!wk || !mask || !img) return;
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
    const mcv = document.createElement('canvas'); mcv.width = wk.w; mcv.height = wk.h;
    const mcx = mcv.getContext('2d')!; const md = mcx.createImageData(wk.w, wk.h);
    for (let k = 0; k < wk.w * wk.h; k++) if (mask[k]) md.data[k * 4 + 3] = 255;
    mcx.putImageData(md, 0, 0);
    const out = document.createElement('canvas'); out.width = nw; out.height = nh;
    const ocx = out.getContext('2d')!;
    ocx.drawImage(img, 0, 0, nw, nh);
    ocx.globalCompositeOperation = 'destination-in';
    ocx.drawImage(mcv, 0, 0, nw, nh);
    onExtracted(out.toDataURL('image/png'));
    onClose();
  }, [onExtracted, onClose]);

  return (
    <aside className={`extractpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sp-head">
        <span>Extract</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="ex-stage">
        {image ? (
          <>
            <img ref={imgRef} src={image} alt="Look" className="ex-img" onLoad={onImgLoad} draggable={false} />
            <canvas
              ref={overlayRef}
              className="ex-overlay"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
            />
          </>
        ) : (
          <div className="ex-empty">connect a visualised look, then open Extract</div>
        )}
      </div>
      <div className="ex-tools">
        <label className="ex-tol">
          <span>edge</span>
          <input type="range" min={18} max={110} value={tol} onChange={(e) => setTol(+e.target.value)} />
        </label>
        <button className="ex-lift" disabled={!hasMask} onClick={lift}>Lift piece</button>
      </div>
      <div className="ex-status">{status}</div>
    </aside>
  );
}
