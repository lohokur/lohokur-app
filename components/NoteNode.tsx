'use client';

import { useEffect, useRef, useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

// Sticky note. The WHOLE note is draggable (React Flow suppresses the click that
// would normally focus a textarea, so we can't type while it's drag-armed). A
// single click flips it into edit mode and focuses the text; blur leaves edit
// mode so it's draggable again. No pipeline handles.
export default function NoteNode({ id, data, selected }: NodeProps) {
  const { setNoteText } = useStudio();
  const d = data as { text?: string };
  const [text, setText] = useState(d.text ?? '');
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      const el = ref.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  }, [editing]);

  return (
    <div
      className={`note-node${selected ? ' selected' : ''}${editing ? ' editing' : ''}`}
      onClick={() => { if (!editing) setEditing(true); }}
    >
      <textarea
        ref={ref}
        className={`note-ta${editing ? ' nodrag nowheel' : ''}`}
        value={text}
        readOnly={!editing}
        onChange={(e) => { setText(e.target.value); setNoteText(id, e.target.value); }}
        onBlur={() => setEditing(false)}
        placeholder="click to write a note…"
        spellCheck={false}
      />
    </div>
  );
}
