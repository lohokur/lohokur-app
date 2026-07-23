'use client';

import { useEffect, useRef } from 'react';
import { paintNodeArt, paintNodeArtFrame } from '@/lib/node-art';

// Grainy, glowing generative-art background for a node card (dashboard-card look).
// When `animate` is on, the glow swishes organically — a node's loading indicator.
export default function NodeArt({ seed, w = 240, h = 320, className = 'fb-art', animate = false }: { seed: number; w?: number; h?: number; className?: string; animate?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    if (!animate) { paintNodeArt(c, seed); return; }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { paintNodeArt(c, seed); return; }
    let raf = 0, t0 = 0;
    const loop = (ts: number) => {
      if (!t0) t0 = ts;
      paintNodeArtFrame(c, seed, (ts - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [seed, animate]);
  return <canvas ref={ref} className={className} width={w} height={h} aria-hidden="true" />;
}
