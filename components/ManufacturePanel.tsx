'use client';

import { useMemo } from 'react';
import type { Techpack } from '@/lib/techpack';
import { briefFromTechpack, recommendFor, complexity, type ChosenManufacturer } from '@/lib/manufacturers';

export default function ManufacturePanel({
  open,
  techpack,
  chosenId,
  onChoose,
  onClose,
}: {
  open: boolean;
  techpack?: Partial<Techpack>;
  chosenId?: string;
  onChoose: (m: ChosenManufacturer) => void;
  onClose: () => void;
}) {
  const brief = useMemo(() => briefFromTechpack(techpack), [techpack]);
  const quotes = useMemo(() => recommendFor(brief), [brief]);
  const c = complexity(brief);

  const usd = (n: number) => '$' + n.toLocaleString('en-US');
  const label = brief.name && brief.name !== 'Untitled garment' ? brief.name : 'this garment';

  return (
    <aside className={`mfpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Manufacturers</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="mf-brief">
        <div className="mf-brief-t">Recommended for <b>{label}</b></div>
        <div className="mf-brief-tags">
          {brief.category && <span className="mf-chip">{brief.category}</span>}
          <span className="mf-chip">{brief.materials} materials</span>
          {brief.embellished && <span className="mf-chip embel">embellished</span>}
          <span className="mf-chip">complexity ×{c.toFixed(2)}</span>
        </div>
        <p className="mf-brief-note">Costs are estimates scaled to this garment’s spec. Connect a fuller tech pack for a tighter quote.</p>
      </div>

      <div className="mf-list">
        {quotes.map((q) => (
          <div className={`mf-card${chosenId === q.id ? ' chosen' : ''}`} key={q.id}>
            <div className="mf-card-top">
              <div>
                <div className="mf-name">{q.name}{q.recommended && <span className="mf-rec">recommended</span>}</div>
                <div className="mf-loc">{q.location} · ★ {q.rating.toFixed(1)} · {q.leadDays}-day lead</div>
              </div>
            </div>

            <div className="mf-specs">
              {q.specialties.map((s) => (
                <span key={s} className={`mf-tag${q.fit.some((fx) => s.toLowerCase().includes(fx) || fx.includes(s.toLowerCase())) ? ' hit' : ''}`}>{s}</span>
              ))}
            </div>

            <div className="mf-costs">
              <div className="mf-cost">
                <span className="mf-cost-k">Sampling</span>
                <span className="mf-cost-v">{usd(q.sampleCost)}</span>
                <span className="mf-cost-s">per sample</span>
              </div>
              <div className="mf-cost">
                <span className="mf-cost-k">Bulk</span>
                <span className="mf-cost-v">{usd(q.unitCost)}<em>/unit</em></span>
                <span className="mf-cost-s">MOQ {q.moq} · {usd(q.bulkTotal)} total</span>
              </div>
            </div>

            <p className="mf-note">{q.note}</p>

            <button
              className={`mf-select${chosenId === q.id ? ' on' : ''}`}
              onClick={() => onChoose({
                id: q.id, name: q.name, location: q.location,
                sampleCost: q.sampleCost, unitCost: q.unitCost, moq: q.moq, leadDays: q.leadDays,
              })}
            >
              {chosenId === q.id ? '✓ Selected' : 'Select manufacturer'}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
