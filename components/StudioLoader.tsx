'use client';

import { useEffect, useRef, useState } from 'react';

// Branded interstitial shown between the project halo and the studio canvas.
// The bar tracks REAL load progress (0..1) passed from the canvas — it eases
// toward whatever fraction of the load has actually completed, and only hands
// off once that reaches 100%.
const TIPS = [
  'Your work saves automatically — nothing is ever lost.',
  'Double-click any node to open its studio.',
  'Drag from a node handle to branch the next stage.',
  'The canvas saves itself — there is no save button.',
  'Flow: Sketch → Render → Techpack → Sample → Manufacture.',
  'Back on the home screen, ← / → spins the halo.',
  'Connect a node to Ship to mark it production-ready.',
];

export default function StudioLoader({ progress, onDone }: { progress: number; onDone: () => void }) {
  const [tip, setTip] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [, repaint] = useState(0);
  const shown = useRef(0);       // smoothed bar fill, eased toward `progress`
  const target = useRef(progress);
  const done = useRef(false);
  target.current = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    const root = document.documentElement;
    // --reveal (0..1) is read by the canvas + veil so the world emerges in step with the bar
    root.style.setProperty('--reveal', '0');
    const rotate = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 2400);
    let raf = 0;
    const tick = () => {
      const t = target.current;
      // ease toward the real target; a tiny trickle keeps it visibly alive
      // while a step is still resolving, but it can never pass the real target.
      const eased = shown.current + (t - shown.current) * 0.15;
      const trickle = t > shown.current ? Math.min(t, shown.current + 0.004) : shown.current;
      shown.current = Math.max(eased, trickle);
      root.style.setProperty('--reveal', shown.current.toFixed(3));
      if (t >= 1 && shown.current > 0.995 && !done.current) {
        shown.current = 1;
        root.style.setProperty('--reveal', '1');
        done.current = true;
        setLeaving(true);
        setTimeout(onDone, 300); // let the fade play out
      }
      repaint((n) => n + 1);
      if (!done.current) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearInterval(rotate); root.style.setProperty('--reveal', '1'); };
  }, [onDone]);

  // Guaranteed handoff once real load hits 100% — timer-driven so it fires even
  // if the tab is backgrounded (rAF pauses when hidden, setTimeout does not).
  useEffect(() => {
    if (progress < 1 || done.current) return;
    const t = setTimeout(() => {
      if (done.current) return;
      done.current = true;
      shown.current = 1;
      document.documentElement.style.setProperty('--reveal', '1');
      setLeaving(true);
      setTimeout(onDone, 300);
    }, 420); // brief grace so the bar visibly reaches the end
    return () => clearTimeout(t);
  }, [progress, onDone]);

  return (
    <div className={`studio-loader${leaving ? ' leaving' : ''}`} role="status" aria-live="polite">
      <div className="sl-inner">
        <img className="sl-logo" src="/lk-logo.png" alt="LOHO KUR" draggable={false} />
        <div className="sl-bar"><span style={{ width: `${(shown.current * 100).toFixed(1)}%` }} /></div>
        <p className="sl-tip" key={tip}>{TIPS[tip]}</p>
      </div>
    </div>
  );
}
