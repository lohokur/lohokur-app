'use client';

import { useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

// A sticky note on the canvas — free-form text, no pipeline handles. Resizable
// via the corner grip (CSS resize on the textarea). Persists into the flow.
export default function NoteNode({ id, data, selected }: NodeProps) {
  const { setNoteText } = useStudio();
  const d = data as { text?: string };
  const [text, setText] = useState(d.text ?? '');

  return (
    <div className={`note-node${selected ? ' selected' : ''}`}>
      <textarea
        className="note-ta nodrag nowheel"
        value={text}
        onChange={(e) => { setText(e.target.value); setNoteText(id, e.target.value); }}
        placeholder="write a note…"
        spellCheck={false}
      />
    </div>
  );
}
