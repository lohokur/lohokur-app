'use client';

import { type Project, makeId } from './types';
import { supabaseBrowser } from './supabase/client';

// Client-facing persistence.
//   - NEXT_PUBLIC_HAS_DB=1 → Supabase (per-account, RLS-scoped).
//   - otherwise → localStorage (zero-backend fallback).
const HAS_DB = process.env.NEXT_PUBLIC_HAS_DB === '1';
const KEY = 'lk_projects';

export const usingLocalStore = !HAS_DB;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProject(r: any): Project {
  return {
    id: r.id,
    name: r.name,
    flow: r.flow ?? { nodes: [], edges: [] },
    createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
    updatedAt: r.updated_at ? Date.parse(r.updated_at) : Date.now(),
  };
}

function lread(): Project[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') as Project[]; } catch { return []; }
}
function lwrite(list: Project[]) { localStorage.setItem(KEY, JSON.stringify(list)); }

export async function listProjects(): Promise<Project[]> {
  if (HAS_DB) {
    await migrateLocalProjects();
    const sb = supabaseBrowser();
    // list view: metadata only — never pull the (image-heavy) flow for every project
    const { data } = await sb
      .from('projects')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false });
    return (data ?? []).map(rowToProject);
  }
  return lread().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project | null> {
  if (HAS_DB) {
    const sb = supabaseBrowser();
    const { data } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
    return data ? rowToProject(data) : null;
  }
  return lread().find((p) => p.id === id) ?? null;
}

export async function createProject(name?: string): Promise<Project> {
  if (HAS_DB) {
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb
      .from('projects')
      .insert({ user_id: user?.id, name: name?.trim() || 'Untitled', flow: { nodes: [], edges: [] } })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'could not create project');
    return rowToProject(data);
  }
  const now = Date.now();
  const p: Project = { id: makeId(), name: name?.trim() || 'Untitled', flow: { nodes: [], edges: [] }, createdAt: now, updatedAt: now };
  lwrite([...lread(), p]);
  return p;
}

export async function saveProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'flow'>>,
): Promise<Project | null> {
  if (HAS_DB) {
    const sb = supabaseBrowser();
    const { data } = await sb
      .from('projects')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    return data ? rowToProject(data) : null;
  }
  const list = lread();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, id, updatedAt: Date.now() };
  lwrite(list);
  return list[i];
}

// One-time import of any localStorage canvases into the signed-in account.
let migrated = false;
async function migrateLocalProjects() {
  if (migrated || typeof window === 'undefined') return;
  migrated = true;
  const local = lread();
  if (!local.length) return;
  try {
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from('projects').insert(
      local.map((p) => ({ user_id: user.id, name: p.name, flow: p.flow })),
    );
    localStorage.removeItem(KEY); // imported — don't re-import
  } catch {
    /* leave local data in place if the import fails */
  }
}
