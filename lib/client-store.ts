'use client';

import { type Project, makeId } from './types';

// Client-facing persistence used by the UI.
//   - If a database is connected (NEXT_PUBLIC_HAS_DB=1) → talk to /api/projects (Postgres).
//   - Otherwise → localStorage, so the app is fully usable with zero backend and
//     upgrades to the DB automatically the moment one is connected.
const HAS_DB = process.env.NEXT_PUBLIC_HAS_DB === '1';
const KEY = 'lk_projects';

export const usingLocalStore = !HAS_DB;

function lread(): Project[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as Project[];
  } catch {
    return [];
  }
}
function lwrite(list: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export async function listProjects(): Promise<Project[]> {
  if (HAS_DB) return (await fetch('/api/projects')).json();
  return lread().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  if (HAS_DB) {
    const r = await fetch(`/api/projects/${id}`);
    return r.ok ? r.json() : null;
  }
  return lread().find((p) => p.id === id) ?? null;
}

export async function createProject(name?: string): Promise<Project> {
  if (HAS_DB) {
    const r = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return r.json();
  }
  const now = Date.now();
  const p: Project = {
    id: makeId(),
    name: name?.trim() || 'Untitled',
    flow: { nodes: [], edges: [] },
    createdAt: now,
    updatedAt: now,
  };
  lwrite([...lread(), p]);
  return p;
}

export async function saveProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'flow'>>
): Promise<Project | null> {
  if (HAS_DB) {
    const r = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return r.ok ? r.json() : null;
  }
  const list = lread();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, id, updatedAt: Date.now() };
  lwrite(list);
  return list[i];
}
