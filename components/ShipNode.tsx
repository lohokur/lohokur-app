'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';

type Tracking = { number: string; carrier: string; orderNo?: string };

// Ship: hand a run to a 3PL fulfilment partner. Not live yet (coming soon) —
// delivery addresses are collected at produce checkout. Still shows tracking
// once an order ships.
export default function ShipNode({ id, data, selected }: NodeProps) {
  const { openShip } = useStudio();
  const d = data as { tracking?: Tracking };
  const tracking = d.tracking;

  return (
    <div className={`fbnode ship-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas fb-info" onClick={() => openShip(id)}>
        <NodeArt seed={seedFrom(id)} animate={!!tracking} />
        <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 7h10.5v9H1.5z" /><path d="M12 10h5l4 3.5V16h-9z" /><circle cx="6" cy="18.5" r="1.6" /><circle cx="17.5" cy="18.5" r="1.6" /></svg>
        {tracking ? (
          <>
            <strong>On its way</strong>
            <span>{tracking.carrier} · {tracking.number}</span>
          </>
        ) : (
          <>
            <strong className="node-empty-title">Send to a 3PL partner.</strong>
            <span className="fb-hint">coming soon</span>
          </>
        )}
      </div>

      <span className="fb-tag">Ship</span>

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); openShip(id); }} title="Fulfilment" aria-label="Fulfilment"><OpenIcon /></button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
