'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type MenuItem =
  | { sep: true }
  | {
      label: string;
      shortcut?: string;
      danger?: boolean;
      disabled?: boolean;
      onClick: () => void;
    };

export type MenuState = { x: number; y: number; items: MenuItem[] } | null;

// Small floating context menu. Positions itself at (x, y) but nudges back on
// screen if it would overflow the viewport. Closes on outside click / Escape.
export default function CanvasMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: menu?.x ?? 0, y: menu?.y ?? 0 });

  useLayoutEffect(() => {
    if (!menu) return;
    setPos({ x: menu.x, y: menu.y });
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let x = menu.x;
    let y = menu.y;
    if (x + r.width > window.innerWidth - pad) x = window.innerWidth - r.width - pad;
    if (y + r.height > window.innerHeight - pad) y = window.innerHeight - r.height - pad;
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div ref={ref} className="cmenu" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      {menu.items.map((it, i) =>
        'sep' in it ? (
          <div key={`s${i}`} className="cmenu-sep" />
        ) : (
          <button
            key={it.label}
            className={`cmenu-item${it.danger ? ' danger' : ''}`}
            disabled={it.disabled}
            onClick={() => { if (!it.disabled) { it.onClick(); onClose(); } }}
          >
            <span>{it.label}</span>
            {it.shortcut && <kbd className="cmenu-kbd">{it.shortcut}</kbd>}
          </button>
        )
      )}
    </div>
  );
}
