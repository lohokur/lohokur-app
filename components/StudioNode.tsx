'use client';

import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { ActionArrow } from '@/components/ActionArrow';

// Worldbuild: plug in a render (or image), prompt it into anything — billboards,
// editorial shoots, campaign scenes — to brand the product. Full-bleed clean node.
export default function StudioNode({ id, data, selected }: NodeProps) {
  const { promptImage } = useStudio();
  const d = data as { image?: string; loading?: boolean; note?: string; prompt?: string };
  const [text, setText] = useState(d.prompt ?? '');
  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };
  const empty = !d.image && !d.loading;

  return (
    <div className={`fbnode worldbuild-node${selected ? ' selected' : ''}${empty ? ' empty' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas">
        {d.loading ? (
          <span className="fb-empty pulse">{d.note ?? 'branding…'}</span>
        ) : d.image ? (
          <img src={d.image} alt="" draggable={false} />
        ) : (
          <span className="fb-empty">connect a render, then prompt a scene below</span>
        )}
      </div>

      <span className="fb-tag">Worldbuild</span>

      <div className="fb-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="on a billboard at night; editorial cover; worn on a city street…"
          rows={1}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="fb-send" disabled={d.loading || !text.trim()} onClick={submit} title="Generate" aria-label="Generate">
          {d.loading ? <span className="sn-spin" /> : <ActionArrow />}
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
