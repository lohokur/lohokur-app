'use client';

import { useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

// Image node: upload a file, paste, or type a prompt to generate an image.
export default function ImageNode({ id, data, selected }: NodeProps) {
  const { promptImage, setNodeImage } = useStudio();
  const d = data as { image?: string; loading?: boolean; note?: string; prompt?: string; coachGenerate?: boolean };
  const [text, setText] = useState(d.prompt ?? '');
  const fileRef = useRef<HTMLInputElement>(null);
  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };
  // nudge the very first render: a pre-filled example is one click away
  const coach = !!d.coachGenerate && !d.image && !d.loading && !!text.trim();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setNodeImage(id, r.result as string);
    r.readAsDataURL(f);
    e.target.value = '';
  };

  return (
    <div className={`stage-node image-node${selected ? ' selected' : ''}`}>
      <div className="sn-head">
        <span>Image</span>
        <button className="sn-edit nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>upload</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      </div>
      <div className="sn-draw">
        {d.loading ? (
          <span className="sn-empty pulse">{d.note ?? 'generating…'}</span>
        ) : d.image ? (
          <img src={d.image} alt="" draggable={false} />
        ) : (
          <span className="sn-empty">{d.note ?? 'upload · paste · or prompt below'}</span>
        )}
      </div>
      <div className="sn-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an image to generate…"
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className={`sn-go${coach ? ' coach' : ''}`} disabled={d.loading || !text.trim()} onClick={submit}>{d.loading ? '…' : 'Generate'}</button>
      </div>
      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
