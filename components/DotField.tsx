'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';

type Viewport = { x: number; y: number; zoom: number };

// The canvas dot grid itself — each dot brightens by its distance to the cursor,
// so a circle of dots lights up and follows the mouse. Pans/zooms with the flow.
export default function DotField({ viewportRef, light = false }: { viewportRef: MutableRefObject<Viewport>; light?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const GAP = 28;          // world spacing between dots
    const RADIUS = 78;       // how close the cursor charges a dot
    let W = 0, H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999, on: false };
    const prev = { x: -9999, y: -9999 };
    const energy = new Map<string, number>(); // per-dot charge (keyed by world index), decays over time

    const resize = () => {
      W = cv.width = Math.floor(window.innerWidth * dpr);
      H = cv.height = Math.floor(window.innerHeight * dpr);
      cv.style.width = window.innerWidth + 'px';
      cv.style.height = window.innerHeight + 'px';
    };
    resize();

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const { x, y, zoom } = viewportRef.current;
      const step = GAP * zoom * dpr;

      // how fast the cursor is moving this frame → a fast swipe charges dots harder
      const speed = mouse.on ? Math.hypot(mouse.x - prev.x, mouse.y - prev.y) : 0;
      prev.x = mouse.x; prev.y = mouse.y;
      const swipe = Math.min(1, speed / 16);

      // decay every dot's charge (the trail fades behind the cursor)
      for (const [k, v] of energy) { const nv = v * 0.9; if (nv < 0.02) energy.delete(k); else energy.set(k, nv); }

      if (step > 3) {
        const ox = (((x * dpr) % step) + step) % step;
        const oy = (((y * dpr) % step) + step) % step;
        const xd = x * dpr, yd = y * dpr;
        const mx = mouse.x * dpr, my = mouse.y * dpr, rad = RADIUS * dpr, rad2 = rad * rad;
        for (let px = ox; px < W + step; px += step) {
          for (let py = oy; py < H + step; py += step) {
            const col = Math.round((px - xd) / step), row = Math.round((py - yd) / step);
            const key = `${col},${row}`;
            let e = energy.get(key) ?? 0;
            if (mouse.on) {
              const dx = px - mx, dy = py - my, d2 = dx * dx + dy * dy;
              if (d2 < rad2) {
                const f = 1 - Math.sqrt(d2) / rad;           // proximity 0..1
                const charge = f * f * (0.05 + 0.95 * swipe); // mostly driven by swipe speed
                if (charge > 0) { e = Math.min(1, e + charge); energy.set(key, e); }
              }
            }
            const a = 0.3 + e * 0.45;
            const r = (0.95 + e * 0.5) * dpr * Math.min(1.4, Math.max(0.4, zoom));
            ctx.beginPath();
            // dark dots on the light canvas, light mint dots on the dark canvas
            ctx.fillStyle = light ? `rgba(60,60,67,${(a * 0.5).toFixed(3)})` : `rgba(196,245,220,${a.toFixed(3)})`;
            ctx.arc(px, py, r, 0, 6.2832);
            ctx.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; };
    const onOut = (e: PointerEvent) => { if (!e.relatedTarget) mouse.on = false; };
    const onBlur = () => { mouse.on = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', resize);
    };
  }, [viewportRef, light]);

  return <canvas ref={ref} className="dot-field" aria-hidden />;
}
