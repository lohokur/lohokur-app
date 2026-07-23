'use client';

import { useEffect, useRef } from 'react';
import { paintNodeArt, paintNodeArtFrame } from '@/lib/node-art';

// Grainy, glowing generative-art background for a node card (dashboard-card look).
// When `animate` is on, the glow swishes organically — a node's loading indicator.
export default function NodeArt({ seed, w = 240, h = 320, className = 'fb-art', animate = false, speed = 1 }: { seed: number; w?: number; h?: number; className?: string; animate?: boolean; speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paintNodeArt(ref.current, seed);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const c = ref.current;                 // always paint the live canvas (survives re-creation)
      if (c) paintNodeArtFrame(c, seed, ((performance.now() - start) / 1000) * speed);
      raf = requestAnimationFrame(loop);
    };
    loop();                                  // frame 0 immediately, then animate
    return () => cancelAnimationFrame(raf);
  }, [seed, animate, speed]);
  return <canvas ref={ref} className={className} width={w} height={h} aria-hidden="true" />;
}
