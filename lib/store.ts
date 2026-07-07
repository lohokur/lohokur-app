import { promises as fs } from 'fs';
import path from 'path';
import { type Project, makeId } from './types';

// Server-side persistence.
//   - If POSTGRES_URL is set  → Vercel Postgres (production).
//   - Otherwise               → a local JSON file (dev).
// Same API either way, so the UI never changes.

const HAS_PG = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
const FILE = path.join(process.cwd(), '.data', 'projects.json');

/* ---------------- file store (dev) ---------------- */
async function fileAll(): Promise<Project[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, 'utf8')) as Project[];
  } catch {
    return [];
  }
}
async function fileWrite(list: Project[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2));
}

/* ---------------- postgres (prod) ---------------- */
let pgReady: Promise<void> | null = null;
async function pg() {
  const { sql } = await import('@vercel/postgres');
  if (!pgReady) {
    pgReady = sql`
      CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        flow        JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
        created_at  BIGINT NOT NULL,
        updated_at  BIGINT NOT NULL
      );
    `.then(() => undefined);
  }
  await pgReady;
  return sql;
}
type Row = { id: string; name: string; flow: Project['flow']; created_at: number; updated_at: number };
const fromRow = (r: Row): Project => ({
  id: r.id,
  name: r.name,
  flow: r.flow,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});

/* ---------------- public API ---------------- */
export async function listProjects(): Promise<Project[]> {
  if (HAS_PG) {
    const sql = await pg();
    const { rows } = await sql`SELECT * FROM projects ORDER BY updated_at DESC;`;
    return (rows as Row[]).map(fromRow);
  }
  return (await fileAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  if (HAS_PG) {
    const sql = await pg();
    const { rows } = await sql`SELECT * FROM projects WHERE id = ${id} LIMIT 1;`;
    return rows[0] ? fromRow(rows[0] as Row) : null;
  }
  return (await fileAll()).find((p) => p.id === id) ?? null;
}

export async function createProject(name?: string): Promise<Project> {
  const now = Date.now();
  const p: Project = {
    id: makeId(),
    name: name?.trim() || 'Untitled',
    flow: { nodes: [], edges: [] },
    createdAt: now,
    updatedAt: now,
  };
  if (HAS_PG) {
    const sql = await pg();
    await sql`INSERT INTO projects (id, name, flow, created_at, updated_at)
              VALUES (${p.id}, ${p.name}, ${JSON.stringify(p.flow)}, ${now}, ${now});`;
    return p;
  }
  const list = await fileAll();
  list.push(p);
  await fileWrite(list);
  return p;
}

export async function saveProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'flow'>>
): Promise<Project | null> {
  const now = Date.now();
  if (HAS_PG) {
    const sql = await pg();
    const current = await getProject(id);
    if (!current) return null;
    const name = patch.name ?? current.name;
    const flow = patch.flow ?? current.flow;
    await sql`UPDATE projects SET name = ${name}, flow = ${JSON.stringify(flow)}, updated_at = ${now} WHERE id = ${id};`;
    return { ...current, name, flow, updatedAt: now };
  }
  const list = await fileAll();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, id, updatedAt: now };
  await fileWrite(list);
  return list[i];
}

export async function deleteProject(id: string): Promise<void> {
  if (HAS_PG) {
    const sql = await pg();
    await sql`DELETE FROM projects WHERE id = ${id};`;
    return;
  }
  const list = await fileAll();
  await fileWrite(list.filter((p) => p.id !== id));
}
