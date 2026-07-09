'use client';

import { useEffect, useState } from 'react';
import {
  type Techpack, type Pom, type Material, type BomRow, type TrimRow, type Colorway,
  defaultTechpack, normalizeTechpack, rowId, techpackHtml,
} from '@/lib/techpack';

const readFile = (f: File | null | undefined, cb: (url: string) => void) => {
  if (!f || !/^image\//.test(f.type)) return;
  const fr = new FileReader();
  fr.onload = () => cb(fr.result as string);
  fr.readAsDataURL(f);
};

export default function TechpackPanel({
  open, nodeId, value, image, onChange, onClose,
}: {
  open: boolean;
  nodeId: string | null;
  value?: Techpack;
  image?: string;
  onChange: (tp: Techpack) => void;
  onClose: () => void;
}) {
  const [tp, setTp] = useState<Techpack>(() => normalizeTechpack(value ?? defaultTechpack()));

  useEffect(() => {
    const init = normalizeTechpack(value ?? defaultTechpack());
    setTp(init);
    if (!value && nodeId) onChange(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  const set = (next: Techpack) => { setTp(next); onChange(next); };
  const f = <K extends keyof Techpack>(k: K, v: Techpack[K]) => set({ ...tp, [k]: v });
  const setInfo = (k: keyof Techpack['info'], v: string) => set({ ...tp, info: { ...tp.info, [k]: v } });
  const setFlat = (k: 'front' | 'side' | 'back', v?: string) => set({ ...tp, flats: { ...tp.flats, [k]: v } });

  // sizes edited as a comma list; keep existing POM values for surviving sizes
  const setSizes = (raw: string) => {
    const sizes = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (!sizes.length) return;
    const poms = tp.poms.map((p) => ({ ...p, v: Object.fromEntries(sizes.map((s) => [s, p.v[s] ?? ''])) }));
    set({ ...tp, sizes, poms });
  };

  // POM
  const setPom = (id: string, patch: Partial<Pom>) => set({ ...tp, poms: tp.poms.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const setPomVal = (id: string, size: string, val: string) =>
    set({ ...tp, poms: tp.poms.map((p) => (p.id === id ? { ...p, v: { ...p.v, [size]: val } } : p)) });
  const addPom = () => set({ ...tp, poms: [...tp.poms, { id: rowId(), name: '', tol: '', v: Object.fromEntries(tp.sizes.map((s) => [s, ''])) }] });
  const rmPom = (id: string) => set({ ...tp, poms: tp.poms.filter((p) => p.id !== id) });

  // materials
  const setMat = (id: string, patch: Partial<Material>) => set({ ...tp, materials: tp.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const addMat = () => set({ ...tp, materials: [...tp.materials, { id: rowId(), ref: String(tp.materials.length + 1), name: '', placement: '', desc: '' }] });
  const rmMat = (id: string) => set({ ...tp, materials: tp.materials.filter((m) => m.id !== id) });

  // trims
  const setTrim = (id: string, patch: Partial<TrimRow>) => set({ ...tp, trims: tp.trims.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const addTrim = () => set({ ...tp, trims: [...tp.trims, { id: rowId(), section: '', type: '', desc: '' }] });
  const rmTrim = (id: string) => set({ ...tp, trims: tp.trims.filter((t) => t.id !== id) });

  // sewing steps
  const setStep = (i: number, v: string) => set({ ...tp, sewing: tp.sewing.map((s, k) => (k === i ? v : s)) });
  const addStep = () => set({ ...tp, sewing: [...tp.sewing, ''] });
  const rmStep = (i: number) => set({ ...tp, sewing: tp.sewing.filter((_, k) => k !== i) });

  // colorways
  const setCw = (id: string, patch: Partial<Colorway>) => set({ ...tp, colorways: tp.colorways.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const addCw = () => set({ ...tp, colorways: [...tp.colorways, { id: rowId(), placement: '', pantone: '', hex: '#333333' }] });
  const rmCw = (id: string) => set({ ...tp, colorways: tp.colorways.filter((c) => c.id !== id) });

  // references
  const addRef = (url: string) => set({ ...tp, references: [...tp.references, url] });
  const rmRef = (i: number) => set({ ...tp, references: tp.references.filter((_, k) => k !== i) });

  const exportPack = () => {
    const html = techpackHtml(tp);
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); return; }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${tp.name || 'techpack'}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const flatSlot = (k: 'front' | 'side' | 'back') => (
    <div className="tp-slot">
      <div className="tp-slot-img">
        {tp.flats[k] ? <img src={tp.flats[k]} alt={k} /> : <span>{k}</span>}
      </div>
      <div className="tp-slot-btns">
        {image && <button onClick={() => setFlat(k, image)}>use upstream</button>}
        <label className="tp-up">upload<input type="file" accept="image/*" hidden
          onChange={(e) => { readFile(e.target.files?.[0], (u) => setFlat(k, u)); e.currentTarget.value = ''; }} /></label>
        {tp.flats[k] && <button onClick={() => setFlat(k, undefined)}>clear</button>}
      </div>
    </div>
  );

  return (
    <aside className={`techpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Tech pack</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="tp-body">
        {/* meta */}
        <input className="tp-title" value={tp.name} placeholder="Garment name" onChange={(e) => f('name', e.target.value)} />
        <input className="tp-in" value={tp.subtitle} placeholder="One-line description (fabric, key features)" onChange={(e) => f('subtitle', e.target.value)} />
        <div className="tp-grid3">
          <label>Season<input className="tp-in" value={tp.season} placeholder="SS26" onChange={(e) => f('season', e.target.value)} /></label>
          <label>Vendor<input className="tp-in" value={tp.vendor} placeholder="—" onChange={(e) => f('vendor', e.target.value)} /></label>
          <label>Version<input className="tp-in" value={tp.version} placeholder="v0" onChange={(e) => f('version', e.target.value)} /></label>
          <label>Category<input className="tp-in" value={tp.category} placeholder="Tops" onChange={(e) => f('category', e.target.value)} /></label>
          <label>Fabric<input className="tp-in" value={tp.fabric} placeholder="—" onChange={(e) => f('fabric', e.target.value)} /></label>
          <label>Size range<input className="tp-in" value={tp.sizeRange} placeholder="XS – XXL" onChange={(e) => f('sizeRange', e.target.value)} /></label>
        </div>

        {/* flats */}
        <section className="tp-sec">
          <div className="tp-sec-h">Technical flats</div>
          <div className="tp-slots">{flatSlot('front')}{flatSlot('side')}{flatSlot('back')}</div>
        </section>

        {/* sizes + grading */}
        <section className="tp-sec">
          <div className="tp-sec-h">Size grading chart <span className="tp-unit">{tp.unit}</span></div>
          <div className="tp-grid3">
            <label>Sizes (comma)<input className="tp-in" value={tp.sizes.join(', ')} onChange={(e) => setSizes(e.target.value)} /></label>
            <label>Sample size<input className="tp-in" value={tp.sampleSize} onChange={(e) => f('sampleSize', e.target.value)} /></label>
            <label>Unit<input className="tp-in" value={tp.unit} onChange={(e) => f('unit', e.target.value)} /></label>
          </div>
          <div className="tp-scroll">
            <table className="tp-table tp-edit">
              <thead><tr><th>Point of measure</th><th>Tol.</th>{tp.sizes.map((s) => <th key={s} className={s === tp.sampleSize ? 'smp' : ''}>{s}</th>)}<th /></tr></thead>
              <tbody>
                {tp.poms.map((p) => (
                  <tr key={p.id}>
                    <td><input className="tp-cell wide" value={p.name} placeholder="measurement" onChange={(e) => setPom(p.id, { name: e.target.value })} /></td>
                    <td><input className="tp-cell num sm" value={p.tol} placeholder="±" onChange={(e) => setPom(p.id, { tol: e.target.value })} /></td>
                    {tp.sizes.map((s) => (
                      <td key={s}><input className={`tp-cell num sm${s === tp.sampleSize ? ' smp' : ''}`} value={p.v[s] ?? ''} onChange={(e) => setPomVal(p.id, s, e.target.value)} /></td>
                    ))}
                    <td><button className="tp-rm" onClick={() => rmPom(p.id)} aria-label="remove">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="tp-add" onClick={addPom}>+ add measurement</button>
        </section>

        {/* materials */}
        <section className="tp-sec">
          <div className="tp-sec-h">Materials</div>
          {tp.materials.map((m) => (
            <div className="tp-mcard" key={m.id}>
              <label className="tp-mimg">
                {m.image ? <img src={m.image} alt="" /> : <span>{m.ref || '+'}</span>}
                <input type="file" accept="image/*" hidden onChange={(e) => { readFile(e.target.files?.[0], (u) => setMat(m.id, { image: u })); e.currentTarget.value = ''; }} />
              </label>
              <div className="tp-mfields">
                <div className="tp-mrow">
                  <input className="tp-cell sm" style={{ width: 40 }} value={m.ref} onChange={(e) => setMat(m.id, { ref: e.target.value })} />
                  <input className="tp-cell" value={m.name} placeholder="Material name" onChange={(e) => setMat(m.id, { name: e.target.value })} />
                  <button className="tp-rm" onClick={() => rmMat(m.id)} aria-label="remove">×</button>
                </div>
                <input className="tp-cell" value={m.placement} placeholder="Placement" onChange={(e) => setMat(m.id, { placement: e.target.value })} />
                <input className="tp-cell" value={m.desc} placeholder="Description" onChange={(e) => setMat(m.id, { desc: e.target.value })} />
              </div>
            </div>
          ))}
          <button className="tp-add" onClick={addMat}>+ add material</button>
        </section>

        {/* construction */}
        <section className="tp-sec">
          <div className="tp-sec-h">Construction</div>
          <div className="tp-grid3">
            <label>Type<input className="tp-in" value={tp.info.type} placeholder="Full-zip hooded sweatshirt" onChange={(e) => setInfo('type', e.target.value)} /></label>
            <label>Silhouette<input className="tp-in" value={tp.info.silhouette} placeholder="Oversized" onChange={(e) => setInfo('silhouette', e.target.value)} /></label>
            <label>Method<input className="tp-in" value={tp.info.construction} placeholder="Cut-and-sew" onChange={(e) => setInfo('construction', e.target.value)} /></label>
          </div>
          <table className="tp-table tp-edit">
            <thead><tr><th>Section</th><th>Detail type</th><th>Description</th><th /></tr></thead>
            <tbody>
              {tp.trims.map((t) => (
                <tr key={t.id}>
                  <td><input className="tp-cell" value={t.section} placeholder="—" onChange={(e) => setTrim(t.id, { section: e.target.value })} /></td>
                  <td><input className="tp-cell" value={t.type} placeholder="—" onChange={(e) => setTrim(t.id, { type: e.target.value })} /></td>
                  <td><input className="tp-cell" value={t.desc} placeholder="—" onChange={(e) => setTrim(t.id, { desc: e.target.value })} /></td>
                  <td><button className="tp-rm" onClick={() => rmTrim(t.id)} aria-label="remove">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="tp-add" onClick={addTrim}>+ add detail</button>
        </section>

        {/* sewing steps */}
        <section className="tp-sec">
          <div className="tp-sec-h">Sewing instructions</div>
          {tp.sewing.map((s, i) => (
            <div className="tp-step" key={i}>
              <span className="tp-step-n">{i + 1}</span>
              <input className="tp-cell" value={s} placeholder="step…" onChange={(e) => setStep(i, e.target.value)} />
              <button className="tp-rm" onClick={() => rmStep(i)} aria-label="remove">×</button>
            </div>
          ))}
          <button className="tp-add" onClick={addStep}>+ add step</button>
        </section>

        {/* colorways */}
        <section className="tp-sec">
          <div className="tp-sec-h">Colorways &amp; Pantone</div>
          {tp.colorways.map((c) => (
            <div className="tp-cwrow" key={c.id}>
              <input type="color" className="tp-color" value={c.hex} onChange={(e) => setCw(c.id, { hex: e.target.value })} />
              <input className="tp-cell" value={c.placement} placeholder="Placement" onChange={(e) => setCw(c.id, { placement: e.target.value })} />
              <input className="tp-cell sm" value={c.pantone} placeholder="Pantone" onChange={(e) => setCw(c.id, { pantone: e.target.value })} />
              <button className="tp-rm" onClick={() => rmCw(c.id)} aria-label="remove">×</button>
            </div>
          ))}
          <button className="tp-add" onClick={addCw}>+ add colour</button>
        </section>

        {/* references */}
        <section className="tp-sec">
          <div className="tp-sec-h">Reference images</div>
          <div className="tp-refs">
            {tp.references.map((r, i) => (
              <div className="tp-ref" key={i}>
                <img src={r} alt="reference" />
                <button className="tp-rm" onClick={() => rmRef(i)} aria-label="remove">×</button>
              </div>
            ))}
            <label className="tp-refadd">+<input type="file" accept="image/*" hidden onChange={(e) => { readFile(e.target.files?.[0], addRef); e.currentTarget.value = ''; }} /></label>
          </div>
        </section>
      </div>

      <div className="tp-foot tp-foot-row">
        <button className="tp-export" onClick={exportPack}>Export pack ↗</button>
        <button className="sp-done" onClick={onClose}>Done</button>
      </div>
    </aside>
  );
}
