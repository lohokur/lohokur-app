'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { VIEWS, type View } from '@/lib/nodeTypes';

export default function SketchNode({ id, data, selected }: NodeProps) {
  const { openSketch } = useStudio();
  const d = data as { image?: string; views?: Partial<Record<View, string>> };
  const views = d.views ?? (d.image ? { front: d.image } : {});
  const front = views.front ?? d.image;
  return (
    <div className={`stage-node sketch-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Sketch</span>
        <button className="sn-edit nodrag" onClick={(e) => { e.stopPropagation(); openSketch(id); }}>
          {front ? 'edit' : 'draw'}
        </button>
      </div>
      <div className="sn-draw">
        {front ? <img src={front} alt="Sketch" draggable={false} /> : <span className="sn-empty">draw your idea</span>}
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
