'use client';

import { useMemo } from 'react';
import type { Techpack } from '@/lib/techpack';
import { briefFromTechpack, samplersFor } from '@/lib/manufacturers';
import { type Sample, type Address, SAMPLE_STATUSES, defaultSample } from '@/lib/sample';

export default function SamplePanel({
  open,
  techpack,
  value,
  hasShipNode,
  onChange,
  onClose,
}: {
  open: boolean;
  techpack?: Partial<Techpack>;
  value?: Sample;
  hasShipNode?: boolean;
  onChange: (s: Sample) => void;
  onClose: () => void;
}) {
  const sample = value ?? defaultSample();
  const brief = useMemo(() => briefFromTechpack(techpack), [techpack]);
  const samplers = useMemo(() => samplersFor(brief), [brief]);

  const usd = (n: number) => '$' + n.toLocaleString('en-US');
  const label = brief.name && brief.name !== 'Untitled garment' ? brief.name : 'this garment';

  const set = (patch: Partial<Sample>) => onChange({ ...sample, ...patch });
  const setAddr = (patch: Partial<Address>) => onChange({ ...sample, address: { ...sample.address, ...patch } });

  const choose = (q: (typeof samplers)[number]) =>
    set({
      samplerId: q.id, samplerName: q.name, samplerLocation: q.location,
      sampleCost: q.sampleCost, leadDays: q.leadDays,
      status: sample.status === 'draft' ? 'draft' : sample.status,
    });

  const request = () => set({ status: 'requested' });

  return (
    <aside className={`mfpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Create Sample</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="mf-brief">
        <div className="mf-brief-t">One sample of <b>{label}</b></div>
        <p className="mf-brief-note">A single proof unit — separate from any bulk order. Approve it before you commit to production.</p>
      </div>

      <div className="mf-list">
        {/* sampler */}
        <div className="smpl-sec-h">Sampler</div>
        {samplers.map((q) => (
          <div className={`mf-card${sample.samplerId === q.id ? ' chosen' : ''}`} key={q.id}>
            <div className="mf-name">{q.name}{q.recommended && <span className="mf-rec">fast</span>}</div>
            <div className="mf-loc">{q.location} · {q.rating.toFixed(1)}/5 · {q.leadDays}-day sample lead</div>
            <div className="smpl-cost-row">
              <div className="smpl-cost"><span className="mf-cost-k">Sample</span><span className="mf-cost-v">{usd(q.sampleCost)}</span></div>
              <button
                className={`mf-select${sample.samplerId === q.id ? ' on' : ''}`}
                onClick={() => choose(q)}
              >
                {sample.samplerId === q.id ? 'Selected' : 'Use this sampler'}
              </button>
            </div>
          </div>
        ))}

        {/* quantity */}
        <div className="smpl-sec-h">Quantity</div>
        <div className="smpl-qty">
          <button onClick={() => set({ qty: Math.max(1, sample.qty - 1) })} aria-label="less">−</button>
          <span>{sample.qty}</span>
          <button onClick={() => set({ qty: Math.min(10, sample.qty + 1) })} aria-label="more">+</button>
          <em>sample{sample.qty > 1 ? 's' : ''}</em>
        </div>

        {/* ship-to */}
        <div className="smpl-sec-h">Ship sample to</div>
        {hasShipNode && <p className="smpl-hint">A Ship node is connected — it can handle delivery instead. This address is optional.</p>}
        <div className="smpl-addr">
          <input className="tp-in" placeholder="Full name" value={sample.address.name} onChange={(e) => setAddr({ name: e.target.value })} />
          <input className="tp-in" placeholder="Address line 1" value={sample.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} />
          <input className="tp-in" placeholder="Address line 2 (optional)" value={sample.address.line2} onChange={(e) => setAddr({ line2: e.target.value })} />
          <div className="smpl-addr-row">
            <input className="tp-in" placeholder="City" value={sample.address.city} onChange={(e) => setAddr({ city: e.target.value })} />
            <input className="tp-in" placeholder="Region / State" value={sample.address.region} onChange={(e) => setAddr({ region: e.target.value })} />
          </div>
          <div className="smpl-addr-row">
            <input className="tp-in" placeholder="Postcode" value={sample.address.postcode} onChange={(e) => setAddr({ postcode: e.target.value })} />
            <input className="tp-in" placeholder="Country" value={sample.address.country} onChange={(e) => setAddr({ country: e.target.value })} />
          </div>
        </div>

        {/* status */}
        <div className="smpl-sec-h">Status</div>
        <div className="smpl-status">
          {SAMPLE_STATUSES.map((st) => (
            <button
              key={st.key}
              className={`smpl-pill${sample.status === st.key ? ' on' : ''}`}
              onClick={() => set({ status: st.key })}
            >{st.label}</button>
          ))}
        </div>
      </div>

      <div className="tp-foot tp-foot-row">
        <button className="tp-export" onClick={request} disabled={!sample.samplerId}>Request sample</button>
        <button className="sp-done" onClick={onClose}>Done</button>
      </div>
    </aside>
  );
}
