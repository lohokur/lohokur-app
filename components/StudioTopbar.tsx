'use client';

import { useEffect, useRef, useState } from 'react';

type Action = { label: string; fn?: () => void; disabled?: boolean; hint?: string; sep?: never };
type Sep = { sep: true; label?: never };

export default function StudioTopbar({
  name, onRename, onBack, onProfile, onNew, onDuplicate, onUndo, onRedo, onSettings, canUndo, canRedo,
}: {
  name: string;
  onRename: (name: string) => void;
  onBack: () => void;
  onProfile: () => void;
  onNew: () => void;
  onDuplicate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onSettings: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(name); }, [name, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const startRename = () => { setOpen(false); setEditing(true); };
  const commit = () => { const v = draft.trim(); if (v && v !== name) onRename(v); setEditing(false); };

  const items: (Action | Sep)[] = [
    { label: 'Back to projects', fn: onBack },
    { label: 'My profile', fn: onProfile },
    { sep: true },
    { label: 'New project', fn: onNew },
    { label: 'Duplicate project', fn: onDuplicate },
    { label: 'Rename project', fn: startRename },
    { sep: true },
    { label: 'Undo', fn: onUndo, disabled: !canUndo, hint: '⌘Z' },
    { label: 'Redo', fn: onRedo, disabled: !canRedo, hint: '⌘⇧Z' },
    { sep: true },
    { label: 'Project settings', fn: onSettings },
  ];

  return (
    <div className="stopbar" ref={wrapRef}>
      <button className="stb-logo-btn" aria-label="Project menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <img className="stb-logo" src="/lk-logo.png" alt="LOHO KUR" draggable={false} />
      </button>

      <button
        className={`stb-caret${open ? ' on' : ''}`}
        aria-label="Project menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {editing ? (
        <input
          ref={inputRef}
          className="stb-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') { setDraft(name); setEditing(false); }
          }}
        />
      ) : (
        <button className="stb-name" onClick={startRename} title="Rename project">{name || 'Untitled'}</button>
      )}

      {open && (
        <div className="stb-menu" role="menu">
          {items.map((it, i) => it.sep
            ? <div key={i} className="stb-sep" />
            : (
              <button
                key={i}
                role="menuitem"
                className="stb-item"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.fn?.(); }}
              >
                <span>{it.label}</span>
                {it.hint && <kbd>{it.hint}</kbd>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
