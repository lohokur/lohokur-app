'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import type { ChosenManufacturer } from '@/lib/manufacturers';

export default function ManufactureNode({ id, data, selected }: NodeProps) {
  const { openManufacture } = useStudio();
  const m = (data as { manufacturer?: ChosenManufacturer }).manufacturer;

  return (
    <div className={`stage-node manufacture-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Manufacture</span>
        <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openManufacture(id); }} title={m ? 'Change manufacturer' : 'Find a manufacturer'} aria-label={m ? 'Change manufacturer' : 'Find a manufacturer'}><OpenIcon /></button>
      </div>
      <div className="sn-body" onDoubleClick={() => openManufacture(id)}>
        {m ? (
          <>
            <strong className="tp-node-name">{m.name}</strong>
            <span className="tp-node-meta">${m.unitCost}/unit · MOQ {m.moq} · sample ${m.sampleCost}</span>
          </>
        ) : (
          'find a factory for this garment →'
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
