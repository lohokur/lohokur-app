'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import { type Sample, statusLabel } from '@/lib/sample';
import type { ChosenManufacturer } from '@/lib/manufacturers';
import type { ProduceMode } from '@/components/ProducePanel';

// Produce: one sample to hold, or a bulk factory run — one node, one tech pack.
export default function SampleNode({ id, data, selected }: NodeProps) {
  const { openSample } = useStudio();
  const d = data as { sample?: Sample; manufacturer?: ChosenManufacturer; produceMode?: ProduceMode };
  const mode: ProduceMode = d.produceMode ?? 'sample';
  const s = d.sample;
  const m = d.manufacturer;
  const configured = mode === 'bulk' ? !!m : !!s?.samplerName;

  return (
    <div className={`stage-node produce-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Produce</span>
        <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openSample(id); }} title={configured ? 'Edit production' : 'Set up production'} aria-label={configured ? 'Edit production' : 'Set up production'}><OpenIcon /></button>
      </div>
      <div className="sn-body" onDoubleClick={() => openSample(id)}>
        {mode === 'bulk' ? (
          m ? (
            <>
              <strong className="tp-node-name">{m.name}</strong>
              <span className="tp-node-meta">${m.unitCost}/unit · MOQ {m.moq} · bulk run</span>
            </>
          ) : (
            'bulk run — find a factory for this garment →'
          )
        ) : s?.samplerName ? (
          <>
            <strong className="tp-node-name">{s.samplerName}</strong>
            <span className="tp-node-meta">{s.qty} sample · ${s.sampleCost} · {statusLabel(s.status)}</span>
          </>
        ) : (
          'make one sample of this garment →'
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
