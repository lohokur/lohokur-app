'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { VIEWS, type View } from '@/lib/nodeTypes';

export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const d = data as { image?: string; views?: Partial<Record<View, string>>; loading?: boolean; note?: string };
  const views = d.views ?? {};
  const main = views.front ?? d.image;
  const extras = (['side', 'back'] as View[]).filter((v) => views[v]);
  return (
    <div className={`stage-node visualise-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Visualise</span>
        <button className="sn-edit nodrag" onClick={(e) => { e.stopPropagation(); visualise(id); }} disabled={d.loading}>
          {d.loading ? '…' : main ? 'redo' : 'run'}
        </button>
      </div>
      <div className="sn-draw">
        {d.loading ? (
          <span className="sn-empty pulse">{d.note ?? 'rendering…'}</span>
        ) : main ? (
          <img src={main} alt="Visualised" draggable={false} />
        ) : (
          <span className="sn-empty">{d.note ?? 'connect a sketch → run'}</span>
        )}
      </div>
      {extras.length > 0 && (
        <div className="sn-thumbs">
          {extras.map((v) => (
            <figure key={v}><img src={views[v]} alt={v} draggable={false} /><figcaption>{v}</figcaption></figure>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
