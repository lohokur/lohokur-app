// Full production tech-pack model + a multi-page export that mirrors a real
// factory-ready pack: header on every page, size grading chart with tolerances,
// materials swatch grid, BOM, sewing details, colorways/Pantone, reference images.

export type Pom = { id: string; name: string; tol: string; v: Record<string, string> };
export type Material = { id: string; ref: string; name: string; placement: string; desc: string; image?: string };
export type BomRow = { id: string; item: string; desc: string; placement: string; qty: string; unit: string };
export type TrimRow = { id: string; section: string; type: string; desc: string };
export type Colorway = { id: string; placement: string; pantone: string; hex: string };
// A woven/printed label designed in the sketch pad, propagated down the pipeline.
export type Label = { brand: string; care: string; image?: string; draft?: string };

export type Techpack = {
  brand: string;
  name: string;
  subtitle: string;
  season: string;
  vendor: string;
  category: string;
  fabric: string;
  sizeRange: string;
  version: string;
  sizes: string[];
  sampleSize: string;
  unit: string;
  mockups: { front?: string; side?: string; back?: string }; // live renders (front/side/back)
  flats: { front?: string; side?: string; back?: string };    // technical vectors of each view
  label?: Label;                                              // designed care/brand label
  poms: Pom[];
  materials: Material[];
  boms: BomRow[];
  info: { type: string; silhouette: string; construction: string };
  trims: TrimRow[];
  sewing: string[];
  colorways: Colorway[];
  references: string[];
  notes: string;
};

let seq = 0;
export const rowId = () => `r${Date.now().toString(36)}${seq++}`;

const emptyVals = (sizes: string[]) => Object.fromEntries(sizes.map((s) => [s, '']));

export function defaultTechpack(): Techpack {
  const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const pom = (name: string, tol: string) => ({ id: rowId(), name, tol, v: emptyVals(sizes) });
  const mat = (ref: string, name: string, placement: string, desc: string) => ({ id: rowId(), ref, name, placement, desc });
  return {
    brand: 'LOHO KUR',
    name: 'Untitled garment',
    subtitle: '',
    season: '',
    vendor: '',
    category: '',
    fabric: '',
    sizeRange: 'XS – XXL',
    version: 'v0',
    sizes,
    sampleSize: 'M',
    unit: 'cm',
    mockups: {},
    flats: {},
    poms: [
      pom('Chest Width (2.5 cm below armhole, laid flat)', '±1.0'),
      pom('Waist Width', '±1.0'),
      pom('Bottom Sweep Width', '±1.0'),
      pom('Center Front Length (HPS to bottom)', '±1.0'),
      pom('Center Back Length (HPS to bottom)', '±1.0'),
      pom('Shoulder Width (shoulder point to shoulder point)', '±0.7'),
      pom('Across Front (between armholes)', '±0.7'),
      pom('Across Back (between armholes)', '±0.7'),
      pom('Armhole Straight', '±0.5'),
      pom('Sleeve Length from Shoulder Seam', '±1.0'),
      pom('Upper Sleeve Width (3 cm below armhole)', '±0.7'),
      pom('Cuff Width (relaxed)', '±0.5'),
      pom('Neck Width (seam to seam)', '±0.5'),
      pom('Front Neck Drop', '±0.3'),
      pom('Back Neck Drop', '±0.3'),
    ],
    materials: [
      mat('1', 'Main body fabric', 'Front body, back body, sleeves', 'Primary shell fabric, garment dyed, matched to main Pantone.'),
      mat('2', 'Rib knit cuff', 'Sleeve cuffs', '2x2 rib knit, cotton rich with elastane recovery.'),
      mat('3', 'Rib knit waistband', 'Bottom hem band', '2x2 rib knit waistband, dyed to match body.'),
      mat('4', 'Front zipper', 'Center front closure', 'Separating zipper, dyed tape, matched pull finish.'),
      mat('5', 'Thread', 'All seams', 'Tex 40 poly core, colour matched to shell.'),
      mat('6', 'Main label set', 'Inside back neck', 'Woven brand + size label.'),
      mat('7', 'Care/content label', 'Left side seam interior', 'Printed care label — fibre content, wash care, origin.'),
    ],
    boms: [],
    info: { type: '', silhouette: '', construction: '' },
    trims: [
      { id: rowId(), section: 'Front body', type: 'Center front closure', desc: '' },
      { id: rowId(), section: 'Sleeves', type: 'Sleeve set', desc: '' },
      { id: rowId(), section: 'Hem and cuff', type: 'Rib trim application', desc: '' },
    ],
    sewing: [
      'Prepare and fuse all reinforcement panels.',
      'Construct body panels; join shoulder seams and stabilise with tape.',
      'Set sleeves to armholes; close side and underarm seams.',
      'Attach rib cuffs and waistband with stretch overlock.',
      'Set labels; final press and finish.',
    ],
    colorways: [{ id: rowId(), placement: 'Main body', pantone: '', hex: '#282d31' }],
    references: [],
    notes: '',
  };
}

// Fill any missing fields so older / partial saved data never crashes the editor.
export function normalizeTechpack(v: Partial<Techpack> | undefined): Techpack {
  const d = defaultTechpack();
  if (!v) return d;
  const sizes = v.sizes?.length ? v.sizes : d.sizes;
  return {
    ...d,
    ...v,
    sizes,
    mockups: { ...v.mockups },
    flats: { ...v.flats },
    label: v.label,
    info: { ...d.info, ...v.info },
    poms: (v.poms ?? d.poms).map((p) => ({ ...p, v: { ...emptyVals(sizes), ...p.v } })),
    materials: v.materials ?? d.materials,
    boms: v.boms ?? d.boms,
    trims: v.trims ?? d.trims,
    sewing: v.sewing ?? d.sewing,
    colorways: v.colorways ?? d.colorways,
    references: v.references ?? d.references,
  };
}

/* ------------------------------------------------------------------ export */

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function header(tp: Techpack, section: string, page: number, total: number) {
  return `<header class="pk-h">
    <div class="pk-h-l">
      <span class="pk-brand">${esc(tp.brand)}</span>
      <span class="pk-name">${esc(tp.name)}</span>
      <div class="pk-sub">${esc(tp.subtitle)}</div>
      <div class="pk-meta1">Season: ${esc(tp.season) || '—'} &nbsp;·&nbsp; Vendor: ${esc(tp.vendor) || '—'}</div>
    </div>
    <div class="pk-h-c">${esc(section)}</div>
    <div class="pk-h-r">
      <div class="pk-ver">${esc(tp.version)} · Page ${page} of ${total}</div>
      <div class="pk-meta2"><span>Size: ${esc(tp.sizeRange) || '—'}</span><span>Category: ${esc(tp.category) || '—'}</span><span>Fabric: ${esc(tp.fabric) || '—'}</span></div>
    </div>
  </header>`;
}

const flatImg = (src: string | undefined, label: string) =>
  src
    ? `<figure class="pk-flat"><img src="${src}" alt="${esc(label)}"/><figcaption>${esc(label)}</figcaption></figure>`
    : `<figure class="pk-flat pk-flat-empty"><span>${esc(label)}</span></figure>`;

function measurementsPage(tp: Techpack) {
  return `<section class="pk-body">
    <div class="pk-flats">
      ${flatImg(tp.flats.front, 'Front')}${flatImg(tp.flats.side, 'Side')}${flatImg(tp.flats.back, 'Back')}
    </div>
  </section>`;
}

const mockImg = (src: string | undefined, label: string) =>
  src ? `<figure class="pk-mock"><img src="${src}" alt="${esc(label)}"/><figcaption>${esc(label)}</figcaption></figure>` : '';

function mockupsPage(tp: Techpack) {
  const m = tp.mockups ?? {};
  return `<section class="pk-body">
    <div class="pk-mocks">${mockImg(m.front, 'Front')}${mockImg(m.side, 'Side')}${mockImg(m.back, 'Back')}</div>
  </section>`;
}

function gradingPage(tp: Techpack) {
  const head = `<tr><th class="l">Point of measure</th><th>Tolerance</th>${tp.sizes
    .map((s) => `<th class="${s === tp.sampleSize ? 'smp' : ''}">${esc(s)}</th>`)
    .join('')}</tr>`;
  const rows = tp.poms
    .map(
      (p) => `<tr><td class="l">${esc(p.name)}</td><td>${esc(p.tol)}</td>${tp.sizes
        .map((s) => `<td class="${s === tp.sampleSize ? 'smp' : ''}">${esc(p.v[s]) || ''}</td>`)
        .join('')}</tr>`
    )
    .join('');
  return `<section class="pk-body">
    <table class="pk-grade"><thead>${head}</thead><tbody>${rows}</tbody></table>
    <p class="pk-foot-note">Sample size: ${esc(tp.sampleSize)} (highlighted) · ${esc(tp.unit)}</p>
  </section>`;
}

function materialsPage(tp: Techpack) {
  const cards = tp.materials
    .map(
      (m) => `<div class="pk-mat">
        <div class="pk-mat-img">${m.image ? `<img src="${m.image}" alt=""/>` : `<span>${esc(m.ref)}</span>`}</div>
        <div class="pk-mat-name">${esc(m.ref)}. ${esc(m.name)}</div>
        <div class="pk-mat-place">${esc(m.placement)}</div>
        <div class="pk-mat-desc">${esc(m.desc)}</div>
      </div>`
    )
    .join('');
  return `<section class="pk-body"><div class="pk-mats">${cards}</div></section>`;
}

function bomPage(tp: Techpack) {
  const rows = (tp.boms.length ? tp.boms : tp.materials.map((m, i) => ({
    id: m.id, item: m.name, desc: m.desc, placement: m.placement, qty: '', unit: 'm', ref: String(i + 1),
  })))
    .map(
      (b, i) => `<tr><td>${(b as BomRow & { ref?: string }).ref ?? i + 1}</td><td class="l">${esc(b.item)}</td><td class="l">${esc(b.desc)}</td><td class="l">${esc(b.placement)}</td><td>${esc(b.qty)}</td><td>${esc(b.unit)}</td></tr>`
    )
    .join('');
  return `<section class="pk-body">
    <table class="pk-tbl"><thead><tr><th>#</th><th class="l">Item name</th><th class="l">Description</th><th class="l">Placement</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

function constructionPage(tp: Techpack) {
  const info = `<div class="pk-info">
    <div><h3>Type</h3><p>${esc(tp.info.type) || '—'}</p></div>
    <div><h3>Silhouette</h3><p>${esc(tp.info.silhouette) || '—'}</p></div>
    <div><h3>Construction</h3><p>${esc(tp.info.construction) || '—'}</p></div>
  </div>`;
  const trims = tp.trims.length
    ? `<h2 class="pk-h2">Construction &amp; trim details</h2>
       <table class="pk-tbl"><thead><tr><th>#</th><th class="l">Section</th><th class="l">Detail type</th><th class="l">Description</th></tr></thead>
       <tbody>${tp.trims.map((t, i) => `<tr><td>${i + 1}</td><td class="l">${esc(t.section)}</td><td class="l">${esc(t.type)}</td><td class="l">${esc(t.desc)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const steps = tp.sewing.length
    ? `<h2 class="pk-h2">Sewing instructions</h2><ol class="pk-steps">${tp.sewing.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`
    : '';
  return `<section class="pk-body">${info}${trims}${steps}</section>`;
}

function colorwaysPage(tp: Techpack) {
  const rows = tp.colorways
    .map(
      (c) => `<div class="pk-cw"><span class="pk-sw" style="background:${esc(c.hex)}"></span>
        <div><div class="pk-cw-p">${esc(c.placement)}</div><div class="pk-cw-m">${esc(c.pantone)} &nbsp; ${esc(c.hex)}</div></div></div>`
    )
    .join('');
  return `<section class="pk-body"><div class="pk-cws">${rows}</div></section>`;
}

function referencesPage(tp: Techpack) {
  return `<section class="pk-body"><div class="pk-refs">${tp.references
    .map((r) => `<img src="${r}" alt="reference"/>`)
    .join('')}</div></section>`;
}

export function techpackHtml(tp0: Techpack): string {
  const tp = normalizeTechpack(tp0);
  const hasMockups = !!(tp.mockups?.front || tp.mockups?.side || tp.mockups?.back);
  const pages: { title: string; html: string }[] = [
    ...(hasMockups ? [{ title: 'LIVE MOCKUPS', html: mockupsPage(tp) }] : []),
    { title: 'SAMPLE MEASUREMENTS', html: measurementsPage(tp) },
    { title: 'SIZE GRADING CHART', html: gradingPage(tp) },
    { title: 'MATERIALS', html: materialsPage(tp) },
    { title: 'BILL OF MATERIALS', html: bomPage(tp) },
    { title: 'CONSTRUCTION GUIDE', html: constructionPage(tp) },
    { title: 'COLORWAYS & PANTONE', html: colorwaysPage(tp) },
  ];
  if (tp.references.length) pages.push({ title: 'REFERENCE IMAGES', html: referencesPage(tp) });
  const total = pages.length;
  const body = pages
    .map((p, i) => `<article class="pk-page">${header(tp, p.title, i + 1, total)}${p.html}</article>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(tp.name)} — tech pack</title>
<style>
  @page { size: letter landscape; margin: 0; }
  *{box-sizing:border-box}
  body{margin:0;background:#5a5f66;font:12px/1.45 -apple-system,Helvetica,Arial,sans-serif;color:#111;padding:24px}
  .pk-page{width:1056px;min-height:816px;margin:0 auto 24px;background:#fff;padding:34px 40px;position:relative;page-break-after:always}
  .pk-page:last-child{page-break-after:auto}
  .pk-h{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:22px;gap:16px}
  .pk-brand{font-weight:800;letter-spacing:.02em;margin-right:8px}
  .pk-name{font-weight:700}
  .pk-sub{font-size:10px;color:#333;margin-top:2px;max-width:42ch}
  .pk-meta1{font-size:9.5px;color:#666;margin-top:3px}
  .pk-h-c{font-size:19px;font-weight:800;letter-spacing:.04em;text-align:center;white-space:nowrap;padding-top:2px}
  .pk-h-r{text-align:right}
  .pk-ver{font-size:10px;color:#444;font-weight:600}
  .pk-meta2{display:flex;flex-direction:column;gap:1px;font-size:9px;color:#666;margin-top:4px}
  .pk-h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#888;border-bottom:1px solid #eee;padding-bottom:5px;margin:22px 0 10px}

  .pk-flats{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:end}
  .pk-flat{margin:0;text-align:center}
  .pk-flat img{max-width:100%;max-height:520px;object-fit:contain}
  .pk-flat figcaption{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.1em;margin-top:8px}
  .pk-flat-empty{height:440px;border:1px dashed #ccc;border-radius:8px;display:flex;align-items:center;justify-content:center}
  .pk-flat-empty span{color:#bbb;font-size:11px;text-transform:uppercase;letter-spacing:.1em}
  .pk-mocks{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:start}
  .pk-mock{margin:0;text-align:center}
  .pk-mock img{width:100%;max-height:580px;object-fit:contain;border-radius:8px;background:#f4f3ef}
  .pk-mock figcaption{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.1em;margin-top:8px}

  table{width:100%;border-collapse:collapse}
  .pk-grade th,.pk-tbl th{font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#999;font-weight:600;text-align:center;padding:7px 8px;border-bottom:1px solid #111}
  .pk-grade th.l,.pk-tbl th.l{text-align:left}
  .pk-grade td,.pk-tbl td{font-size:11px;text-align:center;padding:7px 8px;border-bottom:1px solid #f0f0f0;font-variant-numeric:tabular-nums}
  .pk-grade td.l,.pk-tbl td.l{text-align:left}
  .pk-grade th.smp,.pk-grade td.smp{background:#f5f5f5;font-weight:700;color:#111}
  .pk-foot-note{font-size:10px;color:#999;margin-top:14px}

  .pk-mats{display:grid;grid-template-columns:repeat(4,1fr);gap:22px 20px}
  .pk-mat-img{aspect-ratio:1/1;background:#f2f2f2;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;margin-bottom:9px}
  .pk-mat-img img{width:100%;height:100%;object-fit:cover}
  .pk-mat-img span{font-size:26px;color:#ccc;font-weight:700}
  .pk-mat-name{font-weight:700;font-size:12px}
  .pk-mat-place{color:#2b8a6b;font-size:10px;margin:2px 0 4px}
  .pk-mat-desc{color:#555;font-size:10px;line-height:1.4}

  .pk-info{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:8px}
  .pk-info h3{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#999;margin:0 0 4px}
  .pk-info p{margin:0;font-size:12px;color:#222}
  .pk-steps{margin:0;padding-left:18px;font-size:11.5px;color:#222}
  .pk-steps li{padding:3px 0}

  .pk-cws{display:flex;flex-direction:column;gap:14px}
  .pk-cw{display:flex;gap:14px;align-items:center}
  .pk-sw{width:52px;height:52px;border-radius:6px;border:1px solid #ddd;flex:none}
  .pk-cw-p{font-weight:600;font-size:12px}
  .pk-cw-m{font-size:11px;color:#666}

  .pk-refs{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}
  .pk-refs img{width:100%;object-fit:contain;max-height:600px}

  @media print{body{background:#fff;padding:0}.pk-page{margin:0;box-shadow:none}}
</style></head><body>${body}</body></html>`;
}
