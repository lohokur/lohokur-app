import type { Flow } from './types';

// Starter templates for new projects — the empty canvas is where new users bounce,
// so a project can be seeded with a ready-made chain to click into immediately.
type Stage = 'sketch' | 'visualise' | 'image' | 'extract' | 'pattern' | 'techpack' | 'studio' | 'sample' | 'manufacture' | 'ship';

let seed = 0;
function node(stage: Stage, x: number, y: number) {
  const id = `${stage}-${Date.now().toString(36)}-${seed++}`;
  return { id, type: stage, position: { x, y }, data: { type: stage } };
}
function wire(a: { id: string }, b: { id: string }) {
  return { id: `e-${a.id}-${b.id}`, source: a.id, target: b.id, type: 'wire' };
}

export type Template = { id: string; name: string; blurb: string; stages: Stage[]; build: () => Flow };

const GAP = 300;

export const TEMPLATES: Template[] = [
  {
    id: 'core',
    name: 'Sketch → Visualise',
    blurb: 'The core loop — draw an idea, render it photoreal. Best place to start.',
    stages: ['sketch', 'visualise'],
    build: () => {
      const s = node('sketch', 140, 180);
      const v = node('visualise', 140 + GAP, 180);
      return { nodes: [s, v], edges: [wire(s, v)] };
    },
  },
  {
    id: 'pipeline',
    name: 'Full pipeline',
    blurb: 'See the whole journey: sketch → visualise → extract → pattern → techpack.',
    stages: ['sketch', 'visualise', 'extract', 'pattern', 'techpack'],
    build: () => {
      const s = node('sketch', 80, 220);
      const v = node('visualise', 80 + GAP, 220);
      const e = node('extract', 80 + 2 * GAP, 220);
      const p = node('pattern', 80 + 3 * GAP, 220);
      const t = node('techpack', 80 + 4 * GAP, 220);
      return { nodes: [s, v, e, p, t], edges: [wire(s, v), wire(v, e), wire(e, p), wire(p, t)] };
    },
  },
  {
    id: 'blank',
    name: 'Blank canvas',
    blurb: 'Start from nothing.',
    stages: [],
    build: () => ({ nodes: [], edges: [] }),
  },
];
