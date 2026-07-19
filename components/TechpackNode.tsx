'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import type { Techpack } from '@/lib/techpack';

export default function TechpackNode({ id, data, selected }: NodeProps) {
  const { openTechpack } = useStudio();
  const tp = (data as { techpack?: Techpack }).techpack;

  return (
    <div className={`stage-node techpack-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Techpack</span>
        <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openTechpack(id); }} title={tp ? 'Edit tech pack' : 'Open tech pack'} aria-label={tp ? 'Edit tech pack' : 'Open tech pack'}><OpenIcon /></button>
      </div>
      <div className="sn-body" onDoubleClick={() => openTechpack(id)}>
        {tp ? (
          <>
            <strong className="tp-node-name">{tp.name || 'Untitled garment'}</strong>
            <span className="tp-node-meta">{tp.poms?.length ?? 0} POM · {tp.materials?.length ?? 0} materials</span>
          </>
        ) : (
          'open the tech-pack editor →'
        )}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
