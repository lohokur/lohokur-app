'use client';

import { useEffect, useRef, useState } from 'react';

export type LibItem = { id: string; url: string; kind: string };

// section order + plural headings
const ORDER = ['Sketch', 'Visualisation', 'Extract', 'Pattern', 'Techpack', 'Sample', 'Manufacture', 'Media'];
const PLURAL: Record<string, string> = {
  Sketch: 'Sketches', Visualisation: 'Visualisations', Extract: 'Extracts', Pattern: 'Patterns',
  Techpack: 'Techpacks', Sample: 'Samples', Manufacture: 'Manufacture', Media: 'Media',
};

export default function StudioLibrary({ items, onClose }: { items: LibItem[]; onClose: () => void }) {
  const [zoom, setZoom] = useState<LibItem | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (zoom) setZoom(null); else onClose(); } };
    // collapse when clicking anywhere outside the drawer (but not the folder toggle or the lightbox)
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t) || t.closest?.('.dock-lib') || t.closest?.('.lib-light')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [zoom, onClose]);

  const groups = ORDER
    .map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) }))
    .filter((g) => g.items.length);

  return (
    <>
      <div className="lib-panel" role="dialog" aria-label="Canvas library" ref={panelRef}>
        <div className="lib-head">
          <span className="lib-title">Library</span>
          <span className="lib-count">{items.length}</span>
          <button className="lib-x" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="lib-body">
          {items.length === 0 ? (
            <p className="lib-empty">Nothing here yet. Every sketch, visualisation and image you make on this canvas collects here.</p>
          ) : (
            groups.map((g) => (
              <section key={g.kind} className="lib-sec">
                <h4 className="lib-sec-h">{PLURAL[g.kind] ?? g.kind}<span>{g.items.length}</span></h4>
                <div className="lib-grid">
                  {g.items.map((it) => (
                    <button key={it.id} className="lib-item" onClick={() => setZoom(it)} title={it.kind}>
                      <img src={it.url} alt={it.kind} draggable={false} />
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {zoom && (
        <div className="lib-light" onMouseDown={() => setZoom(null)}>
          <img src={zoom.url} alt={zoom.kind} draggable={false} onMouseDown={(e) => e.stopPropagation()} />
          <a
            className="lib-dl"
            href={zoom.url}
            download={`${zoom.kind.toLowerCase().replace(/\s+/g, '-')}-${zoom.id}.png`}
            onMouseDown={(e) => e.stopPropagation()}
          >
            Download
          </a>
        </div>
      )}
    </>
  );
}
