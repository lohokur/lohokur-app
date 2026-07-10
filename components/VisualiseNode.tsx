'use client';

import { useState } from 'react';
import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import type { VisResult } from '@/lib/nodeTypes';

type Data = {
  image?: string;
  results?: VisResult[];
  active?: number;
  order?: string[];   // input node-ids, first = primary (shown + processed)
  preview?: string;   // input node-id currently previewed in the main card
  loading?: boolean;
  note?: string;
};

export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const rf = useReactFlow();
  const conns = useNodeConnections({ id, handleType: 'target' });
  const d = data as Data;
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

  const results = d.results ?? [];
  const active = results.length ? Math.min(d.active ?? results.length - 1, results.length - 1) : -1;

  // what shows in the big card: previewed input → active result → primary input
  const previewInput = d.preview ? inputs.find((i) => i.id === d.preview) : undefined;
  const card = previewInput?.thumb ?? results[active]?.image ?? d.image ?? primary?.thumb;

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((x) => x !== dragId);
    const at = next.indexOf(targetId);
    next.splice(at, 0, dragId);
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
          {d.loading ? '…' : results.length ? 'visualise' : 'run'}
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

      {/* generated cards — click one to make it active in the big card */}
      {results.length > 1 && (
        <div className="vis-results nodrag nowheel">
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`vis-card${i === active && !previewInput ? ' on' : ''}`}
              title={`render ${i + 1}`}
              onClick={(e) => { e.stopPropagation(); rf.updateNodeData(id, { active: i, image: r.image, preview: undefined }); }}
            >
              <img src={r.image} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {/* plugged-in inputs as cards — drag to reorder (first = primary/processed);
          click to preview it in the big card above */}
      {inputs.length > 0 && (
        <div className="vis-inputs nodrag nowheel">
          {inputs.map((inp, i) => (
            <button
              key={inp.id}
              draggable
              className={`vis-in-card vis-${inp.kind}${i === 0 ? ' primary' : ''}${previewInput?.id === inp.id ? ' preview' : ''}${dragId === inp.id ? ' dragging' : ''}`}
              title={`${inp.kind}${i === 0 ? ' — primary (processed on Run)' : ''} · drag to reorder, click to preview`}
              onClick={(e) => { e.stopPropagation(); rf.updateNodeData(id, { preview: previewInput?.id === inp.id ? undefined : inp.id }); }}
              onDragStart={() => setDragId(inp.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); reorder(inp.id); }}
              onDragEnd={() => setDragId(null)}
            >
              <img src={inp.thumb} alt="" draggable={false} />
              {i === 0 && <span className="vis-primary-dot" />}
            </button>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
