'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

// A faded "what comes next" suggestion that appears already wired into the node
// you just spawned. Clicking it adds that stage for real; the × dismisses it.
// Purely a hint — it's never saved and doesn't participate in the graph.
export default function GhostNode({ data }: NodeProps) {
  const d = data as { label: string; hint?: string; share?: boolean; done?: boolean; onAdd: () => void; onDismiss: () => void };
  return (
    <div
      className={`ghost-node nodrag nopan${d.share ? ' ghost-share' : ''}${d.done ? ' done' : ''}`}
      // stop React Flow from handling the pointerdown (which would deselect the
      // source node and unmount this ghost before the click's onAdd can fire)
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); d.onAdd(); }}
      title={d.share ? 'Share this tech pack' : `Add ${d.label}`}
    >
      <Handle type="target" position={Position.Left} className="sn-handle ghost-handle" isConnectable={false} />
      <button className="ghost-x" onClick={(e) => { e.stopPropagation(); d.onDismiss(); }} aria-label="Dismiss suggestion">×</button>
      {d.share ? (
        <svg className="ghost-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2" />
        </svg>
      ) : (
        <div className="ghost-plus">+</div>
      )}
      <div className="ghost-label">{d.label}</div>
      <div className="ghost-hint">{d.hint ?? 'suggested next · click to add'}</div>
      <Handle type="source" position={Position.Right} className="sn-handle ghost-handle" isConnectable={false} />
    </div>
  );
}
