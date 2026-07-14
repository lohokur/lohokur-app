'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { listProjects, createProject } from '@/lib/client-store';
import { TEMPLATES, type Template } from '@/lib/templates';
import type { Project } from '@/lib/types';

const MIN_SLOTS = 12;

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
const pad = (n: number) => String(n).padStart(2, '0');
function hueOf(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

// the most recent Visualise render on that project's canvas (last visualise node with an image)
function previewOf(p: Project): string | undefined {
  const nodes = (p.flow?.nodes ?? []) as { type?: string; data?: { image?: string; views?: Record<string, string> } }[];
  let img: string | undefined;
  for (const n of nodes) {
    if (n.type === 'visualise') {
      const v = n.data?.image ?? n.data?.views?.front;
      if (v) img = v;
    }
  }
  return img;
}

// procedural generative-art face for the empty cards — ported from the homepage halo
const PALETTES = [
  ['#3a3b3e', '#8f8d86', '#55565a', '#141416'],
  ['#36373a', '#efeae0', '#4a4f2f', '#8f8d86'],
  ['#5a606a', '#a9f0d0', '#8f8d86', '#222327'],
  ['#55565a', '#ece9e2', '#4a6f5d', '#36373a'],
];
function mk(seed: number) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function hexc(h: string) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function paintArt(cv: HTMLCanvasElement, cols: string[], seed: number) {
  const w = cv.width, h = cv.height, x = cv.getContext('2d'); if (!x) return;
  const R = mk(seed + 7);
  const base = hexc(cols[cols.length - 1] || '#101012');
  x.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const cx = R() * w, cy = R() * h, rad = (0.25 + R() * 0.6) * w;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad), c = cols[i % cols.length];
    g.addColorStop(0, c + 'cc'); g.addColorStop(1, c + '00');
    x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
  }
  x.globalCompositeOperation = 'overlay'; const lite = cols[1] || cols[0];
  for (let j = 0; j < 9; j++) {
    x.strokeStyle = `rgba(${hexc(lite).join(',')},${(0.05 + R() * 0.14).toFixed(2)})`;
    x.lineWidth = 1 + R() * 2; x.beginPath(); const yy = R() * h; x.moveTo(-10, yy); x.lineTo(w + 10, yy + (R() - 0.5) * h * 0.5); x.stroke();
  }
  x.globalCompositeOperation = 'source-over';
  const img = x.getImageData(0, 0, w, h), d2 = img.data;
  for (let p = 0; p < d2.length; p += 4) { const n = (R() * 255) | 0, a = 18; d2[p] += (n - 128) * a / 255; d2[p + 1] += (n - 128) * a / 255; d2[p + 2] += (n - 128) * a / 255; }
  x.putImageData(img, 0, 0);
  const sg = x.createLinearGradient(0, 0, 0, h);
  sg.addColorStop(0, 'rgba(255,255,255,.16)'); sg.addColorStop(.25, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,.28)');
  x.fillStyle = sg; x.fillRect(0, 0, w, h);
}

type Slot = { kind: 'project'; p: Project; idx: number; preview?: string } | { kind: 'add'; seed: number };

export default function Home() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const queryRef = useRef('');

  useEffect(() => { listProjects().then(setProjects); }, []);
  // feed the query to the animation loop without restarting it
  useEffect(() => { queryRef.current = query.trim().toLowerCase(); }, [query]);

  // "new project" now opens the template picker instead of dropping you on a blank canvas
  function newProject() { setPickerOpen(true); }

  async function createFrom(t: Template) {
    setPickerOpen(false);
    try {
      const p = await createProject(t.id === 'blank' ? 'Untitled' : t.name, t.build());
      router.push(`/studio/${p.id}`);
    } catch (e) {
      // project-count cap hit (enforced by the DB trigger) → send them to upgrade
      if (/project_limit|limit reached|upgrade/i.test((e as Error).message)) router.push('/pricing');
      else throw e;
    }
  }

  const slots: Slot[] = useMemo(() => {
    // full halo, most-recently-opened first → index 0 sits at the front.
    // search no longer filters the ring — it spins it to the match (see frame loop).
    const sorted = [...(projects ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
    const total = Math.max(sorted.length + 3, MIN_SLOTS);
    const addN = total - sorted.length;
    return [
      ...sorted.map((p, idx) => ({ kind: 'project' as const, p, idx, preview: previewOf(p) })),
      ...Array.from({ length: addN }, (_, i) => ({ kind: 'add' as const, seed: (sorted.length + i) * 13 })),
    ];
  }, [projects]);

  // static halo (no spin) — recent projects at the front; gentle mouse parallax + float only
  useEffect(() => {
    if (projects === null) return;
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = slots.length;
    const angs = slots.map((_, i) => (i / N) * Math.PI * 2);
    const tilts = slots.map((_, i) => ((i * 37) % 11) - 5);
    let rot = 0, vel = 0, px = 0, py = 0, raf = 0;

    const onMove = (e: PointerEvent) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; };
    // no auto-spin; the user nudges it with ← / → (or ↑ / ↓)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') vel += 0.05;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') vel -= 0.05;
    };
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('keydown', onKey);

    const frame = (now: number) => {
      const W = stage.clientWidth || innerWidth, H = stage.clientHeight || innerHeight;
      const cx = W / 2 + px * 26, cy = H * 0.5 + py * 16;
      const rx = Math.min(Math.max(W * 0.32, 430), 560), ry = Math.min(H * 0.24, 235);

      // search: spin the ring so the first matching project eases to the front
      const q = queryRef.current;
      let match = -1;
      if (q) for (let i = 0; i < N; i++) {
        const s = slots[i];
        if (s.kind === 'project' && (s.p.name || '').toLowerCase().includes(q)) { match = i; break; }
      }
      if (match >= 0) {
        let desired = -angs[match];
        while (desired - rot > Math.PI) desired -= Math.PI * 2;
        while (desired - rot < -Math.PI) desired += Math.PI * 2;
        rot += (desired - rot) * (reduce ? 1 : 0.14); // ease toward the match
        vel = 0;
      } else {
        rot += vel; vel *= 0.94; // free spin — decays to rest, never auto-spins
      }

      for (let i = 0; i < N; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const a = angs[i] + rot, f = Math.cos(a), t01 = (f + 1) / 2;
        const X = cx + Math.sin(a) * rx;
        const Y = cy + f * ry + (reduce ? 0 : Math.sin(now / 1500 + i) * 3);
        const s = 0.5 + t01 * 0.68;
        // during a search, fade back the cards that don't match so the hit reads
        const hit = q ? (slots[i].kind === 'project' && ((slots[i] as { p: Project }).p.name || '').toLowerCase().includes(q)) : true;
        const dim = q && !hit ? 0.34 : 1;
        el.style.zIndex = String((t01 * 120) | 0);
        el.style.opacity = ((0.26 + t01 * 0.74) * dim).toFixed(3);
        el.style.transform = `translate3d(${X.toFixed(1)}px,${Y.toFixed(1)}px,0) translate(-50%,-50%) rotate(${(tilts[i] * 0.25).toFixed(2)}deg) scale(${s.toFixed(3)})`;
        const bl = (1 - t01) * 2.6;
        el.style.filter = bl > 0.15 ? `blur(${bl.toFixed(1)}px)` : 'none';
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    frame(0);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onMove);
      removeEventListener('keydown', onKey);
    };
  }, [slots, projects]);

  return (
    <main className="halo-home">
      <header className="halo-chrome">
        <div className="wordmark"><img className="lk-logo" alt="LOHO KUR" src="/lk-logo.png" /><sup>®</sup></div>
        {projects !== null && (
          <div className="halo-search">
            <svg className="hs-mag" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" aria-label="Search projects" />
          </div>
        )}
        <nav className="halo-pill" aria-label="Actions">
          <button className="hp-icon" aria-label="Settings" title="Settings">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          <button className="hp-item" onClick={async () => { await supabaseBrowser().auth.signOut(); router.push('/login'); router.refresh(); }}>Sign out</button>
          <button className="hp-item">Invite</button>
          <button className="hp-item cta" onClick={newProject}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            New project
          </button>
        </nav>
      </header>

      {projects === null ? (
        <p className="halo-loading">Loading…</p>
      ) : (
        <div className="halo-ring" ref={stageRef}>
          {slots.map((slot, i) =>
            slot.kind === 'project' ? (
              <a
                key={slot.p.id}
                href={`/studio/${slot.p.id}`}
                className="hcard"
                ref={(el) => { cardRefs.current[i] = el; }}
                aria-label={slot.p.name}
              >
                <div className="hfloat" style={slot.preview ? undefined : { backgroundImage: `linear-gradient(155deg, hsl(${hueOf(slot.p.id)} 42% 24%), hsl(${(hueOf(slot.p.id) + 46) % 360} 48% 12%))` }}>
                  {slot.preview && <img className="hface" src={slot.preview} alt="" draggable={false} />}
                  <span className="hcode">{pad(slot.idx + 1)}</span>
                  <div className="hmeta">
                    <span className="hname">{slot.p.name}</span>
                    <span className="hsub">Edited {ago(slot.p.updatedAt)}</span>
                  </div>
                </div>
              </a>
            ) : (
              <button
                key={`add-${i}`}
                className="hcard add"
                ref={(el) => { cardRefs.current[i] = el; }}
                onClick={newProject}
                aria-label="New project"
              >
                <div className="hfloat">
                  <canvas
                    className="hart" width={168} height={224}
                    ref={(c) => { if (c && !c.dataset.p) { paintArt(c, PALETTES[i % PALETTES.length], slot.seed); c.dataset.p = '1'; } }}
                  />
                  <svg className="hplus" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  <span className="haddl">New project</span>
                </div>
              </button>
            )
          )}
        </div>
      )}

      {pickerOpen && (
        <div className="tpl-overlay" onClick={() => setPickerOpen(false)}>
          <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tpl-head">
              <h2>Start a new project</h2>
              <button className="tpl-x" onClick={() => setPickerOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="tpl-grid">
              {TEMPLATES.map((t) => (
                <button key={t.id} className={`tpl-card${t.id === 'core' ? ' rec' : ''}`} onClick={() => createFrom(t)}>
                  {t.id === 'core' && <span className="tpl-rec">Recommended</span>}
                  <div className="tpl-flow">
                    {t.stages.length === 0 ? (
                      <span className="tpl-chip ghost">blank</span>
                    ) : (
                      t.stages.map((s, i) => (
                        <span key={s + i} className="tpl-chip-wrap">
                          {i > 0 && <span className="tpl-arrow">→</span>}
                          <span className="tpl-chip">{s}</span>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="tpl-name">{t.name}</div>
                  <div className="tpl-blurb">{t.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
