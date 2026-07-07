'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

export default function TechpackNode({ id, selected }: NodeProps) {
  const { openTechpack } = useStudio();
  return (
    <div className={`stage-node techpack-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Techpack</span>
        <button className="sn-edit nodrag" onClick={(e) => { e.stopPropagation(); openTechpack(id); }}>
          open
        </button>
      </div>
      <div className="sn-body">open the tech-pack editor →</div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
