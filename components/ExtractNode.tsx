'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';

export default function ExtractNode({ id, data, selected }: NodeProps) {
  const { openExtract } = useStudio();
  const image = (data as { image?: string }).image;
  return (
    <div className={`stage-node extract-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Extract</span>
        <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openExtract(id); }} title={image ? 'Extract again' : 'Pick a piece'} aria-label={image ? 'Extract again' : 'Pick a piece'}><OpenIcon /></button>
      </div>
      <div className="sn-draw">
        {image ? <img src={image} alt="Extracted" draggable={false} /> : <span className="sn-empty">open · hover a garment · click to extract</span>}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
