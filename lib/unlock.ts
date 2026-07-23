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
  extract:     { title: 'Extract the garment', blurb: 'Pull a clean, isolated product shot out of any image — ready to pattern.' },
  pattern:     { title: 'Pattern maker', blurb: 'Turn your design into flat, colour-coded panel outlines — the blueprint a factory works from.' },
  techpack:    { title: 'Tech pack', blurb: 'Generate a factory-ready spec sheet — measurements, materials, construction and graded sizing.' },
  sample:      { title: 'Order a sample', blurb: 'Brief your design into a real, physical first sample you can hold.' },
  manufacture: { title: 'Manufacture', blurb: 'Match your tech pack to manufacturers and get it produced at volume.' },
  retailer:    { title: 'Retailers', blurb: 'Line up stockists and retail routes to put your collection in front of buyers.' },
  ship:        { title: 'Ship', blurb: 'Take your order all the way through fulfilment to your customer’s door.' },
};
