'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';
import type { Techpack } from '@/lib/techpack';

export default function TechpackNode({ id, data, selected }: NodeProps) {
  const { openTechpack } = useStudio();
  const tp = (data as { techpack?: Techpack }).techpack;

  return (
    <div className={`fbnode techpack-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas fb-info" onDoubleClick={() => openTechpack(id)}>
        <NodeArt seed={seedFrom(id)} />
        <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v6h6" /><path d="M9.5 13h6M9.5 17h6" /></svg>
        {tp ? (
          <>
            <strong>{tp.name || 'Untitled garment'}</strong>
            <span>{tp.poms?.length ?? 0} POM · {tp.materials?.length ?? 0} materials</span>
          </>
        ) : (
          <span className="fb-hint">open the tech-pack editor</span>
        )}
      </div>

      <span className="fb-tag">Techpack</span>

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); openTechpack(id); }} title={tp ? 'Edit tech pack' : 'Open tech pack'} aria-label="Open tech pack"><OpenIcon /></button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
