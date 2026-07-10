'use client';

import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import type { VisResult } from '@/lib/nodeTypes';

type Data = {
  image?: string;
  results?: VisResult[];
  active?: number;
  sel?: string[]; // selected input node-ids (undefined = all connected)
  loading?: boolean;
  note?: string;
};

export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const rf = useReactFlow();
  const conns = useNodeConnections({ id, handleType: 'target' });
  const d = data as Data;

  const results = d.results ?? [];
  const active = results.length ? Math.min(d.active ?? results.length - 1, results.length - 1) : -1;
  const card = results[active]?.image ?? d.image;

  // every connected input that has a thumbnail (image node or sketch node)
  const inputs = conns
    .map((c) => rf.getNode(c.source))
    .filter(Boolean)
    .map((n) => {
      const nd = n!.data as { image?: string; views?: Record<string, string> };
      const thumb = nd.image ?? nd.views?.front;
      return thumb ? { id: n!.id, kind: (n!.type as string) || 'image', thumb } : null;
    })
    .filter((x): x is { id: string; kind: string; thumb: string } => !!x);

  const sel = d.sel ?? inputs.map((i) => i.id); // default: all selected
  const isSel = (iid: string) => sel.includes(iid);
  const toggle = (iid: string) => {
    const next = isSel(iid) ? sel.filter((x) => x !== iid) : [...sel, iid];
    rf.updateNodeData(id, { sel: next });
  };
  const selCount = inputs.filter((i) => isSel(i.id)).length;

  return (
    <div className={`stage-node visualise-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />
      <div className="sn-head">
        <span>Visualise</span>
        <button
          className="sn-edit nodrag"
          onClick={(e) => { e.stopPropagation(); visualise(id); }}
          disabled={d.loading || !inputs.length || !selCount}
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

      {/* gallery of generated cards — click a card to make it active */}
      {results.length > 1 && (
        <div className="vis-results nodrag nowheel">
          {results.map((r, i) => (
            <button
              key={r.id}
              className={`vis-card${i === active ? ' on' : ''}`}
              title={`render ${i + 1}`}
              onClick={(e) => { e.stopPropagation(); rf.updateNodeData(id, { active: i, image: r.image }); }}
            >
              <img src={r.image} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {/* plugged-in inputs — tap to include/exclude from the next render */}
      {inputs.length > 0 && (
        <div className="vis-inputs nodrag nowheel">
          {inputs.map((inp) => (
            <button
              key={inp.id}
              className={`vis-thumb vis-${inp.kind}${isSel(inp.id) ? ' on' : ''}`}
              title={`${inp.kind}${isSel(inp.id) ? ' — in this render' : ' — tap to include'}`}
              onClick={(e) => { e.stopPropagation(); toggle(inp.id); }}
            >
              <img src={inp.thumb} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
