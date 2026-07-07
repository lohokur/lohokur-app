'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listProjects, createProject, usingLocalStore } from '@/lib/client-store';
import type { Project } from '@/lib/types';

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  async function newProject() {
    const p = await createProject('Untitled');
    router.push(`/studio/${p.id}`);
  }

  return (
    <main className="home">
      <header className="home-head">
        <div className="wordmark">LOHO&nbsp;<b>KUR</b><sup>®</sup></div>
        <button className="new-btn" onClick={newProject}>+ New project</button>
      </header>

      <h1 className="home-title">Your studio</h1>
      <p className="home-sub">
        Design on the canvas — idea to shipment. (v1: canvas + save)
        {usingLocalStore && <span className="badge">saved in this browser</span>}
      </p>

      {projects === null ? (
        <p className="home-sub">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="empty">
          <p>No projects yet.</p>
          <button className="new-btn" onClick={newProject}>Start your first project →</button>
        </div>
      ) : (
        <ul className="proj-grid">
          {projects.map((p) => (
            <li key={p.id}>
              <a href={`/studio/${p.id}`} className="proj-card">
                <span className="proj-name">{p.name}</span>
                <span className="proj-meta">
                  {(p.flow?.nodes?.length ?? 0)} nodes · {ago(p.updatedAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
