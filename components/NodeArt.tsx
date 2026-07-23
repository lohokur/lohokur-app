'use client';

import { useEffect, useRef } from 'react';
import { paintNodeArt } from '@/lib/node-art';

// Grainy, glowing generative-art background for a node card (dashboard-card look).
export default function NodeArt({ seed }: { seed: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (c && !c.dataset.painted) { paintNodeArt(c, seed); c.dataset.painted = '1'; }
  }, [seed]);
  return <canvas ref={ref} className="fb-art" width={240} height={320} aria-hidden="true" />;
}
