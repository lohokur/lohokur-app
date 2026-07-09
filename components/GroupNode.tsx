'use client';

import { useState } from 'react';
import { type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

// A frame that holds a set of nodes so they move together. The body is
// click-through (children sit on top and stay interactive); drag the header
// bar to move the whole group. Double-click the label to rename it.
export default function GroupNode({ id, data, selected }: NodeProps) {
  const { renameGroup } = useStudio();
  const d = data as { label?: string };
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(d.label ?? 'Group');

  return (
    <div className={`group-node${selected ? ' selected' : ''}`}>
      <div className="group-bar">
        {editing ? (
          <input
            className="group-label-input nodrag"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => { setEditing(false); renameGroup(id, text.trim() || 'Group'); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
        ) : (
          <span className="group-label" onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            {d.label ?? 'Group'}
          </span>
        )}
      </div>
    </div>
  );
}
