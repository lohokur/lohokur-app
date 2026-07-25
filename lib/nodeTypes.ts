export type StageKey =
  | 'sketch'
  | 'visualise'
  | 'studio'
  | 'extract'
  | 'pattern'
  | 'techpack'
  | 'sample'
  | 'manufacture'
  | 'retailer'
  | 'ship';

export type Stage = { key: StageKey; label: string; hint: string };

// A generated Visualise card: one render from a chosen combo of plugged-in inputs.
export type VisResult = { id: string; image: string; inputs: string[] };

// The LOHO KUR pipeline, in order. v1 = structure only (no AI yet).
export const STAGES: Stage[] = [
  { key: 'sketch', label: 'Sketch', hint: 'Draw, prompt or drop an idea' },
  { key: 'visualise', label: 'Model', hint: 'Place the garment on a model' },
  { key: 'studio', label: 'Worldbuild', hint: 'Plug in a visual · prompt it anywhere' },
  { key: 'pattern', label: 'Pattern maker', hint: 'Extract a piece · trace the pattern' },
  { key: 'techpack', label: 'Techpack', hint: 'Spec · grading · BOM' },
  { key: 'sample', label: 'Produce', hint: 'One sample or a bulk run' },
  { key: 'ship', label: 'Ship', hint: '3PL or any address' },
];

// The descriptive line shown on a node card (blank state) — reused as the dock
// hover-preview caption so both read the same.
export const CARD_TEXT: Partial<Record<StageKey, string>> = {
  sketch: 'draw · upload · or prompt',
  visualise: 'plug in a sketch → place it on a model',
  studio: 'connect a render, then prompt a scene',
  pattern: 'create a pattern of this product',
  techpack: 'create a techpack of this product',
  sample: 'create a physical sample of this product',
  ship: 'ship this product to any address',
};
// Vaulted stages: kept as registered node types so old canvases still render,
// but no longer offered in the dock / pipeline.
//   retailer — shelved 2026-07
//   extract    — folded into the Pattern maker node 2026-07
//   manufacture — folded into the Produce node (bulk mode) 2026-07

export const STAGE_MAP: Record<string, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

// single-key shortcuts (no modifiers) that spawn each node on the canvas
export const STAGE_HOTKEYS: Record<string, StageKey> = {
  s: 'sketch',
  v: 'visualise',
  w: 'studio',
  p: 'pattern',
  t: 'techpack',
  c: 'sample',
  h: 'ship',
};

// reverse map: stage key → its hotkey (for dock hints)
export const HOTKEY_FOR: Partial<Record<StageKey, string>> = Object.fromEntries(
  Object.entries(STAGE_HOTKEYS).map(([k, v]) => [v, k])
);

// Garment views a sketch can hold; visualise renders each connected view.
export const VIEWS = ['front', 'side', 'back'] as const;
export type View = (typeof VIEWS)[number];

// Pipeline order: a node type may connect INTO any of its allowed successors.
// Techpack branches — you can sample (one unit) and/or go straight to bulk;
// both paths converge on Ship. A sample can also feed manufacture: approve the
// one-off, then order bulk from the factory.
export const NEXT: Partial<Record<StageKey, StageKey[]>> = {
  sketch: ['visualise', 'studio', 'pattern'],
  visualise: ['pattern', 'studio'],
  studio: ['studio', 'pattern'],
  extract: ['pattern', 'studio'], // vaulted node; kept so old canvases still route
  pattern: ['techpack'],
  techpack: ['sample'],
  sample: ['ship'],
  manufacture: ['ship'], // vaulted node; kept so old canvases still route
};
