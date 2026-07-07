'use client';

import { useEffect, useRef } from 'react';

// Ambient background ported from the landing-page canvas: soft moving fog blobs
// over near-black, plus a vignette. Sits behind the React Flow pane.
export default function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const fx = cv.getContext('2d');
    if (!fx) return;

    let FW = 0;
    let FH = 0;
    type Blob = { x: number; y: number; r: number; c: number[]; a: number; vx: number; vy: number; ph: number };
    let blobs: Blob[] = [];
    let raf = 0;
    const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

    const init = () => {
      FW = cv.width = window.innerWidth;
      FH = cv.height = window.innerHeight;
      const cols = [[36, 52, 44], [24, 40, 50], [60, 66, 40], [18, 26, 24], [80, 96, 90]];
      blobs = [];
      for (let i = 0; i < 7; i++) {
        blobs.push({
          x: Math.random() * FW,
          y: Math.random() * FH,
          r: (0.35 + Math.random() * 0.6) * FW,
          c: cols[i % cols.length],
          a: 0.1 + Math.random() * 0.14,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.09,
          ph: Math.random() * 6.28,
        });
      }
    };

    const draw = (t: number) => {
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = '#06070a';
      fx.fillRect(0, 0, FW, FH);
      fx.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const x = b.x + Math.sin(t / 3000 + b.ph) * 40;
        const y = b.y + Math.cos(t / 3600 + b.ph) * 30;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -b.r) b.x = FW + b.r;
        if (b.x > FW + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = FH + b.r;
        if (b.y > FH + b.r) b.y = -b.r;
        const g = fx.createRadialGradient(x, y, 0, x, y, b.r);
        const a = b.a * (0.75 + 0.25 * Math.sin(t / 2200 + b.ph));
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${a})`);
        g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(x, y, b.r, 0, 7);
        fx.fill();
      }
    };

    init();
    if (reduce) {
      draw(0);
    } else {
      const loop = (t: number) => {
        draw(t || 0);
        raf = requestAnimationFrame(loop);
      };
      loop(0);
    }
    const onResize = () => {
      init();
      if (reduce) draw(0);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} className="bd-fog" aria-hidden />
      <div className="bd-vignette" aria-hidden />
    </>
  );
}
