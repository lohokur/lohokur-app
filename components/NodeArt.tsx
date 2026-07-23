'use client';

import { useEffect, useRef } from 'react';
import { paintNodeArt } from '@/lib/node-art';

// Grainy, glowing generative-art background for a node card (dashboard-card look).
export default function NodeArt({ seed, w = 240, h = 320, className = 'fb-art' }: { seed: number; w?: number; h?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (c && !c.dataset.painted) { paintNodeArt(c, seed); c.dataset.painted = '1'; }
  }, [seed]);
  return <canvas ref={ref} className={className} width={w} height={h} aria-hidden="true" />;
}
