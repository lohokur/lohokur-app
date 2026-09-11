'use client';

import { Handle, Position, useReactFlow, useNodeConnections, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { ActionArrow, RefreshIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import RenderProgress from '@/components/RenderProgress';
import LockedView from '@/components/LockedView';
import { seedFrom } from '@/lib/node-art';
import { VIEWS, type View } from '@/lib/nodeTypes';
import { IDENTITIES } from '@/lib/identities';

type Data = {
  byView?: Partial<Record<View, string>>; // rendered image per garment view
  view?: View;                            // which view is shown on the card
  busyView?: View;                        // the view currently rendering
  image?: string;                         // mirror of the front render (for downstream nodes)
  model?: string;                         // chosen identity to dress (id, e.g. LK-018)
  note?: string;
};

// Render: dress the identity in the plugged-in design. Mirrors the sketch's views —
// Front always, Side/Back only when a connected input carries that view.
export default function VisualiseNode({ id, data, selected }: NodeProps) {
  const { visualise, sideLocked } = useStudio();
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
  const tabs = VIEWS.filter((v) => v === 'front' || viewAvailable(v) || byView[v] || sideLocked);

  const card = byView[view];
  const locked = view !== 'front' && sideLocked && !card && !!byView.front; // paid side/back
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
        ) : locked ? (
          <LockedView src={byView.front} label={`${view} view`} />
        ) : (
          <>
            <NodeArt seed={seedFrom(id)} />
            <div className="fb-blank">
              <svg className="fb-ic fb-ic-solid" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="4" r="2.6" />
                <rect x="9.4" y="7.2" width="5.2" height="8" rx="2.6" />
                <rect x="6.9" y="8.2" width="1.6" height="5.6" rx="0.8" />
                <rect x="15.5" y="8.2" width="1.6" height="5.6" rx="0.8" />
                <rect x="9.8" y="14.6" width="1.9" height="6.4" rx="0.95" />
                <rect x="12.3" y="14.6" width="1.9" height="6.4" rx="0.95" />
              </svg>
              {d.note ? (
                <span className="fb-hint">{d.note}</span>
              ) : (
                <strong className="node-empty-title">Place product on a model.</strong>
              )}
            </div>
            {/* examples of what a dressed model looks like — illustrative, not a picker */}
            <div className="vn-examples nodrag" aria-hidden="true">
              <span className="vn-examples-cap">Dress it as anything</span>
              <span className="vn-examples-row">
                {IDENTITIES.slice(0, 6).map((m) => (
                  <span className="vn-example" key={m.id}><img src={m.image} alt="" loading="lazy" /></span>
                ))}
              </span>
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
