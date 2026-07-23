'use client';

import type { ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';
import { STAGE_MAP, type StageKey } from '@/lib/nodeTypes';

// Generic stage node (used by Ship) — full-bleed clean card with an icon + hint.
const ICON: Partial<Record<string, ReactNode>> = {
  ship: <><path d="M1.5 7h10.5v9H1.5z" /><path d="M12 10h5l4 3.5V16h-9z" /><circle cx="6" cy="18.5" r="1.6" /><circle cx="17.5" cy="18.5" r="1.6" /></>,
};
const CARD_HINT: Partial<Record<string, string>> = {
  ship: 'ship this product to any address',
};

export default function StageNode({ id, data, selected }: NodeProps) {
  const type = (data as { type: StageKey }).type;
  const stage = STAGE_MAP[type];
  return (
    <div className={`fbnode stagegeneric-node${selected ? ' selected' : ''}`} data-type={type}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="fb-canvas fb-info">
        <NodeArt seed={seedFrom(id)} />
        <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true">{ICON[type] ?? <rect x="4" y="4" width="16" height="16" rx="3" />}</svg>
        <span className="fb-hint">{CARD_HINT[type] ?? stage?.hint ?? ''}</span>
      </div>
      <span className="fb-tag">{stage?.label ?? type}</span>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
