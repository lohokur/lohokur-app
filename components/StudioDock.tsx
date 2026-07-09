'use client';

import type { ReactNode } from 'react';
import type { Stage, StageKey } from '@/lib/nodeTypes';

// line icons (24x24, stroke) for each pipeline stage
const ICONS: Record<StageKey, ReactNode> = {
  sketch: <path d="M4 20l3.6-.9L18.1 8.6a1.8 1.8 0 0 0 0-2.6l-1.1-1.1a1.8 1.8 0 0 0-2.6 0L3.9 15.4 3 19z" />, // pencil
  visualise: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="M3 16.5l5-4.5 4 3.5 3-2.5 6 5" />
    </>
  ), // image / visualise
  studio: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" />
    </>
  ), // magic / sparkle
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M3 16.5l5-4.5 4 3.5 3-2.5 6 5" />
      <path d="M17 3.5v4M15 5.5h4" />
    </>
  ), // picture with +
  extract: <path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14" />, // crop
  pattern: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ), // layered pieces
  techpack: (
    <>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v6h6" />
      <path d="M9.5 13h6M9.5 17h6" />
    </>
  ), // spec document
  sample: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v9" />
    </>
  ), // package
  manufacture: (
    <>
      <path d="M3 21V10l6 4V10l6 4V10l6 4v7z" />
      <path d="M3 21h18" />
    </>
  ), // factory
  ship: (
    <>
      <path d="M1.5 7h10.5v9H1.5z" />
      <path d="M12 10h5l4 3.5V16h-9z" />
      <circle cx="6" cy="18.5" r="1.6" />
      <circle cx="17.5" cy="18.5" r="1.6" />
    </>
  ), // truck
};

export default function StudioDock({ stages, onAdd, onLibrary, onProfile }: { stages: Stage[]; onAdd: (k: StageKey) => void; onLibrary: () => void; onProfile: () => void }) {
  return (
    <div className="dock" role="toolbar" aria-label="Add nodes">
      {stages.map((s) => (
        <button key={s.key} className="dock-btn" onClick={() => onAdd(s.key)} aria-label={s.label} title={s.hint}>
          <svg className="dock-ic" viewBox="0 0 24 24" aria-hidden="true">{ICONS[s.key]}</svg>
          <span className="dock-label">{s.label}</span>
        </button>
      ))}

      <div className="dock-div" />

      <button className="dock-btn dock-lib" onClick={onLibrary} aria-label="Canvas library" title="Canvas library — everything made here">
        <svg className="dock-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        <span className="dock-label">Library</span>
      </button>

      <button className="dock-btn dock-prof" onClick={onProfile} aria-label="My profile" title="My profile">
        <span className="dock-avatar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.4" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>
        </span>
        <span className="dock-label">My profile</span>
      </button>
    </div>
  );
}
