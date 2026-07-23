'use client';

import { useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon, ActionArrow } from '@/components/ActionArrow';
import { VIEWS, type View } from '@/lib/nodeTypes';

// The single starting node: draw an idea, upload/paste an image, or prompt one
// into existence — all in one place. (Absorbs the old Image node.)
export default function SketchNode({ id, data, selected }: NodeProps) {
  const { openSketch, promptImage, setNodeImage } = useStudio();
  const d = data as { image?: string; views?: Partial<Record<View, string>>; loading?: boolean; note?: string; prompt?: string; coachGenerate?: boolean };
  const views = d.views ?? (d.image ? { front: d.image } : {});
  const front = views.front ?? d.image;
  const [text, setText] = useState(d.prompt ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };
  const coach = !!d.coachGenerate && !front && !d.loading && !!text.trim();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setNodeImage(id, r.result as string);
    r.readAsDataURL(f);
    e.target.value = '';
  };

  return (
    <div className={`stage-node sketch-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Sketch</span>
        <div className="sn-acts">
          <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openSketch(id); }} title={front ? 'Edit drawing' : 'Draw'} aria-label={front ? 'Edit drawing' : 'Draw'}><OpenIcon /></button>
          <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} title="Upload an image" aria-label="Upload an image"><ActionArrow /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
      </div>
      <div className="sn-draw">
        {d.loading ? (
          <span className="sn-empty pulse">{d.note ?? 'generating…'}</span>
        ) : front ? (
          <img src={front} alt="Sketch" draggable={false} />
        ) : (
          <span className="sn-empty">{d.note ?? 'draw · upload · or prompt'}</span>
        )}
      </div>
      <div className="sn-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an image to generate…"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className={`sn-act nodrag${coach ? ' coach' : ''}${d.loading ? ' busy' : ''}`} disabled={d.loading || !text.trim()} onClick={submit} title="Generate" aria-label="Generate">{d.loading ? <span className="sn-spin" /> : <ActionArrow />}</button>
      </div>
      <div className="sn-views">
        {VIEWS.map((v) => (
          <span key={v} className={views[v] ? 'on' : ''}>{v[0].toUpperCase()}</span>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
