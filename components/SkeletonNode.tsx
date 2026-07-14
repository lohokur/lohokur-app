'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { STAGE_MAP, type StageKey } from '@/lib/nodeTypes';

// Placeholder shown at a saved node's position while the project's images load.
// Reuses `.stage-node[data-type]` so it takes the exact shape/width of the real
// node, and shows the stage label so the user sees WHAT is loading, WHERE.
export default function SkeletonNode({ data }: NodeProps) {
  const type = (data as { type: StageKey }).type;
  const stage = STAGE_MAP[type];
  return (
    <div className="stage-node skeleton-node" data-type={type} aria-busy="true">
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>{stage?.label ?? type}</span>
        <span className="sn-tag">loading…</span>
      </div>
      <div className="sk-media"><span className="sk-shimmer" /></div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
