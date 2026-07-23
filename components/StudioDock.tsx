'use client';

import type { ReactNode } from 'react';
import { HOTKEY_FOR, type Stage, type StageKey } from '@/lib/nodeTypes';

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
  retailer: (
    <>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M3 9a2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ), // storefront / shop
  ship: (
    <>
      <path d="M1.5 7h10.5v9H1.5z" />
      <path d="M12 10h5l4 3.5V16h-9z" />
      <circle cx="6" cy="18.5" r="1.6" />
      <circle cx="17.5" cy="18.5" r="1.6" />
    </>
  ), // truck
};

// A blank/source glyph for stages that start from scratch.
const BLANK = <rect x="4" y="4" width="16" height="16" rx="3" strokeDasharray="3 3" />;

// The logical input each stage transforms — drives the hover "reenactment"
// (input → output). Stages with no entry start from BLANK.
const BEFORE: Partial<Record<StageKey, StageKey>> = {
  visualise: 'sketch',
  studio: 'sketch',
  pattern: 'visualise',
  techpack: 'pattern',
  sample: 'techpack',
  manufacture: 'sample',
  retailer: 'manufacture',
  ship: 'sample',
};

export default function StudioDock({ stages, onAdd, onNote, onLibrary, onProfile, isLocked, onLocked, comingSoon }: {
  stages: Stage[];
  onAdd: (k: StageKey) => void;
  onNote: () => void;
  onLibrary: () => void;
  onProfile: () => void;
  isLocked?: (k: StageKey) => boolean;
  onLocked?: (k: StageKey) => void;
  comingSoon?: (k: StageKey) => boolean;
}) {
  return (
    <div className="dock" role="toolbar" aria-label="Add nodes">
      {stages.map((s) => {
        const soon = comingSoon?.(s.key) ?? false;
        const locked = !soon && (isLocked?.(s.key) ?? false); // coming-soon takes precedence over the paywall lock
        return (
          <button
            key={s.key}
            className={`dock-btn${soon ? ' soon' : locked ? ' locked' : ''}`}
            aria-disabled={soon || undefined}
            onClick={() => { if (soon) return; locked ? onLocked?.(s.key) : onAdd(s.key); }}
            aria-label={soon ? `${s.label} (coming soon)` : locked ? `${s.label} (upgrade to unlock)` : s.label}
            title={soon ? `${s.label} — coming soon` : locked ? `${s.label} — upgrade to unlock` : `${s.hint}${HOTKEY_FOR[s.key] ? `  ·  ${HOTKEY_FOR[s.key]!.toUpperCase()}` : ''}`}
          >
            <svg className="dock-ic" viewBox="0 0 24 24" aria-hidden="true">{ICONS[s.key]}</svg>
            <span className="dock-label">{s.label}{!soon && HOTKEY_FOR[s.key] && <kbd className="dock-key">{HOTKEY_FOR[s.key]!.toUpperCase()}</kbd>}{soon && <span className="dock-soon-label">Coming soon</span>}</span>
            {soon ? (
              <span className="dock-soon" aria-hidden="true">Soon</span>
            ) : locked && (
              <svg className="dock-lock" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )}

            {/* hover reenactment: input → output */}
            <div className="dock-preview" aria-hidden="true">
              <div className="np-scene">
                <svg className="np-ic np-before" viewBox="0 0 24 24">{BEFORE[s.key] ? ICONS[BEFORE[s.key]!] : BLANK}</svg>
                <svg className="np-ic np-arrow" viewBox="0 0 24 24"><path d="M4 12h13" /><path d="M13 7l5 5-5 5" /></svg>
                <svg className="np-ic np-after" viewBox="0 0 24 24">{ICONS[s.key]}</svg>
              </div>
              <div className="np-cap">{s.label} — {s.hint}</div>
            </div>
          </button>
        );
      })}

      <div className="dock-div" />

      <button className="dock-btn" onClick={onNote} aria-label="Add sticky note" title="Sticky note  ·  N">
        <svg className="dock-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v11l-5 5H4z" /><path d="M20 15h-5v5" /><path d="M8 9h8M8 13h5" /></svg>
        <span className="dock-label">Note<kbd className="dock-key">N</kbd></span>
      </button>

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
