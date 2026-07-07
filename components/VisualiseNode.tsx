'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const d = data as { image?: string; loading?: boolean; note?: string };
  return (
    <div className={`stage-node visualise-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Visualise</span>
        <button
          className="sn-edit nodrag"
          onClick={(e) => { e.stopPropagation(); visualise(id); }}
          disabled={d.loading}
        >
          {d.loading ? '…' : d.image ? 'redo' : 'run'}
        </button>
      </div>
      <div className="sn-draw">
        {d.loading ? (
          <span className="sn-empty pulse">rendering on the model…</span>
        ) : d.image ? (
          <img src={d.image} alt="Visualised" draggable={false} />
        ) : (
          <span className="sn-empty">{d.note ?? 'connect a sketch → run'}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
