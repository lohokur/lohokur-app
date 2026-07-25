'use client';

import { useEffect, useRef } from 'react';

// Face-ID style loading: the image breaks up into a cloud of scanning dots while the
// edit is generating, then the dots gather back home when it finishes (active → false).
export default function FaceIdDissolve({ src, active }: { src: string; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const cv = ref.current; if (!cv || !src) return;
    const ctx = cv.getContext('2d')!;
    let raf = 0, cur = 0; // scatter amount 0..1
    let dots: { hx: number; hy: number; ox: number; oy: number; r: number; g: number; b: number; ph: number }[] = [];
    let W = 0, H = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const build = () => {
      const rect = cv.getBoundingClientRect();
      W = cv.width = Math.max(1, Math.round(rect.width));
      H = cv.height = Math.max(1, Math.round(rect.height));
      const cols = Math.min(64, Math.max(24, Math.round(W / 8)));
      const rows = Math.max(1, Math.round(cols * H / W));
      const off = document.createElement('canvas'); off.width = cols; off.height = rows;
      const octx = off.getContext('2d')!;
      const s = Math.max(cols / img.width, rows / img.height);
      const iw = img.width * s, ih = img.height * s;
      octx.drawImage(img, (cols - iw) / 2, (rows - ih) / 2, iw, ih);
      let data: Uint8ClampedArray | null = null;
      try { data = octx.getImageData(0, 0, cols, rows).data; } catch { data = null; }
      dots = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4;
        const a = data ? data[k + 3] : 255;
        if (a < 24) continue;
        const hx = (i + 0.5) / cols * W, hy = (j + 0.5) / rows * H;
        const hash = (i * 928371 + j * 1237) % 1000 / 1000;
        const ang = Math.atan2(hy - H / 2, hx - W / 2) + hash * 1.6;
        const dist = 10 + hash * 46;
        dots.push({ hx, hy, ox: Math.cos(ang) * dist, oy: Math.sin(ang) * dist, r: data ? data[k] : 210, g: data ? data[k + 1] : 210, b: data ? data[k + 2] : 210, ph: hash });
      }
    };

    let t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      cur += ((activeRef.current ? 1 : 0) - cur) * 0.05; // ease toward scattered / gathered
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        const jitter = Math.sin(t * 2.2 + d.ph * 6.28) * 4 * cur;
        const jx = Math.cos(t * 1.6 + d.ph * 9) * 3 * cur;
        const x = d.hx + d.ox * cur + jx;
        const y = d.hy + d.oy * cur + jitter;
        const rad = Math.max(0.6, 1.5 + Math.sin(t * 3 + d.ph * 8) * 0.9 * cur);
        ctx.globalAlpha = 0.55 + 0.45 * (1 - cur * 0.35);
        ctx.fillStyle = `rgb(${d.r},${d.g},${d.b})`;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };

    img.onload = () => { build(); t0 = performance.now(); loop(); };
    img.onerror = () => {};
    img.src = src;
    return () => cancelAnimationFrame(raf);
  }, [src]);

  return <canvas ref={ref} className="pe-faceid" aria-hidden="true" />;
}
