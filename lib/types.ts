// Shared types — safe to import from both server and client (no node built-ins).
export type Flow = { nodes: unknown[]; edges: unknown[] };

export type Project = {
  id: string;
  name: string;
  flow: Flow;
  createdAt: number;
  updatedAt: number;
};

export function makeId(): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 8)
      : Math.floor(Math.random() * 1e10).toString(36);
  return (Date.now().toString(36) + rnd).slice(0, 14);
}
