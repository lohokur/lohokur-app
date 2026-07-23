'use client';

import { useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon, UploadIcon } from '@/components/ActionArrow';

// Pattern maker: extract the garment, then trace the pattern — full-bleed clean node.
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
      className={`fbnode pattern-node${selected ? ' selected' : ''}${!image ? ' empty' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files?.[0]); }}
    >
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas" onDoubleClick={() => openPattern(id)}>
        {image
          ? <img src={image} alt="Pattern" draggable={false} />
          : <span className="fb-empty">extract a piece · trace the pattern</span>}
      </div>

      <span className="fb-tag">Pattern maker</span>

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); openPattern(id); }} title="Open pattern maker" aria-label="Open pattern maker"><OpenIcon /></button>
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} title={image ? 'Replace image' : 'Upload an image'} aria-label="Upload an image"><UploadIcon /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
