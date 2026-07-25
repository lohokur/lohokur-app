'use client';

import { useEffect, useState } from 'react';

// The loading light doubles as a progress meter: the card lights up left→right as
// a render advances, so "halfway lit" reads as "about halfway there". AI generation
// reports no true percentage, so we ease toward ~95% over the typical render time
// and let the finished image replace the light when it actually arrives.
export default function RenderProgress({ tau = 5.5 }: { tau?: number }) {
  const [p, setP] = useState(0.03);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const el = (performance.now() - start) / 1000;
      setP(Math.min(0.96, 1 - Math.exp(-el / tau)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [tau]);
  return <div className="fb-prog" style={{ ['--p']: p } as React.CSSProperties} aria-hidden="true" />;
}
