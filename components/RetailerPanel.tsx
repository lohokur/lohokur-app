'use client';

import { useMemo } from 'react';
import {
  matchRetailers, reviewOutcome, statusLabel,
  type CollectionBrief, type ChosenRetailer,
} from '@/lib/retailers';

export default function RetailerPanel({
  open,
  brief,
  chosen,
  onChoose,
  onClose,
}: {
  open: boolean;
  brief: CollectionBrief;
  chosen?: ChosenRetailer;
  onChoose: (r: ChosenRetailer) => void;
  onClose: () => void;
}) {
  const matches = useMemo(() => matchRetailers(brief), [brief]);
  const label = brief.name && brief.name !== 'Untitled garment' ? brief.name : 'this collection';
  const status = chosen?.status ?? 'draft';

  // Advance the submission through its lifecycle (all writes go via onChoose).
  const submit = () => {
    if (!chosen) return;
    onChoose(chosen.curated
      ? { ...chosen, status: 'pending', submittedAt: Date.now() }
      : { ...chosen, status: 'listed', submittedAt: Date.now() });
  };
  const check = () => {
    if (!chosen) return;
    const outcome = reviewOutcome(chosen.id, brief.name || 'untitled');
    onChoose({ ...chosen, status: outcome, decidedAt: Date.now() });
  };

  return (
    <aside className={`mfpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Stock this collection</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="mf-brief">
        <div className="mf-brief-t">Retailers for <b>{label}</b></div>
        <div className="mf-brief-tags">
          {brief.category && <span className="mf-chip">{brief.category}</span>}
          <span className="mf-chip">{brief.pieces} {brief.pieces === 1 ? 'piece' : 'pieces'}</span>
          <span className={`mf-chip${brief.polished ? '' : ' embel'}`}>{brief.polished ? 'submission-ready' : 'not production-ready'}</span>
        </div>
        <p className="mf-brief-note">Curated stockists review before they stock you — submissions sit pending until a buyer decides. Open marketplaces list instantly.</p>
      </div>

      {/* the live submission status for the chosen retailer */}
      {chosen && (
        <div className={`rt-track rt-track-${status}`}>
          <div className="rt-track-top">
            <div>
              <div className="rt-track-name">{chosen.name}</div>
              <div className="rt-track-sub">{chosen.location} · {chosen.curated ? 'curated' : 'open marketplace'}</div>
            </div>
            <span className={`rt-status rt-${status}`}>{statusLabel(status)}</span>
          </div>

          {status === 'draft' && (
            <button className="mf-select on" onClick={submit}>
              {chosen.curated ? 'Submit for review' : 'List collection'}
            </button>
          )}
          {status === 'pending' && (
            <>
              <p className="rt-track-note">Submitted to the buying team. Curated spaces are selective — check back for a decision.</p>
              <button className="mf-select on" onClick={check}>Check review status</button>
            </>
          )}
          {status === 'accepted' && (
            <p className="rt-track-note ok">You’re in. {chosen.name} has accepted the collection — next step is line sheets &amp; a wholesale PO.</p>
          )}
          {status === 'rejected' && (
            <>
              <p className="rt-track-note bad">Not accepted this season. Curated buyers pass on most submissions — refine and resubmit, or try a more reachable stockist.</p>
              <button className="mf-select" onClick={() => onChoose({ ...chosen, status: 'draft', submittedAt: undefined, decidedAt: undefined })}>Resubmit</button>
            </>
          )}
          {status === 'listed' && (
            <p className="rt-track-note ok">Live on {chosen.name}. No gatekeeping here — your collection is listed and shoppable.</p>
          )}
        </div>
      )}

      <div className="mf-list">
        {matches.map((r) => (
          <div className={`mf-card${chosen?.id === r.id ? ' chosen' : ''}`} key={r.id}>
            <div className="mf-card-top">
              <div>
                <div className="mf-name">
                  {r.name}
                  {r.recommended && <span className="mf-rec">recommended</span>}
                  {r.curated ? <span className="rt-badge curated">curated</span> : <span className="rt-badge open">open</span>}
                </div>
                <div className="mf-loc">{r.location} · {r.kind === 'both' ? 'online + physical' : r.kind}</div>
              </div>
            </div>

            <div className="mf-specs">
              {r.aesthetic.map((a) => (
                <span key={a} className={`mf-tag${r.fit.includes(a) ? ' hit' : ''}`}>{a}</span>
              ))}
            </div>

            {r.curated && (
              <div className="rt-odds">
                <span className="rt-odds-k">Acceptance odds</span>
                <span className="rt-odds-v">{Math.round(r.odds * 100)}%</span>
                <span className="rt-odds-bar"><span style={{ width: `${Math.round(r.odds * 100)}%` }} /></span>
              </div>
            )}

            <p className="mf-note">{r.note}</p>

            <button
              className={`mf-select${chosen?.id === r.id ? ' on' : ''}`}
              onClick={() => onChoose({
                id: r.id, name: r.name, location: r.location, kind: r.kind, curated: r.curated,
                status: chosen?.id === r.id ? status : 'draft',
              })}
            >
              {chosen?.id === r.id ? 'Selected' : r.curated ? 'Choose & submit' : 'Choose & list'}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
