'use client';

import { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

export default function PatternNode({ id, data, selected }: NodeProps) {
  const { setNodeImage, openPattern } = useStudio();
  const image = (data as { image?: string }).image;
  const fileRef = useRef<HTMLInputElement>(null);

  const load = (f?: File | null) => {
    if (!f || !/^image\//.test(f.type)) return;
    const fr = new FileReader();
    fr.onload = () => setNodeImage(id, fr.result as string);
    fr.readAsDataURL(f);
  };

  return (
    <div
      className={`stage-node pattern-node${selected ? ' selected' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files?.[0]); }}
    >
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Pattern maker</span>
        <div className="sn-actions">
          <button
            className="sn-edit nodrag"
            onClick={(e) => { e.stopPropagation(); openPattern(id); }}
          >
            flatten
          </button>
          <button
            className="sn-edit nodrag"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            {image ? 'replace' : 'upload'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => { load(e.target.files?.[0]); e.currentTarget.value = ''; }}
        />
      </div>
      <div className="sn-draw" onDoubleClick={() => openPattern(id)}>
        {image
          ? <img src={image} alt="Pattern" draggable={false} />
          : <span className="sn-empty">flatten a surface into a pattern</span>}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
