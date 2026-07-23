'use client';

import { useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon, ActionArrow } from '@/components/ActionArrow';
import { VIEWS, type View } from '@/lib/nodeTypes';

// The whole node IS the sketch canvas. On hover: the prompt bar floats over the
// bottom, the draw/upload tools appear top-right, and the front/side/back views
// pop up top-centre. (Absorbs the old Image node — draw · upload · prompt.)
export default function SketchNode({ id, data, selected }: NodeProps) {
  const { openSketch, promptImage, setNodeImage } = useStudio();
  const d = data as { image?: string; views?: Partial<Record<View, string>>; loading?: boolean; note?: string; prompt?: string; coachGenerate?: boolean };
  const views = d.views ?? (d.image ? { front: d.image } : {});
  const front = views.front ?? d.image;

  const [view, setView] = useState<View>('front');
  const shown = views[view] ?? front;
  const [text, setText] = useState(d.prompt ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };
  const coach = !!d.coachGenerate && !front && !d.loading && !!text.trim();
  const empty = !front && !d.loading;

  const loadFile = (f?: File | null) => {
    if (!f || !/^image\//.test(f.type)) return;
    const r = new FileReader();
    r.onload = () => setNodeImage(id, r.result as string);
    r.readAsDataURL(f);
  };

  return (
    <div
      className={`sketch-node${selected ? ' selected' : ''}${empty ? ' empty' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
    >
      <Handle type="target" position={Position.Left} className="sn-handle" />

      {/* the canvas fills the whole node */}
      <div className="sk-canvas" onDoubleClick={() => openSketch(id)}>
        {d.loading ? (
          <span className="sk-empty pulse">{d.note ?? 'generating…'}</span>
        ) : shown ? (
          <img src={shown} alt="Sketch" draggable={false} />
        ) : (
          <span className="sk-empty">draw · upload · or prompt</span>
        )}
      </div>

      {/* front / side / back — pops up on hover */}
      <div className="sk-views">
        {VIEWS.map((v) => (
          <button
            key={v}
            className={`sk-view${views[v] ? ' has' : ''}${view === v ? ' on' : ''}`}
            disabled={!views[v]}
            onClick={(e) => { e.stopPropagation(); if (views[v]) setView(v); }}
            title={`${v[0].toUpperCase()}${v.slice(1)} view`}
          >
            {v[0].toUpperCase()}
          </button>
        ))}
      </div>

      {/* draw / upload tools — appear on hover */}
      <div className="sk-tools">
        <button className="sk-tool nodrag" onClick={(e) => { e.stopPropagation(); openSketch(id); }} title={front ? 'Edit drawing' : 'Draw'} aria-label={front ? 'Edit drawing' : 'Draw'}><OpenIcon /></button>
        <button className="sk-tool nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} title="Upload an image" aria-label="Upload an image"><ActionArrow /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </div>

      {/* prompt bar — floats over the bottom of the canvas */}
      <div className="sk-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an image…"
          rows={1}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className={`sk-send${coach ? ' coach' : ''}${d.loading ? ' busy' : ''}`} disabled={d.loading || !text.trim()} onClick={submit} title="Generate" aria-label="Generate">
          {d.loading ? <span className="sn-spin" /> : <ActionArrow />}
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
