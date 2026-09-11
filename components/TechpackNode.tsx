'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';
import type { Techpack } from '@/lib/techpack';

export default function TechpackNode({ id, data, selected }: NodeProps) {
  const { openTechpack, shareTechpack } = useStudio();
  const d = data as { techpack?: Techpack; techpackGenerating?: boolean; sharing?: boolean; shareCopied?: boolean; shareError?: string };
  const tp = d.techpack;
  const generating = d.techpackGenerating;
  const flat = tp?.flats?.front; // the connected item's technical flat
  const shareLabel = d.sharing ? 'Publishing…' : d.shareError ? 'Retry share' : d.shareCopied ? 'Link copied' : 'Share with manufacturer';

  return (
    <div className={`fbnode techpack-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      {/* floats above the node on hover — like the sketch node's view pills */}
      {tp && (
        <div className={`tp-share-float${d.shareCopied ? ' done' : ''}`}>
          <button className="tp-share-btn nodrag" onClick={(e) => { e.stopPropagation(); shareTechpack(id); }} disabled={d.sharing} title="Publish a public link to send your manufacturer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-4.2M8.6 13.4l6.8 4.2" />
            </svg>
            {shareLabel}
          </button>
        </div>
      )}

      <div className="fb-canvas fb-info" onDoubleClick={() => openTechpack(id)}>
        {generating ? (
          <>
            <NodeArt seed={seedFrom(id)} animate />
            <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h9l5 5v15H6z" /><path d="M15 2v6h6" /><path d="M9.5 13h6M9.5 17h6" /></svg>
            <span className="fb-hint">drafting tech pack…</span>
          </>
        ) : tp ? (
          <div className="tp-sheet">
            <div className="tp-sheet-head">
              <span className="tp-sheet-brand">{tp.brand || 'LOHO KUR'}</span>
              <span className="tp-sheet-ver">Tech pack</span>
            </div>
            <div className="tp-top">
              <div className="tp-thumb">
                {flat ? <img src={flat} alt="" draggable={false} /> : <span className="tp-thumb-x">flat</span>}
              </div>
              <div className="tp-topinfo">
                <strong className="tp-topname">{tp.name || 'Untitled garment'}</strong>
                <span className="tp-topsub">{tp.category || 'garment'}</span>
              </div>
            </div>
            <div className="tp-specs">
              {tp.fabric && <div className="tp-spec"><span className="tp-spec-k">Fabric</span><span className="tp-spec-v">{tp.fabric}</span></div>}
              {(tp.season || tp.version) && <div className="tp-spec"><span className="tp-spec-k">Season</span><span className="tp-spec-v">{[tp.season, tp.version].filter(Boolean).join(' · ')}</span></div>}
              <div className="tp-spec"><span className="tp-spec-k">Sizes</span><span className="tp-spec-v">{tp.sizeRange || tp.sizes?.join(' ') || '—'}</span></div>
              <div className="tp-spec"><span className="tp-spec-k">POM</span><span className="tp-spec-v">{tp.poms?.length ?? 0}</span></div>
              <div className="tp-spec"><span className="tp-spec-k">Materials</span><span className="tp-spec-v">{tp.materials?.length ?? 0}</span></div>
              {!!tp.colorways?.length && (
                <div className="tp-spec"><span className="tp-spec-k">Colourways</span>
                  <span className="tp-cw">{tp.colorways.slice(0, 6).map((c) => <i key={c.id} style={{ background: c.hex }} />)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <NodeArt seed={seedFrom(id)} />
            <div className="tp-empty">
              <svg className="tp-empty-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" /><path d="M9 13h6M9 17h4" />
              </svg>
              <strong className="tp-empty-title">Plug in a design and the tech pack builds itself.</strong>
            </div>
          </>
        )}
      </div>

      {!tp && <span className="fb-tag">Techpack</span>}

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); openTechpack(id); }} title={tp ? 'Edit tech pack' : 'Open tech pack'} aria-label="Open tech pack"><OpenIcon /></button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
