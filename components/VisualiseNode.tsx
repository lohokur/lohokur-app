'use client';

import { useState } from 'react';
import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';

type Data = {
  image?: string;                     // mirror of the currently shown render (for downstream nodes)
  byInput?: Record<string, string>;   // input node-id → its visualised result (never dropped on switch)
  order?: string[];                   // input node-ids, first = primary (shown + processed)
  preview?: string;                   // which input is focused in the big card (defaults to primary)
  loading?: boolean;
  note?: string;
};

export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const rf = useReactFlow();
  const conns = useNodeConnections({ id, handleType: 'target' });
  const d = data as Data;
  const byInput = d.byInput ?? {};
  const [dragId, setDragId] = useState<string | null>(null);

  // connected inputs that have a thumbnail (image or sketch nodes)
  const inputsRaw = conns
    .map((c) => rf.getNode(c.source))
    .filter(Boolean)
    .map((n) => {
      const nd = n!.data as { image?: string; views?: Record<string, string> };
      const thumb = nd.image ?? nd.views?.front;
      return thumb ? { id: n!.id, kind: (n!.type as string) || 'image', thumb } : null;
    })
    .filter((x): x is { id: string; kind: string; thumb: string } => !!x);

  // apply the saved order (new inputs append to the end)
  const ids = inputsRaw.map((i) => i.id);
  const saved = (d.order ?? []).filter((x) => ids.includes(x));
  const order = [...saved, ...ids.filter((x) => !saved.includes(x))];
  const inputs = order.map((x) => inputsRaw.find((i) => i.id === x)!).filter(Boolean);
  const primary = inputs[0];

  // the focused input = the one being previewed, else the primary. The big card shows
  // that input's saved render if it has one, else its raw thumbnail.
  const focusedId = (d.preview && ids.includes(d.preview)) ? d.preview : primary?.id;
  const focused = inputs.find((i) => i.id === focusedId);
  const card = focusedId ? (byInput[focusedId] ?? focused?.thumb) : d.image;

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((x) => x !== dragId);
    next.splice(next.indexOf(targetId), 0, dragId);
    rf.updateNodeData(id, { order: next });
    setDragId(null);
  };

  return (
    <div className={`stage-node visualise-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Visualise</span>
        <button
          className="sn-edit nodrag"
          onClick={(e) => { e.stopPropagation(); visualise(id); }}
          disabled={d.loading || !inputs.length}
        >
          {d.loading ? '…' : (d.preview && ids.includes(d.preview)) ? 'redo' : Object.keys(byInput).length ? 'visualise' : 'run'}
        </button>
      </div>

      <div className="sn-draw">
        {d.loading ? (
          <span className="sn-empty pulse">{d.note ?? 'rendering…'}</span>
        ) : card ? (
          <img src={card} alt="Visualised" draggable={false} />
        ) : (
          <span className="sn-empty">{d.note ?? 'plug in a sketch + image → run'}</span>
        )}
      </div>

      {/* plugged-in inputs as cards — drag to reorder (first = primary/processed);
          click to preview it in the big card. Each keeps its own visualised result. */}
      {inputs.length > 0 && (
        <div className="vis-inputs nodrag nowheel">
          {inputs.map((inp, i) => (
            <button
              key={inp.id}
              draggable
              className={`vis-in-card vis-${inp.kind}${i === 0 ? ' primary' : ''}${d.preview === inp.id ? ' focus' : ''}${dragId === inp.id ? ' dragging' : ''}`}
              title={`${inp.kind}${byInput[inp.id] ? ' · visualised' : ''} · click to select (then Visualise redoes just this) · drag to reorder`}
              onClick={(e) => {
                e.stopPropagation();
                const on = d.preview === inp.id;                  // toggle selection
                rf.updateNodeData(id, { preview: on ? undefined : inp.id, image: on ? d.image : (byInput[inp.id] ?? d.image) });
              }}
              onDragStart={() => setDragId(inp.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); reorder(inp.id); }}
              onDragEnd={() => setDragId(null)}
            >
              <img src={byInput[inp.id] ?? inp.thumb} alt="" draggable={false} />
              {i === 0 && <span className="vis-primary-dot" />}
              {byInput[inp.id] && <span className="vis-done-dot" />}
            </button>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
