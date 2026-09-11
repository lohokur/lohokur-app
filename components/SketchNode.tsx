'use client';

import { useRef, useState } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon, ActionArrow, UploadIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';
import { VIEWS, type View } from '@/lib/nodeTypes';
import LockedView from '@/components/LockedView';

// The whole node IS the sketch canvas. On hover: the prompt bar floats over the
// bottom, the draw/upload tools appear top-right, and the front/side/back views
// pop up top-centre. (Absorbs the old Image node — draw · upload · prompt.)
export default function SketchNode({ id, data, selected }: NodeProps) {
  const { openSketch, promptImage, setNodeImage, sideLocked } = useStudio();
  const rf = useReactFlow();
  const d = data as { image?: string; views?: Partial<Record<View, string>>; loading?: boolean; note?: string; prompt?: string; coachGenerate?: boolean; viewsBusy?: boolean; view?: View };
  const views = d.views ?? {};
  // data.image is the primary/front image — drawing the front, uploading, and
  // prompting all write to it, so it's the source of truth the front view shows.
  const front = d.image ?? views.front;
  const viewImg = (v: View): string | undefined => (v === 'front' ? front : views[v]);

  // the shown view lives in node data so the pad's F/S/B stays in sync with the card
  const view: View = d.view ?? 'front';
  const setView = (v: View) => rf.updateNodeData(id, { view: v });
  const shown = viewImg(view); // the node card shows exactly the selected view (F/S/B)
  const locked = view !== 'front' && sideLocked && !shown && !!front; // paid side/back
  const [text, setText] = useState(d.prompt ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => { if (text.trim() && !d.loading) promptImage(id, text.trim()); };
  const coach = !!d.coachGenerate && !front && !d.loading && !!text.trim();
  const empty = !front && !d.loading;

  const loadFile = (f?: File | null) => {
    if (!f || !/^image\//.test(f.type)) return;
    const r = new FileReader();
    r.onload = () => setNodeImage(id, r.result as string);
    r.readAsDataURL(f);
  };

  return (
    <div
      className={`sketch-node${selected ? ' selected' : ''}${empty ? ' empty' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files?.[0]); }}
    >
      <Handle type="target" position={Position.Left} className="sn-handle" />

      {/* the canvas fills the whole node — shows the selected view. single click opens the pad */}
      <div className="sk-canvas" onClick={() => openSketch(id, view)}>
        {d.loading ? (
          <>
            <NodeArt seed={seedFrom(id)} animate />
            <div className="fb-blank"><span className="fb-hint">{d.note ?? 'generating…'}</span></div>
          </>
        ) : shown ? (
          <img src={shown} alt={`Sketch ${view}`} draggable={false} />
        ) : locked ? (
          <LockedView src={front} label={`${view} view`} />
        ) : (
          <>
            <NodeArt seed={seedFrom(id)} />
            <div className="fb-blank">
              <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l3.6-.9L18.1 8.6a1.8 1.8 0 0 0 0-2.6l-1.1-1.1a1.8 1.8 0 0 0-2.6 0L3.9 15.4 3 19z" /></svg>
              {view === 'front'
                ? <strong className="node-empty-title">Draw, upload, or prompt a design.</strong>
                : <span className="fb-hint">{`draw the ${view} view`}</span>}
            </div>
          </>
        )}
      </div>

      {/* front / side / back — pops up on hover. Selecting one reflects it in the
          card; an empty view also opens the pad to draw it. */}
      <div className="sk-views">
        {VIEWS.map((v) => (
          <button
            key={v}
            className={`sk-view${viewImg(v) ? ' has' : ''}${view === v ? ' on' : ''}${d.viewsBusy && !viewImg(v) && v !== 'front' ? ' busy' : ''}`}
            onClick={(e) => { e.stopPropagation(); setView(v); if (!viewImg(v) && !(sideLocked && v !== 'front')) openSketch(id, v); }}
            title={viewImg(v) ? `${v[0].toUpperCase()}${v.slice(1)} view` : (d.viewsBusy && v !== 'front' ? `Generating ${v} view…` : `Draw the ${v} view`)}
          >
            {v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {/* draw / upload tools — appear on hover */}
      <div className="sk-tools">
        <button className="sk-tool nodrag" onClick={(e) => { e.stopPropagation(); openSketch(id, view); }} title={shown ? 'Edit drawing' : 'Draw'} aria-label={shown ? 'Edit drawing' : 'Draw'}><OpenIcon /></button>
        <button className="sk-tool nodrag" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }} title="Upload an image" aria-label="Upload an image"><UploadIcon /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { loadFile(e.target.files?.[0]); e.currentTarget.value = ''; }} />
      </div>

      {/* prompt bar — floats over the bottom of the canvas */}
      <div className="sk-prompt nodrag nowheel">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an image…"
          rows={1}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        />
        <button className={`sk-send${coach ? ' coach' : ''}${d.loading ? ' busy' : ''}`} disabled={d.loading || !text.trim()} onClick={submit} title="Generate" aria-label="Generate">
          {d.loading ? <span className="sn-spin" /> : <ActionArrow />}
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
