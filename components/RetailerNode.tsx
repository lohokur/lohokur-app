'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { type ChosenRetailer, statusLabel } from '@/lib/retailers';

export default function RetailerNode({ id, data, selected }: NodeProps) {
  const { openRetailer } = useStudio();
  const r = (data as { retailer?: ChosenRetailer }).retailer;
  const status = r?.status ?? 'draft';

  return (
    <div className={`stage-node retailer-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Retailer</span>
        <button className="sn-edit nodrag" onClick={(e) => { e.stopPropagation(); openRetailer(id); }}>
          {r ? 'change' : 'find'}
        </button>
      </div>
      <div className="sn-body" onDoubleClick={() => openRetailer(id)}>
        {r ? (
          <>
            <strong className="tp-node-name">{r.name}</strong>
            <span className="tp-node-meta">{r.location} · {r.kind === 'both' ? 'online + store' : r.kind}</span>
            <span className={`rt-status rt-${status}`}>{statusLabel(status)}</span>
          </>
        ) : (
          'stock this collection somewhere →'
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
