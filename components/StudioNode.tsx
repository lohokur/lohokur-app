'use client';

import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

// Brand studio: plug in a visualisation (or image), prompt it into anything —
// billboards, editorial shoots, campaign scenes — to help marketers brand the product.
export default function StudioNode({ id, data, selected }: NodeProps) {
  const { promptImage } = useStudio();
  const d = data as { image?: string; loading?: boolean; note?: string; prompt?: string };
  const [text, setText] = useState(d.prompt ?? '');
  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };

  return (
    <div className={`stage-node studio-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head"><span>Brand studio</span></div>
      <div className="sn-draw">
        {d.loading ? (
          <span className="sn-empty pulse">{d.note ?? 'branding…'}</span>
        ) : d.image ? (
          <img src={d.image} alt="" draggable={false} />
        ) : (
          <span className="sn-empty">{d.note ?? 'connect a visualisation, then prompt below'}</span>
        )}
      </div>
      <div className="sn-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. on a billboard in Times Square at night; editorial magazine cover; worn on a city street…"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        />
        <button className="sn-go" disabled={d.loading || !text.trim()} onClick={submit}>{d.loading ? '…' : 'Submit'}</button>
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
