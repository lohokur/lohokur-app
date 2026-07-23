'use client';

import { useState } from 'react';
import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { ActionArrow } from '@/components/ActionArrow';

type Data = {
  image?: string;                     // mirror of the currently shown render (for downstream nodes)
  byInput?: Record<string, string>;   // input node-id → its visualised result (never dropped on switch)
  order?: string[];                   // input node-ids, first = primary (shown + processed)
  preview?: string;                   // which input is focused in the big card (defaults to primary)
  busy?: string;                      // the input node-id currently rendering (only that card is busy)
  note?: string;
};

// Render: dress the identity in the plugged-in design. Full-bleed clean node —
// the render fills the card; plugged-in inputs sit as chips along the bottom.
export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const rf = useReactFlow();
  const conns = useNodeConnections({ id, handleType: 'target' });
  const d = data as Data;
  const byInput = d.byInput ?? {};
  const [dragId, setDragId] = useState<string | null>(null);

  const inputsRaw = conns
    .map((c) => rf.getNode(c.source))
    .filter(Boolean)
    .map((n) => {
      const nd = n!.data as { image?: string; views?: Record<string, string> };
      const thumb = nd.image ?? nd.views?.front;
      return thumb ? { id: n!.id, kind: (n!.type as string) || 'image', thumb } : null;
    })
    .filter((x): x is { id: string; kind: string; thumb: string } => !!x);

  const ids = inputsRaw.map((i) => i.id);
  const saved = (d.order ?? []).filter((x) => ids.includes(x));
  const order = [...saved, ...ids.filter((x) => !saved.includes(x))];
  const inputs = order.map((x) => inputsRaw.find((i) => i.id === x)!).filter(Boolean);
  const primary = inputs[0];

  // the big card shows ONLY an actual render — never the raw input — so nothing
  // renders until you press the Render button.
  const focusedId = (d.preview && ids.includes(d.preview)) ? d.preview : primary?.id;
  const card = focusedId ? byInput[focusedId] : d.image;

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const next = order.filter((x) => x !== dragId);
    next.splice(next.indexOf(targetId), 0, dragId);
    rf.updateNodeData(id, { order: next });
    setDragId(null);
  };

  return (
    <div className={`fbnode render-node${selected ? ' selected' : ''}${!card ? ' empty' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas">
        {card
          ? <img src={card} alt="Rendered" draggable={false} />
          : <span className="fb-empty">{d.note ?? 'plug in a sketch → press render'}</span>}
        {d.busy && <span className="fb-rendering">rendering…</span>}
      </div>

      <span className="fb-tag">Render</span>

      <div className="fb-tools">
        <button
          className="fb-tool nodrag"
          onClick={(e) => { e.stopPropagation(); visualise(id); }}
          disabled={!!d.busy || !inputs.length}
          title={(d.preview && ids.includes(d.preview)) ? 'Re-render this input' : 'Render'}
          aria-label="Render"
        >
          {d.busy ? <span className="sn-spin" /> : <ActionArrow />}
        </button>
      </div>

      {/* plugged-in inputs — hover strip along the bottom. Click to preview; drag to reorder. */}
      {inputs.length > 0 && (
        <div className="fb-inputs nodrag nowheel">
          {inputs.map((inp, i) => (
            <button
              key={inp.id}
              draggable
              className={`fb-in vis-${inp.kind}${d.preview === inp.id ? ' on' : ''}${dragId === inp.id ? ' dragging' : ''}`}
              title={`${inp.kind}${byInput[inp.id] ? ' · rendered' : ''} · click to select (then Render redoes just this) · drag to reorder`}
              onClick={(e) => {
                e.stopPropagation();
                const on = d.preview === inp.id;
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
              {d.busy === inp.id && <span className="vis-spin" />}
            </button>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
