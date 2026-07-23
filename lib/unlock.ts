import type { StageKey } from './nodeTypes';

// Open the "unlock the production line" modal for a specific locked stage.
// A top-level <UnlockModal/> listens. Replaces the old bare /pricing redirect.
export function openUnlock(stage: StageKey) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lk-unlock', { detail: stage }));
  }
}

// What each paid stage actually does for the user — sells the upgrade at the
// exact moment they reach for it.
export const STAGE_VALUE: Partial<Record<StageKey, { title: string; blurb: string }>> = {
  pattern:     { title: 'Pattern maker', blurb: 'Extract the garment off your look, then trace it into flat, colour-coded panel outlines — the blueprint a factory works from.' },
  techpack:    { title: 'Tech pack', blurb: 'Generate a factory-ready spec sheet — measurements, materials, construction and graded sizing.' },
  sample:      { title: 'Produce', blurb: 'Turn your tech pack into the real thing — one sample to hold, or a full bulk run from a vetted factory.' },
  ship:        { title: 'Ship', blurb: 'Take your order all the way through fulfilment to your customer’s door.' },
};
