'use client';

import { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { ActionArrow, OpenIcon } from '@/components/ActionArrow';

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
          <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); openPattern(id); }} title="Open pattern maker" aria-label="Open pattern maker"><OpenIcon /></button>
          <button className="sn-act nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} title={image ? 'Replace image' : 'Upload an image'} aria-label={image ? 'Replace image' : 'Upload an image'}><ActionArrow /></button>
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
          : <span className="sn-empty">trace a garment into an outline</span>}
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
