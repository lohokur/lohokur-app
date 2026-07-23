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

  return (
    <div className={`fbnode produce-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas fb-info" onDoubleClick={() => openSample(id)}>
        <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v9" /></svg>
        {mode === 'bulk' ? (
          m ? (
            <><strong>{m.name}</strong><span>${m.unitCost}/unit · MOQ {m.moq} · bulk run</span></>
          ) : (
            <span className="fb-hint">bulk run — find a factory</span>
          )
        ) : s?.samplerName ? (
          <><strong>{s.samplerName}</strong><span>{s.qty} sample · ${s.sampleCost} · {statusLabel(s.status)}</span></>
        ) : (
          <span className="fb-hint">make one sample of this garment</span>
        )}
      </div>

      <span className="fb-tag">Produce</span>

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); openSample(id); }} title="Set up production" aria-label="Set up production"><OpenIcon /></button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
