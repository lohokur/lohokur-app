'use client';

import { useEffect, useState } from 'react';
import { openPaywall } from '@/lib/paywall';

type Stage = 'outline' | 'refine' | 'deconstruct' | 'number';

export default function PatternPanel({
  open,
  nodeId,
  image,
  onGenerated,
  onClose,
}: {
  open: boolean;
  nodeId?: string | null;
  image?: string;
  onGenerated: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [working, setWorking] = useState<Stage | null>(null);
  const [status, setStatus] = useState('');
  const [outline, setOutline] = useState<string | null>(null);
  const [panels, setPanels] = useState<string | null>(null);
  const [numbered, setNumbered] = useState<string | null>(null);

  // Single shared instance — reset per node so one node's work never leaks into another.
  useEffect(() => {
    setOutline(null);
    setPanels(null);
    setNumbered(null);
    setStatus('');
    setWorking(null);
  }, [nodeId]);

  // Pipeline: outline → (refine in place) → deconstruct → number. Each stage
  // consumes the previous artifact; redoing an earlier stage invalidates later ones.
  const STATUS: Record<Stage, string> = {
    outline: 'tracing the garment outline…',
    refine: 'checking for missing lines…',
    deconstruct: 'deconstructing into panels…',
    number: 'numbering the panels…',
  };
  const run = async (stage: Stage) => {
    if (working) return;
    let body: Record<string, string>;
    let dest: 'outline' | 'panels' | 'numbered';
    if (stage === 'outline') {
      if (!image) return;
      body = { image, mode: 'outline' }; dest = 'outline';
    } else if (stage === 'refine') {
      if (!image || !outline) return;
      body = { image, ref: outline, mode: 'refine' }; dest = 'outline'; // completes the outline in place
    } else if (stage === 'deconstruct') {
      if (!outline) return;
      body = { image: outline, mode: 'deconstruct' }; dest = 'panels';
    } else {
      if (!panels) return;
      body = { image: panels, mode: 'number' }; dest = 'numbered';
    }
    setWorking(stage);
    setStatus(STATUS[stage]);
    // Invalidate everything downstream of what we're regenerating.
    if (dest === 'outline') { setPanels(null); setNumbered(null); }
    if (dest === 'panels') setNumbered(null);
    try {
      const r = await fetch('/api/pattern', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.image) {
        const set = dest === 'outline' ? setOutline : dest === 'panels' ? setPanels : setNumbered;
        set(j.image);
        setStatus('');
      } else if (j.upgrade) {
        openPaywall(); setStatus('out of generations');
      } else {
        setStatus(j.error || 'generation failed');
      }
    } catch {
      setStatus('generation failed');
    }
    setWorking(null);
  };

  // Show the furthest-along artifact: numbered ▸ panels ▸ outline ▸ source garment.
  const shown = numbered ?? panels ?? outline ?? image ?? null;
  const isResult = !!(numbered ?? panels ?? outline);
  const shownLabel = numbered ? 'Numbered panels' : panels ? 'Pattern panels' : outline ? 'Garment outline' : 'Garment';
  const headTag = numbered ? 'numbered' : panels ? 'panels' : 'outline';

  return (
    <aside className={`patternpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sp-head">
        <span>Pattern maker · {headTag}</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="pm-estimate">
        {numbered
          ? 'Every pattern panel numbered — the closed pieces the garment is built from.'
          : panels
            ? 'Deconstructed into separate pattern panels. Now number each one.'
            : outline
              ? 'Outline traced — blue = primary, red = secondary. Check & complete fixes lines/fill; then deconstruct into separate panels.'
              : 'Step 1 — trace the garment into a hollow outline, colour-coded by material: blue = primary, red = secondary.'}
      </div>

      <div className="pm-stage2">
        {shown ? (
          <img src={shown} className={isResult ? undefined : 'pm-src'} alt={shownLabel} draggable={false} />
        ) : (
          <div className="pm-empty">connect an extracted piece or a visualised look, then open Pattern maker</div>
        )}
        {working && <div className="pm-busy"><span className="ex-spinner" />{STATUS[working].replace(/…$/, '')}…</div>}
      </div>

      {status && <div className="pm-status">{status}</div>}

      <div className="pm-foot">
        {!outline ? (
          <button className="sp-done" onClick={() => run('outline')} disabled={!image || !!working}>
            {working === 'outline' ? 'Tracing…' : 'Generate outline'}
          </button>
        ) : !panels ? (
          <>
            <button className="sp-ghost" onClick={() => run('outline')} disabled={!!working}>Redo outline</button>
            <button className="sp-ghost" onClick={() => run('refine')} disabled={!!working}>
              {working === 'refine' ? 'Checking…' : 'Check & complete'}
            </button>
            <button className="sp-done" onClick={() => run('deconstruct')} disabled={!!working}>
              {working === 'deconstruct' ? 'Deconstructing…' : 'Deconstruct'}
            </button>
          </>
        ) : !numbered ? (
          <>
            <button className="sp-ghost" onClick={() => run('deconstruct')} disabled={!!working}>Redo panels</button>
            <button className="sp-done" onClick={() => run('number')} disabled={!!working}>
              {working === 'number' ? 'Numbering…' : 'Number panels'}
            </button>
          </>
        ) : (
          <>
            <button className="sp-ghost" onClick={() => run('number')} disabled={!!working}>Redo numbers</button>
            <button className="sp-done" onClick={() => { onGenerated(numbered); onClose(); }}>Use</button>
          </>
        )}
      </div>
    </aside>
  );
}
