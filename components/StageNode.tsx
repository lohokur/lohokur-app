'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { STAGE_MAP, type StageKey } from '@/lib/nodeTypes';

export default function StageNode({ data, selected }: NodeProps) {
  const type = (data as { type: StageKey }).type;
  const stage = STAGE_MAP[type];
  return (
    <div className={`stage-node${selected ? ' selected' : ''}`} data-type={type}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>{stage?.label ?? type}</span>
        <span className="sn-tag">stage</span>
      </div>
      <div className="sn-body">{stage?.hint ?? ''}</div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
