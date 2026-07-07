'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

export default function SketchNode({ id, data, selected }: NodeProps) {
  const { openSketch } = useStudio();
  const image = (data as { image?: string }).image;
  return (
    <div className={`stage-node sketch-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Sketch</span>
        <button
          className="sn-edit nodrag"
          onClick={(e) => {
            e.stopPropagation();
            openSketch(id);
          }}
        >
          {image ? 'edit' : 'draw'}
        </button>
      </div>
      <div className="sn-draw">
        {image ? (
          <img src={image} alt="Sketch" draggable={false} />
        ) : (
          <span className="sn-empty">draw your idea</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
