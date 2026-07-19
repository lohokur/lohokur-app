'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import { type Sample, statusLabel } from '@/lib/sample';

export default function SampleNode({ id, data, selected }: NodeProps) {
  const { openSample } = useStudio();
  const s = (data as { sample?: Sample }).sample;
  const configured = s?.samplerName;

  return (
    <div className={`stage-node sample-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Create Sample</span>
        <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openSample(id); }} title={configured ? 'Edit sample' : 'Set up sample'} aria-label={configured ? 'Edit sample' : 'Set up sample'}><OpenIcon /></button>
      </div>
      <div className="sn-body" onDoubleClick={() => openSample(id)}>
        {configured ? (
          <>
            <strong className="tp-node-name">{s!.samplerName}</strong>
            <span className="tp-node-meta">{s!.qty} sample · ${s!.sampleCost} · {statusLabel(s!.status)}</span>
          </>
        ) : (
          'make one sample of this garment →'
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
