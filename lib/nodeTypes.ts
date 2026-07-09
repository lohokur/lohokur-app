export type StageKey =
  | 'sketch'
  | 'visualise'
  | 'studio'
  | 'image'
  | 'extract'
  | 'pattern'
  | 'techpack'
  | 'sample'
  | 'manufacture'
  | 'ship';

export type Stage = { key: StageKey; label: string; hint: string };

// The LOHO KUR pipeline, in order. v1 = structure only (no AI yet).
export const STAGES: Stage[] = [
  { key: 'sketch', label: 'Sketch', hint: 'Draw or drop an idea' },
  { key: 'visualise', label: 'Visualise', hint: 'Render it photoreal' },
  { key: 'studio', label: 'Brand studio', hint: 'Plug in a visual · prompt it anywhere' },
  { key: 'image', label: 'Image', hint: 'Upload, paste or prompt an image' },
  { key: 'extract', label: 'Extract', hint: 'Isolate one piece' },
  { key: 'pattern', label: 'Pattern maker', hint: 'Graded flat pieces' },
  { key: 'techpack', label: 'Techpack', hint: 'Spec · grading · BOM' },
  { key: 'sample', label: 'Create Sample', hint: 'One sample · ship to you' },
  { key: 'manufacture', label: 'Manufacture', hint: 'Vetted factory · bulk' },
  { key: 'ship', label: 'Ship', hint: '3PL or any address' },
];

export const STAGE_MAP: Record<string, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

// Garment views a sketch can hold; visualise renders each connected view.
export const VIEWS = ['front', 'side', 'back'] as const;
export type View = (typeof VIEWS)[number];

// Pipeline order: a node type may connect INTO any of its allowed successors.
// Techpack branches — you can sample (one unit) and/or go straight to bulk;
// both paths converge on Ship. A sample can also feed manufacture: approve the
// one-off, then order bulk from the factory.
export const NEXT: Partial<Record<StageKey, StageKey[]>> = {
  sketch: ['visualise'],
  visualise: ['extract', 'studio'],
  image: ['studio'],
  studio: ['studio', 'extract'],
  extract: ['pattern', 'studio'],
  pattern: ['techpack'],
  techpack: ['sample', 'manufacture'],
  sample: ['manufacture', 'ship'],
  manufacture: ['ship'],
};
