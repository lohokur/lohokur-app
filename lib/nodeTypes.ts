export type StageKey =
  | 'sketch'
  | 'visualise'
  | 'extract'
  | 'pattern'
  | 'techpack'
  | 'manufacture'
  | 'ship';

export type Stage = { key: StageKey; label: string; hint: string };

// The LOHO KUR pipeline, in order. v1 = structure only (no AI yet).
export const STAGES: Stage[] = [
  { key: 'sketch', label: 'Sketch', hint: 'Draw or drop an idea' },
  { key: 'visualise', label: 'Visualise', hint: 'Render it photoreal' },
  { key: 'extract', label: 'Extract', hint: 'Isolate one piece' },
  { key: 'pattern', label: 'Pattern maker', hint: 'Graded flat pieces' },
  { key: 'techpack', label: 'Techpack', hint: 'Spec · grading · BOM' },
  { key: 'manufacture', label: 'Manufacture', hint: 'Vetted factory · pay' },
  { key: 'ship', label: 'Ship', hint: '3PL or any address' },
];

export const STAGE_MAP: Record<string, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.key, s])
);

// Garment views a sketch can hold; visualise renders each connected view.
export const VIEWS = ['front', 'side', 'back'] as const;
export type View = (typeof VIEWS)[number];

// Strict pipeline order: a node type may only connect INTO its single successor.
export const NEXT: Partial<Record<StageKey, StageKey>> = {
  sketch: 'visualise',
  visualise: 'extract',
  extract: 'pattern',
  pattern: 'techpack',
  techpack: 'manufacture',
  manufacture: 'ship',
};
