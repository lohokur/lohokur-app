'use client';

import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { ActionArrow, RefreshIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import RenderProgress from '@/components/RenderProgress';
import { seedFrom } from '@/lib/node-art';
import { VIEWS, type View } from '@/lib/nodeTypes';

type Data = {
  byView?: Partial<Record<View, string>>; // rendered image per garment view
  view?: View;                            // which view is shown on the card
  busyView?: View;                        // the view currently rendering
  image?: string;                         // mirror of the front render (for downstream nodes)
  note?: string;
};

// Render: dress the identity in the plugged-in design. Mirrors the sketch's views —
// Front always, Side/Back only when a connected input carries that view.
export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise } = useStudio();
  const rf = useReactFlow();
  const conns = useNodeConnections({ id, handleType: 'target' });
  const d = data as Data;
  const byView = d.byView ?? {};
  const view: View = d.view ?? 'front';
  const setView = (v: View) => rf.updateNodeData(id, { view: v });

  // which views the plugged-in inputs can supply (front falls back to the card image)
  const inputs = conns
    .map((c) => rf.getNode(c.source))
    .filter(Boolean)
    .map((n) => {
      const nd = n!.data as { image?: string; views?: Partial<Record<View, string>> };
      return { front: nd.image ?? nd.views?.front, side: nd.views?.side, back: nd.views?.back } as Partial<Record<View, string>>;
    });
  const hasInputs = inputs.length > 0;
  const viewAvailable = (v: View) => inputs.some((i) => i[v]);
  // show a tab if the source has that view, or we already rendered it (front always)
  const tabs = VIEWS.filter((v) => v === 'front' || viewAvailable(v) || byView[v]);

  const card = byView[view];
  const busyHere = d.busyView === view;
  const rendering = !!d.busyView;

  return (
    <div className={`fbnode render-node${selected ? ' selected' : ''}${!card ? ' empty' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      {/* front / back / side — pops up above the card like the sketch node */}
      {tabs.length > 1 && (
        <div className="sk-views rn-views">
          {tabs.map((v) => (
            <button
              key={v}
              className={`sk-view${byView[v] ? ' has' : ''}${view === v ? ' on' : ''}${d.busyView === v ? ' busy' : ''}`}
              onClick={(e) => { e.stopPropagation(); setView(v); }}
              title={byView[v] ? `${v} render` : viewAvailable(v) ? `render the ${v}` : `no ${v} to render`}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      )}

      <div className="fb-canvas">
        {busyHere ? (
          <>
            <NodeArt seed={seedFrom(id)} animate />
            <RenderProgress />
            <div className="fb-blank"><span className="fb-hint">modelling {view}…</span></div>
          </>
        ) : card ? (
          <img src={card} alt={`Model ${view}`} draggable={false} />
        ) : (
          <>
            <NodeArt seed={seedFrom(id)} />
            <div className="fb-blank">
              <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.6" /><path d="M3 16.5l5-4.5 4 3.5 3-2.5 6 5" /></svg>
              <span className="fb-hint">{d.note ?? (viewAvailable(view) ? `model the ${view}` : 'plug in a sketch → place on a model')}</span>
            </div>
          </>
        )}
      </div>

      <span className="fb-tag">Model</span>

      <div className="fb-tools">
        <button
          className="fb-tool nodrag"
          onClick={(e) => { e.stopPropagation(); card ? visualise(id, view) : visualise(id); }}
          disabled={rendering || !hasInputs}
          title={card ? 'Re-model this view' : 'Place on model'}
          aria-label={card ? 'Re-model this view' : 'Place on model'}
        >
          {rendering ? <span className="sn-spin" /> : card ? <RefreshIcon /> : <ActionArrow />}
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
