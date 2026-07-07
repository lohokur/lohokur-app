'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

export default function ExtractNode({ id, data, selected }: NodeProps) {
  const { openExtract } = useStudio();
  const image = (data as { image?: string }).image;
  return (
    <div className={`stage-node extract-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Extract</span>
        <button className="sn-edit nodrag" onClick={(e) => { e.stopPropagation(); openExtract(id); }}>
          {image ? 'again' : 'pick'}
        </button>
      </div>
      <div className="sn-draw">
        {image ? <img src={image} alt="Extracted" draggable={false} /> : <span className="sn-empty">open · hover a piece · click to lift</span>}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
