'use client';

import { useRef, useState } from 'react';
import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { ActionArrow, UploadIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';

// Worldbuild: plug in a render (or upload/drop an image), prompt it into anything —
// billboards, editorial shoots, campaign scenes. It works with whatever's connected
// into it, and you can also give it an image directly. Full-bleed clean node.
export default function StudioNode({ id, data, selected }: NodeProps) {
  const { promptImage, setNodeImage } = useStudio();
  const rf = useReactFlow();
  const conns = useNodeConnections({ id, handleType: 'target' });
  const d = data as { image?: string; loading?: boolean; note?: string; prompt?: string };
  const [text, setText] = useState(d.prompt ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  // does an upstream node actually carry an image to work with?
  const hasInput = conns.some((c) => {
    const nd = rf.getNode(c.source)?.data as { image?: string; views?: Record<string, string> } | undefined;
    return !!(nd?.image ?? nd?.views?.front);
  }) || !!d.image;

  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };
  const load = (f?: File | null) => {
    if (!f || !/^image\//.test(f.type)) return;
    const fr = new FileReader();
    fr.onload = () => setNodeImage(id, fr.result as string);
    fr.readAsDataURL(f);
  };
  const empty = !d.image && !d.loading;

  return (
    <div
      className={`fbnode worldbuild-node${selected ? ' selected' : ''}${empty ? ' empty' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files?.[0]); }}
    >
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas">
        {d.loading ? (
          <>
            <NodeArt seed={seedFrom(id)} animate />
            <div className="fb-blank"><span className="fb-hint">{d.note ?? 'branding…'}</span></div>
          </>
        ) : d.image ? (
          <img src={d.image} alt="" draggable={false} />
        ) : (
          <>
            <NodeArt seed={seedFrom(id)} />
            <div className="fb-blank">
              <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.6" /><path d="M21 15l-5-5L5 21" /></svg>
              {d.note ? <span className="fb-hint">{d.note}</span> : <strong className="node-empty-title">Connect anything and render it.</strong>}
            </div>
          </>
        )}
      </div>

      <span className="fb-tag">Image</span>

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} title={d.image ? 'Replace image' : 'Upload an image'} aria-label="Upload an image"><UploadIcon /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </div>

      <div className="fb-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={hasInput ? 'on a billboard at night; editorial cover; worn on a city street…' : 'connect a render or upload an image first…'}
          rows={1}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className="fb-send" disabled={d.loading || !text.trim()} onClick={submit} title="Generate" aria-label="Generate">
          {d.loading ? <span className="sn-spin" /> : <ActionArrow />}
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
