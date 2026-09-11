'use client';

import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { VIEWS, type View } from '@/lib/nodeTypes';
import ColorWheel from '@/components/ColorWheel';
import FaceIdDissolve from '@/components/FaceIdDissolve';
import type { Label } from '@/lib/techpack';

const W = 1000, H = 1250; // 4:5 portrait — matches the node cards
// the minimal side-pad shows only these tools; the rest live in the full workspace
const SIMPLE_TOOLS = new Set(['brush', 'pencil', 'eraser', 'fill', 'transform', 'liquify', 'text']);
type Tool = 'brush' | 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse' | 'move' | 'hand' | 'transform' | 'liquify' | 'text';
type Blend = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'hard-light' | 'soft-light' | 'difference';
type Layer = { id: string; name: string; visible: boolean; opacity: number; blend: Blend; cv: HTMLCanvasElement };
type Doc = { layers: Layer[]; activeId: string };
type Snap = { layers: { id: string; name: string; visible: boolean; opacity: number; blend: Blend; url: string }[]; activeId: string };

const BLENDS: Blend[] = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'hard-light', 'soft-light', 'difference'];
const BLEND_LABEL: Record<Blend, string> = { 'source-over': 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', 'color-dodge': 'Dodge', 'hard-light': 'Hard light', 'soft-light': 'Soft light', difference: 'Difference' };
const SWATCHES = ['#141414', '#ffffff', '#e5484d', '#f5a623', '#eab308', '#22c55e', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#a9784b', '#8b98a5'];
const TOOLS: { key: Tool; label: string; icon: string }[] = [
  { key: 'transform', label: 'Transform (V)', icon: 'M8 3H4v4M20 7V3h-4M16 21h4v-4M4 17v4h4M8 8h8v8H8z' },
  { key: 'liquify', label: 'Liquify (L)', icon: 'M12 3c4 4 6.5 7 6.5 10a6.5 6.5 0 0 1-13 0c0-3 2.5-6 6.5-10zM9.5 14a2.5 2.5 0 0 0 2.5 2.5' },
  { key: 'text', label: 'Label (T)', icon: 'M5 5h14M12 5v14M9 19h6' },
  { key: 'move', label: 'Move', icon: 'M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3' },
  { key: 'brush', label: 'Brush (B)', icon: 'M4 20c3-1 4-3 6-6M14 4l6 6-8 6-4-4z' },
  { key: 'pencil', label: 'Pencil (N)', icon: 'M4 20l3-.6L20 6.4 17.6 4 4.6 17z' },
  { key: 'eraser', label: 'Eraser (E)', icon: 'M4 15l7-7 7 7-4 4H8zM3 21h18' },
  { key: 'fill', label: 'Fill (G)', icon: 'M6 3l9 9-7 7-6-6zM15 12l4 4c1 1 1 3-1 3s-2-2-1-3M2 20h6' },
  { key: 'eyedropper', label: 'Eyedropper (I)', icon: 'M13 3l4 4-9 9-4 1 1-4zM17 7l3-3' },
  { key: 'line', label: 'Line (L)', icon: 'M4 20L20 4' },
  { key: 'rect', label: 'Rectangle (U)', icon: 'M4 5h16v14H4z' },
  { key: 'ellipse', label: 'Ellipse (O)', icon: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z' },
  { key: 'hand', label: 'Hand (H)', icon: 'M6 12V6a1.5 1.5 0 013 0v5m0-6.5a1.5 1.5 0 013 0V11m0-6a1.5 1.5 0 013 0v6m0-3.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-2a6 6 0 01-6-6l-2-3' },
];

let uid = 0;
const nid = () => `l${Date.now().toString(36)}${uid++}`;
function makeCanvas(fill?: string): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  if (fill) { const c = cv.getContext('2d')!; c.fillStyle = fill; c.fillRect(0, 0, W, H); }
  return cv;
}

export default function SketchStudio({
  open, nodeId, views, onView, onClose, initialView = 'front', onViewChange, onApplyEdits, applying, onBringToLife, label, onLabel,
}: {
  open: boolean;
  nodeId: string | null;
  views: Partial<Record<View, string>>;
  onView: (view: View, dataUrl: string) => void;
  onClose: () => void;
  initialView?: View; // which view to open on (F/S/B clicked on the node)
  onViewChange?: (view: View) => void; // reflect the pad's F/S/B on the node card
  onApplyEdits?: (view: View, dataUrl: string) => void; // re-render this view with the drawn annotations
  applying?: boolean; // parent is running the annotate edit
  onBringToLife?: (view: View, dataUrl: string) => void; // render this sketch through the AI visualiser
  label?: Label; // the designed brand/care label carried down the pipeline
  onLabel?: (l: Label) => void;
}) {
  // keyed by view — plus a 'label' surface (the label is drawn on the same canvas)
  const docs = useRef<Record<string, Doc>>({});
  const undoStack = useRef<Record<string, Snap[]>>({});
  const redoStack = useRef<Record<string, Snap[]>>({});
  const loadedSrc = useRef<Record<string, string>>({}); // which image is painted into each surface's background
  const dispRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const minShellRef = useRef<HTMLDivElement>(null); // minimal-pad card — click outside it (the canvas) retracts
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View | 'label'>('front'); // 'label' = the label design surface
  // Simple pad slides in from the side by default; the expand button reveals the
  // full Photoshop-grade workspace (all tools, layers, blend modes).
  const [full, setFull] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [reloadKey, setReloadKey] = useState(0); // bump to force the current view to reload from `views`
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#141414');
  const [recent, setRecent] = useState<string[]>([]);
  const [size, setSize] = useState(8);
  const [opacity, setOpacity] = useState(100);
  const [hardness, setHardness] = useState(85);
  const [fillShape, setFillShape] = useState(true);
  const [zoom, setZoom] = useState(0.62);
  const [mounted, setMounted] = useState(false); // canvas work is browser-only — skip during SSR
  useEffect(() => { setMounted(true); }, []);
  // minimal-pad popovers (colour wheel / brush size)
  const [wheelOpen, setWheelOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [dropping, setDropping] = useState(false); // drag-over highlight on the pad
  const [textEntry, setTextEntry] = useState<null | { cx: number; cy: number; sx: number; sy: number }>(null); // active label
  const [textVal, setTextVal] = useState('');
  const [dissolve, setDissolve] = useState(false); // Face-ID dissolve overlay while applying edits
  const [dissolveSrc, setDissolveSrc] = useState('');
  const [lifeMode, setLifeMode] = useState(false); // dissolve label: bring-to-life vs apply-edits
  // in-pad label mode: the sketch minimises to a thumbnail and the pad becomes a
  // label designer; click the thumbnail to return to sketching.
  const [labelMode, setLabelMode] = useState(false);
  const [labelRendering, setLabelRendering] = useState(false);
  const [prevView, setPrevView] = useState<View>('front');
  const [sketchThumb, setSketchThumb] = useState('');
  // minimal-pad canvas zoom + pan (pinch to zoom, two-finger to pan; drawing still maps correctly)
  const [mz, setMz] = useState(1);
  const [mpan, setMpan] = useState({ x: 0, y: 0 });
  const mzRef = useRef(1); useEffect(() => { mzRef.current = mz; }, [mz]);
  // free-transform session on the active layer (drag / scale / rotate dropped images & elements)
  const xf = useRef<null | { id: string; target: HTMLCanvasElement; snap: HTMLCanvasElement; bx: number; by: number; bw: number; bh: number; tx: number; ty: number; scale: number; rot: number }>(null);
  const xfDrag = useRef<null | { mode: 'move' | 'scale' | 'rotate'; sx: number; sy: number; base: number; ref: number }>(null);
  // Per-layer pristine source + accumulated transform, so an element that's been
  // dragged off-canvas keeps its full pixels and can always be brought back whole
  // (the canvas behaves as if it were infinite while editing).
  const xfStore = useRef<Record<string, { src: HTMLCanvasElement; tx: number; ty: number; scale: number; rot: number; bx: number; by: number; bw: number; bh: number }>>({});

  const drawing = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const lastP = useRef({ x: 0, y: 0 });
  const moveSnap = useRef<HTMLCanvasElement | null>(null);
  const panning = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const liqTarget = useRef<HTMLCanvasElement | null>(null); // layer being liquified this stroke

  // Create a view's document on demand: a white background + one empty layer.
  // The saved image is loaded separately (see the load effect below) so that a
  // doc created before `views` was ready still gets its image painted in.
  const doc = (): Doc => {
    if (!docs.current[view]) {
      const bg = makeCanvas('#ffffff');
      const l1: Layer = { id: nid(), name: 'Layer 1', visible: true, opacity: 1, blend: 'source-over', cv: makeCanvas() };
      docs.current[view] = { layers: [{ id: nid(), name: 'Background', visible: true, opacity: 1, blend: 'source-over', cv: bg }, l1], activeId: l1.id };
    }
    return docs.current[view]!;
  };
  const active = (): Layer => { const d = doc(); return d.layers.find((l) => l.id === d.activeId) ?? d.layers[d.layers.length - 1]; };
  const buf = () => { if (!bufRef.current) bufRef.current = makeCanvas(); return bufRef.current; };

  function composite(extra?: (c: CanvasRenderingContext2D) => void) {
    const disp = dispRef.current; if (!disp) return;
    const c = disp.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); // the pad canvas is always white — erasing reveals white, never transparency
    for (const l of doc().layers) {
      if (!l.visible) continue;
      c.globalAlpha = l.opacity; c.globalCompositeOperation = l.blend;
      c.drawImage(l.cv, 0, 0);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    extra?.(c);
    if (xf.current && !extra) drawGizmo(c);
  }
  function flat(): HTMLCanvasElement {
    const out = makeCanvas('#ffffff'); // export on a white base — matches the always-white pad canvas
    const c = out.getContext('2d')!;
    for (const l of doc().layers) { if (!l.visible) continue; c.globalAlpha = l.opacity; c.globalCompositeOperation = l.blend; c.drawImage(l.cv, 0, 0); }
    return out;
  }
  const emit = () => {
    try {
      const url = flat().toDataURL('image/png');
      loadedSrc.current[view] = url; // we just wrote this; don't let the load effect reload/clobber the strokes
      if (view === 'label') onLabel?.({ brand: label?.brand ?? '', care: label?.care ?? '', image: label?.image, draft: url });
      else onView(view, url);
    } catch { /* cross-origin base image can't be exported this frame — leave the saved view as-is */ }
  };

  function snapshot() {
    const d = doc();
    const s: Snap = { activeId: d.activeId, layers: d.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, url: l.cv.toDataURL() })) };
    (undoStack.current[view] ??= []).push(s);
    if (undoStack.current[view]!.length > 24) undoStack.current[view]!.shift();
    redoStack.current[view] = [];
  }
  function restore(s: Snap) {
    const layers: Layer[] = s.layers.map((m) => {
      const cv = makeCanvas();
      const img = new Image(); img.onload = () => { cv.getContext('2d')!.drawImage(img, 0, 0); composite(); }; img.src = m.url;
      return { id: m.id, name: m.name, visible: m.visible, opacity: m.opacity, blend: m.blend, cv };
    });
    docs.current[view] = { layers, activeId: s.activeId };
    rerender(); composite(); setTimeout(() => emit(), 60);
  }
  function undo() {
    const u = undoStack.current[view]; if (!u || !u.length) return;
    const cur: Snap = { activeId: doc().activeId, layers: doc().layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, url: l.cv.toDataURL() })) };
    (redoStack.current[view] ??= []).push(cur);
    restore(u.pop()!);
  }
  function redo() {
    const r = redoStack.current[view]; if (!r || !r.length) return;
    const cur: Snap = { activeId: doc().activeId, layers: doc().layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend, url: l.cv.toDataURL() })) };
    (undoStack.current[view] ??= []).push(cur);
    restore(r.pop()!);
  }

  // switching to a different node: drop all in-memory docs/history so its own
  // saved views load fresh (never show the previous node's canvas)
  useEffect(() => {
    docs.current = {}; undoStack.current = {}; redoStack.current = {}; loadedSrc.current = {}; xfStore.current = {};
    if (open) setView(initialView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, open, initialView]);

  // load the saved image for the current view into its background layer, then
  // paint. Runs whenever the view or the incoming views change, and tracks what
  // it loaded so a doc created before `views` was ready still gets its image.
  useEffect(() => {
    if (!open) return;
    const src = view === 'label' ? (label?.image ?? label?.draft) : views[view];
    const d = doc();
    if (src && loadedSrc.current[view] !== src) {
      loadedSrc.current[view] = src;
      const bg = d.layers[0].cv;
      const paint = (img: HTMLImageElement) => {
        const ctx = bg.getContext('2d')!;
        ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        const s = Math.min(W / img.width, H / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        composite();
      };
      const img = new Image();
      img.crossOrigin = 'anonymous'; // hosted (generated) images are cross-origin — avoid tainting the canvas
      img.onload = () => paint(img);
      img.onerror = () => { const dd = new Image(); dd.onload = () => paint(dd); dd.src = src; };
      img.src = src;
    } else {
      composite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nodeId, view, views, label, reloadKey]);

  const fit = () => {
    const st = stageRef.current; if (!st) return;
    const z = Math.min((st.clientWidth - 44) / W, (st.clientHeight - 44) / H);
    setZoom(Math.max(0.12, Math.min(1.6, z)));
  };
  useEffect(() => { if (!open) return; const id = requestAnimationFrame(fit); return () => cancelAnimationFrame(id); /* eslint-disable-next-line */ }, [open, full]);
  // each fresh open starts as the minimal side pad; expand is per-session
  useEffect(() => { if (open) { setFull(false); setWheelOpen(false); setSizeOpen(false); setLayersOpen(false); setMz(1); setMpan({ x: 0, y: 0 }); xf.current = null; } }, [open, nodeId]);
  // toggling full swaps the display canvas element — repaint the doc onto the new one
  useEffect(() => { if (!open) return; const id = requestAnimationFrame(() => composite()); return () => cancelAnimationFrame(id); /* eslint-disable-next-line */ }, [full]);
  // switching view resets zoom/pan and any live transform; leaving the transform tool commits it
  useEffect(() => { setMz(1); setMpan({ x: 0, y: 0 }); xf.current = null; xfStore.current = {}; /* eslint-disable-next-line */ }, [view]);
  useEffect(() => {
    if (tool === 'transform') { if (!xf.current) beginTransform(); } // show the gizmo the moment the tool is picked
    else if (xf.current) { xf.current = null; composite(); }
    /* eslint-disable-next-line */
  }, [tool]);
  // when an annotate re-render finishes, reload the current view fresh so the result
  // replaces the drawing (drop the annotation layers)
  const prevApplying = useRef(false);
  useEffect(() => {
    if (prevApplying.current && !applying) { delete docs.current[view]; delete loadedSrc.current[view]; xfStore.current = {}; setReloadKey((k) => k + 1); }
    prevApplying.current = !!applying;
    /* eslint-disable-next-line */
  }, [applying]);
  // focus the label input AFTER the placing click finishes (a same-tick focus gets
  // blurred by the click's own pointerup, which would commit it empty)
  useEffect(() => {
    if (!textEntry) return;
    const id = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [textEntry]);
  // minimal pad: a pointer-down anywhere outside the card (i.e. on the canvas)
  // retracts it — there's no Done button in the minimal pad. Not in full mode,
  // where the whole screen is the editor. Skip while a render is applying so a
  // stray click doesn't drop the pad mid-generation.
  useEffect(() => {
    if (!open || full || applying || labelMode) return; // don't retract while the label modal is open
    const onDown = (e: PointerEvent) => {
      const shell = minShellRef.current;
      if (shell && !shell.contains(e.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, full, applying, labelMode, onClose]);
  // keep the Face-ID dissolve on screen briefly after applying ends, to play the "gather"
  useEffect(() => {
    if (applying) { setDissolve(true); return; }
    if (dissolve) { const t = setTimeout(() => setDissolve(false), 850); return () => clearTimeout(t); }
    /* eslint-disable-next-line */
  }, [applying]);

  const pushRecent = (c: string) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 8));

  const pt = (e: RPE) => {
    const r = dispRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  };

  // Liquify: forward-warp pixels of the target layer along the drag (pull), with a
  // radial falloff — reshape a garment by pushing its edges around.
  function liquifyStep(cv: HTMLCanvasElement, a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) < 0.15 && Math.abs(dy) < 0.15) return;
    const r = Math.max(20, size * 2.5);
    const x0 = Math.max(0, Math.floor(b.x - r)), y0 = Math.max(0, Math.floor(b.y - r));
    const x1 = Math.min(W, Math.ceil(b.x + r)), y1 = Math.min(H, Math.ceil(b.y + r));
    const w = x1 - x0, h = y1 - y0; if (w <= 1 || h <= 1) return;
    const ctx = cv.getContext('2d')!;
    let src: ImageData; try { src = ctx.getImageData(x0, y0, w, h); } catch { return; }
    const s = src.data; const out = new Uint8ClampedArray(s);
    const strength = 0.6;
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const dist = Math.hypot(x0 + px - b.x, y0 + py - b.y);
      if (dist >= r) continue;
      const t = 1 - dist / r; const f = t * t * strength;
      const sx = px - dx * f, sy = py - dy * f;
      const ix = Math.floor(sx), iy = Math.floor(sy);
      if (ix < 0 || iy < 0 || ix >= w - 1 || iy >= h - 1) continue;
      const fx = sx - ix, fy = sy - iy, oi = (py * w + px) * 4;
      for (let c = 0; c < 4; c++) {
        const i00 = (iy * w + ix) * 4 + c, i10 = i00 + 4, i01 = ((iy + 1) * w + ix) * 4 + c, i11 = i01 + 4;
        const top = s[i00] * (1 - fx) + s[i10] * fx, bot = s[i01] * (1 - fx) + s[i11] * fx;
        out[oi + c] = top * (1 - fy) + bot * fy;
      }
    }
    ctx.putImageData(new ImageData(out, w, h), x0, y0);
  }

  function strokeSeg(c: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, hard: boolean) {
    c.strokeStyle = color; c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = color; c.shadowBlur = hard ? 0 : (size * (1 - hardness / 100)) * 0.9;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.shadowBlur = 0;
  }

  function floodFill(p: { x: number; y: number }) {
    const cv = active().cv; const c = cv.getContext('2d')!;
    const img = c.getImageData(0, 0, W, H); const d = img.data;
    const x0 = Math.floor(p.x), y0 = Math.floor(p.y); if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return;
    const idx = (x: number, y: number) => (y * W + x) * 4;
    const s = idx(x0, y0); const tr = d[s], tg = d[s + 1], tb = d[s + 2], ta = d[s + 3];
    const col = document.createElement('canvas').getContext('2d')!; col.fillStyle = color; col.fillRect(0, 0, 1, 1); const cc = col.getImageData(0, 0, 1, 1).data;
    if (tr === cc[0] && tg === cc[1] && tb === cc[2] && ta === 255) return;
    const tol = 32; const stack = [[x0, y0]];
    const match = (i: number) => Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol && Math.abs(d[i + 2] - tb) <= tol && Math.abs(d[i + 3] - ta) <= tol;
    while (stack.length) {
      const [x, y] = stack.pop()!; const i = idx(x, y); if (!match(i)) continue;
      d[i] = cc[0]; d[i + 1] = cc[1]; d[i + 2] = cc[2]; d[i + 3] = 255;
      if (x > 0) stack.push([x - 1, y]); if (x < W - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]); if (y < H - 1) stack.push([x, y + 1]);
    }
    c.putImageData(img, 0, 0);
  }

  function drawShape(c: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = size; c.lineCap = 'round';
    if (tool === 'line') { c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); return; }
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (tool === 'rect') { if (fillShape) c.fillRect(x, y, w, h); else c.strokeRect(x, y, w, h); }
    else { c.beginPath(); c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); fillShape ? c.fill() : c.stroke(); }
  }

  const down = (e: RPE) => {
    dispRef.current!.setPointerCapture(e.pointerId);
    const p = pt(e); start.current = p; lastP.current = p;
    if (tool === 'transform') {
      if (!xf.current && !beginTransform()) return; // nothing on this layer to transform
      const pts = xfPts(); const cr = dispRef.current!.getBoundingClientRect(); const hit = 13 * (W / cr.width);
      const { cx, cy } = xfCenter();
      const near = (a: [number, number]) => Math.hypot(a[0] - p.x, a[1] - p.y) < hit;
      if (near(pts.rot)) xfDrag.current = { mode: 'rotate', sx: p.x, sy: p.y, base: xf.current!.rot, ref: Math.atan2(p.y - cy, p.x - cx) };
      else if (pts.c.some(near)) xfDrag.current = { mode: 'scale', sx: p.x, sy: p.y, base: xf.current!.scale, ref: Math.max(1, Math.hypot(p.x - cx, p.y - cy)) };
      else if (pointInQuad(p, pts.c)) xfDrag.current = { mode: 'move', sx: p.x, sy: p.y, base: xf.current!.tx, ref: xf.current!.ty };
      else { xf.current = null; composite(); return; } // click outside deselects
      drawing.current = true; return;
    }
    if (tool === 'liquify') {
      const dd = doc(); const a = active();
      const hasPix = (l: Layer) => { try { return layerBounds(l.cv).found; } catch { return true; } };
      liqTarget.current = (a !== dd.layers[0] && hasPix(a)) ? a.cv : dd.layers[0].cv; // reshape the drawn layer, else the garment
      snapshot(); delete xfStore.current[active().id]; drawing.current = true; return;
    }
    if (tool === 'text') {
      // don't capture the pointer — otherwise the pointerup blurs the label input the instant it opens
      try { dispRef.current!.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      if (textEntry) commitText();
      const r = stageRef.current!.getBoundingClientRect();
      setTextEntry({ cx: p.x, cy: p.y, sx: e.clientX - r.left, sy: e.clientY - r.top }); setTextVal('');
      return;
    }
    if (tool === 'hand') { const st = stageRef.current!; panning.current = { x: e.clientX, y: e.clientY, sl: st.scrollLeft, st: st.scrollTop }; return; }
    if (tool === 'eyedropper') { const c = dispRef.current!.getContext('2d')!; const d = c.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; const hex = '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join(''); setColor(hex); pushRecent(hex); return; }
    if (tool === 'fill') { snapshot(); floodFill(p); delete xfStore.current[active().id]; composite(); emit(); return; }
    drawing.current = true;
    if (tool === 'move') { moveSnap.current = makeCanvas(); moveSnap.current.getContext('2d')!.drawImage(active().cv, 0, 0); snapshot(); return; }
    if (tool === 'brush' || tool === 'pencil') { const b = buf().getContext('2d')!; b.clearRect(0, 0, W, H); }
    if (tool === 'eraser') { snapshot(); }
  };

  const move = (e: RPE) => {
    if (tool === 'hand' && panning.current) { const st = stageRef.current!; st.scrollLeft = panning.current.sl - (e.clientX - panning.current.x); st.scrollTop = panning.current.st - (e.clientY - panning.current.y); return; }
    if (tool === 'transform') {
      if (!xfDrag.current || !xf.current) return; const d = xfDrag.current; const p = pt(e);
      if (d.mode === 'move') { xf.current.tx = d.base + (p.x - d.sx); xf.current.ty = d.ref + (p.y - d.sy); }
      else { const { cx, cy } = xfCenter();
        if (d.mode === 'scale') xf.current.scale = Math.max(0.05, Math.min(12, d.base * Math.hypot(p.x - cx, p.y - cy) / d.ref));
        else xf.current.rot = d.base + (Math.atan2(p.y - cy, p.x - cx) - d.ref);
      }
      xfApply(); composite(); return;
    }
    if (tool === 'liquify') {
      if (!drawing.current || !liqTarget.current) return; const p = pt(e);
      liquifyStep(liqTarget.current, lastP.current, p); composite(); lastP.current = p; return;
    }
    if (!drawing.current) return;
    const p = pt(e);
    if (tool === 'brush' || tool === 'pencil') {
      strokeSeg(buf().getContext('2d')!, lastP.current, p, tool === 'pencil');
      composite((c) => { c.globalAlpha = opacity / 100; c.drawImage(buf(), 0, 0); c.globalAlpha = 1; });
    } else if (tool === 'eraser') {
      const c = active().cv.getContext('2d')!; c.save(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(lastP.current.x, lastP.current.y); c.lineTo(p.x, p.y); c.stroke(); c.restore(); composite();
    } else if (tool === 'move') {
      const c = active().cv.getContext('2d')!; c.clearRect(0, 0, W, H); c.drawImage(moveSnap.current!, p.x - start.current.x, p.y - start.current.y); composite();
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      composite((c) => drawShape(c, start.current, p));
    }
    lastP.current = p;
  };

  const up = (e: RPE) => {
    if (tool === 'hand') { panning.current = null; return; }
    if (tool === 'transform') { if (xfDrag.current && xf.current) { xfDrag.current = null; const t = xf.current; xfStore.current[t.id] = { src: t.snap, tx: t.tx, ty: t.ty, scale: t.scale, rot: t.rot, bx: t.bx, by: t.by, bw: t.bw, bh: t.bh }; composite(); emit(); } drawing.current = false; return; }
    if (tool === 'liquify') { drawing.current = false; if (liqTarget.current) { liqTarget.current = null; composite(); emit(); } return; }
    if (!drawing.current) return; drawing.current = false;
    const p = lastP.current;
    if (tool === 'brush' || tool === 'pencil') { snapshot(); const c = active().cv.getContext('2d')!; c.globalAlpha = opacity / 100; c.drawImage(buf(), 0, 0); c.globalAlpha = 1; pushRecent(color); }
    else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') { snapshot(); drawShape(active().cv.getContext('2d')!, start.current, p); pushRecent(color); }
    delete xfStore.current[active().id]; // layer pixels changed — drop its cached transform source
    composite(); emit();
    void e;
  };

  // layer ops
  const setActive = (id: string) => { doc().activeId = id; rerender(); };
  const addLayer = () => { snapshot(); const d = doc(); const l: Layer = { id: nid(), name: `Layer ${d.layers.length}`, visible: true, opacity: 1, blend: 'source-over', cv: makeCanvas() }; const i = d.layers.findIndex((x) => x.id === d.activeId); d.layers.splice(i + 1, 0, l); d.activeId = l.id; rerender(); composite(); };
  const delLayer = () => { const d = doc(); if (d.layers.length <= 1) return; snapshot(); const i = d.layers.findIndex((x) => x.id === d.activeId); d.layers.splice(i, 1); d.activeId = d.layers[Math.max(0, i - 1)].id; rerender(); composite(); emit(); };
  const dupLayer = () => { snapshot(); const d = doc(); const src = active(); const cv = makeCanvas(); cv.getContext('2d')!.drawImage(src.cv, 0, 0); const l: Layer = { id: nid(), name: src.name + ' copy', visible: true, opacity: src.opacity, blend: src.blend, cv }; const i = d.layers.findIndex((x) => x.id === d.activeId); d.layers.splice(i + 1, 0, l); d.activeId = l.id; rerender(); composite(); emit(); };
  const moveLayer = (dir: -1 | 1) => { const d = doc(); const i = d.layers.findIndex((x) => x.id === d.activeId); const j = i + dir; if (j < 0 || j >= d.layers.length) return; snapshot(); [d.layers[i], d.layers[j]] = [d.layers[j], d.layers[i]]; rerender(); composite(); emit(); };
  const toggleVis = (id: string) => { const l = doc().layers.find((x) => x.id === id)!; l.visible = !l.visible; rerender(); composite(); emit(); };
  const setLayerOpacity = (v: number) => { active().opacity = v / 100; rerender(); composite(); emit(); };
  const setLayerBlend = (b: Blend) => { active().blend = b; rerender(); composite(); emit(); };
  const rename = (id: string, name: string) => { const l = doc().layers.find((x) => x.id === id)!; l.name = name; rerender(); };

  const importImage = (f?: File | null) => {
    if (!f || !/^image\//.test(f.type)) return;
    const img = new Image();
    img.onload = () => { snapshot(); const cv = makeCanvas(); const s = Math.min(W / img.width, H / img.height); cv.getContext('2d')!.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); const d = doc(); const l: Layer = { id: nid(), name: f.name.slice(0, 16), visible: true, opacity: 1, blend: 'source-over', cv }; d.layers.push(l); d.activeId = l.id; setTool('transform'); rerender(); beginTransform(); emit(); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };

  const onWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(4, Math.max(0.15, z - e.deltaY * 0.001))); } };

  // ---- minimal pad: pinch-zoom + two-finger pan on the drawing canvas ----
  const clampPan = (x: number, y: number, z: number, w: number, h: number) => {
    const mx = Math.max(0, (w * z - w) / 2), my = Math.max(0, (h * z - h) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };
  // Native (non-passive) wheel listener on the pad stage so preventDefault actually
  // stops the browser's own ⌘/Ctrl-wheel page zoom — a React onWheel is passive.
  useEffect(() => {
    if (!open || full) return; const st = stageRef.current; if (!st) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation(); const r = st.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
        setMz((z) => {
          const nz = Math.min(24, Math.max(1, z * (1 - e.deltaY * 0.012)));
          setMpan((p) => { if (nz <= 1) return { x: 0, y: 0 }; const k = nz / z; return clampPan(cx - (cx - p.x) * k, cy - (cy - p.y) * k, nz, r.width, r.height); });
          return nz;
        });
      } else {
        setMpan((p) => clampPan(p.x - e.deltaX, p.y - e.deltaY, mzRef.current, r.width, r.height));
      }
    };
    st.addEventListener('wheel', onWheelNative, { passive: false });
    return () => st.removeEventListener('wheel', onWheelNative);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, full]);

  // Photoshop-style keyboard shortcuts while the pad is open (node hotkeys are
  // already suppressed by the canvas whenever a pad is editing).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
        else if (e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
        return;
      }
      // Delete only removes a transform-selected element — never a node, never a whole drawing layer by surprise
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); if (xf.current) deleteActiveElement(); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (labelMode) { setLabelMode(false); } else if (wheelOpen || sizeOpen || layersOpen) { setWheelOpen(false); setSizeOpen(false); setLayersOpen(false); } else if (xf.current) { xf.current = null; composite(); } else onClose(); return; }
      if (e.key === '[') { e.preventDefault(); setSize((s) => Math.max(1, s - 2)); return; }
      if (e.key === ']') { e.preventDefault(); setSize((s) => Math.min(120, s + 2)); return; }
      const map: Record<string, Tool> = { b: 'brush', n: 'pencil', e: 'eraser', v: 'transform', l: 'liquify', g: 'fill', i: 'eyedropper' };
      const tk = map[e.key.toLowerCase()];
      if (tk) { e.preventDefault(); setTool(tk); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wheelOpen, sizeOpen, layersOpen, labelMode]);

  // Click anywhere outside an open popover (incl. the canvas) dismisses it, so you
  // can pop the colour/size/layers panel and go straight back to drawing.
  useEffect(() => {
    if (!wheelOpen && !sizeOpen && !layersOpen) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest('.pe-min-pop-wrap')) return; // trigger buttons + popovers keep their own behaviour
      setWheelOpen(false); setSizeOpen(false); setLayersOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [wheelOpen, sizeOpen, layersOpen]);

  // ---- free transform of the active layer (dropped images / drawn elements) ----
  const xfCenter = () => { const t = xf.current!; return { cx: t.bx + t.bw / 2 + t.tx, cy: t.by + t.bh / 2 + t.ty }; };
  function xfPts() {
    const t = xf.current!; const bcx = t.bx + t.bw / 2, bcy = t.by + t.bh / 2;
    const tp = (px: number, py: number) => {
      const dx = (px - bcx) * t.scale, dy = (py - bcy) * t.scale;
      return [bcx + t.tx + dx * Math.cos(t.rot) - dy * Math.sin(t.rot), bcy + t.ty + dx * Math.sin(t.rot) + dy * Math.cos(t.rot)] as [number, number];
    };
    const c = [tp(t.bx, t.by), tp(t.bx + t.bw, t.by), tp(t.bx + t.bw, t.by + t.bh), tp(t.bx, t.by + t.bh)];
    const topMid = tp(t.bx + t.bw / 2, t.by);
    const cen = tp(bcx, bcy);
    const dx = topMid[0] - cen[0], dy = topMid[1] - cen[1], len = Math.hypot(dx, dy) || 1;
    const cr = dispRef.current?.getBoundingClientRect(); const spp = cr && cr.width ? W / cr.width : 2;
    const rot: [number, number] = [topMid[0] + dx / len * 34 * spp, topMid[1] + dy / len * 34 * spp];
    return { c, topMid, rot };
  }
  function xfApply() {
    const t = xf.current!; const bcx = t.bx + t.bw / 2, bcy = t.by + t.bh / 2;
    const c = t.target.getContext('2d')!; c.clearRect(0, 0, W, H);
    c.save(); c.translate(bcx + t.tx, bcy + t.ty); c.rotate(t.rot); c.scale(t.scale, t.scale); c.translate(-bcx, -bcy); c.drawImage(t.snap, 0, 0); c.restore();
  }
  function drawGizmo(c: CanvasRenderingContext2D) {
    const { c: pts, topMid, rot } = xfPts();
    const cr = dispRef.current?.getBoundingClientRect(); const spp = cr && cr.width ? W / cr.width : 2;
    c.save();
    c.strokeStyle = '#3b82f6'; c.lineWidth = 1.6 * spp; c.setLineDash([]);
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < 4; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(topMid[0], topMid[1]); c.lineTo(rot[0], rot[1]); c.stroke();
    c.fillStyle = '#fff'; const hs = 5 * spp;
    for (const [hx, hy] of [...pts, rot]) { c.beginPath(); c.arc(hx, hy, hs, 0, Math.PI * 2); c.fill(); c.stroke(); }
    c.restore();
  }
  function layerBounds(cv: HTMLCanvasElement) {
    const data = cv.getContext('2d')!.getImageData(0, 0, W, H).data;
    let minX = W, minY = H, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { if (data[(y * W + x) * 4 + 3] > 8) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; } }
    return { found, minX, minY, maxX, maxY };
  }
  function beginTransform(): boolean {
    const d = doc();
    const isBg = (l: Layer) => l === d.layers[0];
    // background always counts as movable content (a generated base image); other
    // layers must actually have pixels. bg is not pixel-scanned (may be cross-origin).
    const hasContent = (l: Layer) => !!xfStore.current[l.id] || (isBg(l) ? true : layerBounds(l.cv).found);
    let layer = active();
    if (!hasContent(layer)) {
      // prefer a drawn/dropped element; fall back to the background so the generated look can be moved too
      layer = [...d.layers.slice(1)].reverse().find(hasContent) ?? d.layers[0];
      d.activeId = layer.id; rerender();
    }
    const stored = xfStore.current[layer.id];
    let snap: HTMLCanvasElement, bx: number, by: number, bw: number, bh: number, tx = 0, ty = 0, scale = 1, rot = 0;
    if (stored) {
      // resume from the pristine source so off-canvas pixels were never lost
      snap = stored.src; bx = stored.bx; by = stored.by; bw = stored.bw; bh = stored.bh;
      tx = stored.tx; ty = stored.ty; scale = stored.scale; rot = stored.rot;
    } else if (isBg(layer)) {
      snap = makeCanvas('#ffffff'); try { snap.getContext('2d')!.drawImage(layer.cv, 0, 0); } catch { /* cross-origin */ }
      bx = 0; by = 0; bw = W; bh = H;
    } else {
      const b = layerBounds(layer.cv); if (!b.found) return false;
      snap = makeCanvas(); snap.getContext('2d')!.drawImage(layer.cv, 0, 0);
      bx = b.minX; by = b.minY; bw = Math.max(1, b.maxX - b.minX); bh = Math.max(1, b.maxY - b.minY);
    }
    snapshot();
    xf.current = { id: layer.id, target: layer.cv, snap, bx, by, bw, bh, tx, ty, scale, rot };
    xfStore.current[layer.id] = { src: snap, tx, ty, scale, rot, bx, by, bw, bh };
    composite(); return true;
  }
  // Delete the selected element / active layer (never the base render on layer 0).
  function deleteActiveElement() {
    const d = doc(); const layer = active();
    if (layer === d.layers[0]) return; // base render is the canvas, not a deletable element
    snapshot();
    if (d.layers.length <= 2) { layer.cv.getContext('2d')!.clearRect(0, 0, W, H); } // last element layer — clear it, keep it to draw on
    else { const i = d.layers.findIndex((l) => l.id === layer.id); d.layers.splice(i, 1); d.activeId = d.layers[Math.max(1, i - 1)].id; }
    delete xfStore.current[layer.id];
    xf.current = null; rerender(); composite(); emit();
  }
  // Rasterise a typed label onto the active layer (used to annotate a panel's material).
  function commitText() {
    if (!textEntry) return;
    const val = textVal.trim();
    if (val) {
      snapshot();
      const c = active().cv.getContext('2d')!;
      const fs = Math.max(20, size * 3.5);
      c.fillStyle = color; c.font = `600 ${fs}px ui-sans-serif, system-ui, -apple-system, sans-serif`; c.textBaseline = 'top';
      c.fillText(val, textEntry.cx, textEntry.cy);
      delete xfStore.current[active().id];
      rerender(); composite(); emit();
    }
    setTextEntry(null); setTextVal('');
  }
  // Send the current view (render + hand-drawn panels + labels) to be re-rendered with the edits applied.
  const applyEdits = () => { if (!onApplyEdits || applying || view === 'label') return; try { const url = flat().toDataURL('image/png'); setLifeMode(false); setDissolveSrc(url); onApplyEdits(view, url); } catch { /* cross-origin base can't be exported */ } };
  // render the current flattened view into a photorealistic product shot, in place.
  // snapshot the sketch first so Undo removes the generation and brings it back.
  const runBringToLife = () => { if (!onBringToLife || applying || view === 'label') return; try { snapshot(); const url = flat().toDataURL('image/png'); setLifeMode(true); setDissolveSrc(url); onBringToLife(view, url); } catch { /* cross-origin base can't be exported */ } };

  // ── label mode: the sketch minimises to a thumbnail and the pad becomes a
  // full drawing canvas for the label. "Render label" turns the drawing into a
  // real fabric label, which then carries down the pipeline. ─────────────────
  const enterLabelMode = () => {
    try { setSketchThumb(flat().toDataURL('image/png')); } catch { /* cross-origin base */ }
    setPrevView(view === 'label' ? 'front' : view);
    setLabelMode(true);
    setView('label');
  };
  const exitLabelMode = () => { setLabelMode(false); setView(prevView); };
  const renderLabel = async () => {
    if (labelRendering) return;
    let draft: string;
    try { snapshot(); draft = flat().toDataURL('image/png'); } catch { return; }
    setLabelRendering(true);
    try {
      const r = await fetch('/api/techpack/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: draft, kind: 'label-render' }) });
      const j = await r.json();
      if (j.image) onLabel?.({ brand: label?.brand ?? '', care: label?.care ?? '', image: j.image, draft });
    } catch { /* leave the drawing */ }
    setLabelRendering(false);
  };

  // Remove a plain background from the active (imported) layer: flood-fill from the
  // edges, clearing everything close to the corner colour. Reveals the white canvas.
  function removeBackground() {
    const d = doc(); const layer = active();
    if (layer === d.layers[0]) return; // never strip the base canvas itself
    const ctx = layer.cv.getContext('2d')!;
    let img: ImageData;
    try { img = ctx.getImageData(0, 0, W, H); } catch { return; } // cross-origin — can't read
    const data = img.data;
    const corners = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4];
    let br = 0, bg = 0, bb = 0, n = 0;
    for (const c of corners) if (data[c + 3] > 0) { br += data[c]; bg += data[c + 1]; bb += data[c + 2]; n++; }
    if (!n) return;
    br /= n; bg /= n; bb /= n;
    const tol = 52;
    const visited = new Uint8Array(W * H); const stack: number[] = [];
    const push = (x: number, y: number) => { if (x >= 0 && x < W && y >= 0 && y < H && !visited[y * W + x]) { visited[y * W + x] = 1; stack.push(x, y); } };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    const match = (i: number) => Math.abs(data[i] - br) <= tol && Math.abs(data[i + 1] - bg) <= tol && Math.abs(data[i + 2] - bb) <= tol;
    while (stack.length) {
      const y = stack.pop()!, x = stack.pop()!, i = (y * W + x) * 4;
      if (data[i + 3] === 0 || !match(i)) continue;
      data[i + 3] = 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    snapshot();
    ctx.putImageData(img, 0, 0);
    delete xfStore.current[layer.id];
    rerender(); composite(); emit();
  }
  const pointInQuad = (p: { x: number; y: number }, q: [number, number][]) => {
    let inside = false;
    for (let i = 0, j = 3; i < 4; j = i++) {
      const xi = q[i][0], yi = q[i][1], xj = q[j][0], yj = q[j][1];
      if (((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  };

  // Before the browser mounts (SSR + first client render) render an inert shell —
  // doc()/makeCanvas touch `document`, which does not exist on the server.
  if (!mounted) return <div className="peditor" aria-hidden="true" />;

  const d = doc();
  const act = d.layers.find((l) => l.id === d.activeId) ?? d.layers[d.layers.length - 1];

  // MINIMAL PAD — a floating 4:5 card that pops out on the side. Front/Back/Side
  // sit above it, a small toolbar below; the rest of the canvas stays visible and
  // pannable around it. The full Photoshop workspace lives behind the expand button.
  if (!full) {
    const simple = TOOLS.filter((t) => SIMPLE_TOOLS.has(t.key));
    const dotD = Math.max(5, Math.min(18, 5 + size / 8));
    return (
      <div className={`pe-min${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="pe-min-shell nowheel nopan nodrag" ref={minShellRef}>
          <div className="pe-min-head">
            <div className="pe-min-views">
              {labelMode
                ? <span className="pe-min-labeltag">Label</span>
                : VIEWS.map((v) => (
                    <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); onViewChange?.(v); }}>{v}</button>
                  ))}
            </div>
            <div className="pe-min-meta">
              {onApplyEdits && (
                <button className="pe-min-apply" title={applying ? 'Applying edits…' : 'Apply drawn edits — re-render this view with the new panels / materials / shape'} aria-label="Apply edits" onClick={applyEdits} disabled={applying}>
                  {applying ? <span className="pe-min-spin" /> : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18 15 9M13 7l4 4M18 3l.6 2.4L21 6l-2.4.6L18 9l-.6-2.4L15 6l2.4-.6z" /></svg>
                  )}
                </button>
              )}
              <button className="pe-min-x" title="Upload an image" aria-label="Upload an image onto the canvas" onClick={() => fileRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M8 8l4-4 4 4M4 20h16" /></svg>
              </button>
              <button className="pe-min-x" title="Full workspace" aria-label="Expand to full workspace" onClick={() => setFull(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
              </button>
              {onLabel && (
                <button className={`pe-min-x${label?.image ? ' has' : ''}${labelMode ? ' on' : ''}`} title="Design your brand / care label" aria-label="Design label" onClick={() => (labelMode ? exitLabelMode() : enterLabelMode())}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V4a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6z" /><circle cx="7.5" cy="7.5" r="1.3" /></svg>
                </button>
              )}
              {labelMode ? (
                <button className="pe-min-life" title="Render this drawing into a real fabric label" onClick={renderLabel} disabled={labelRendering}>
                  {labelRendering ? 'Rendering…' : 'Render label'}
                </button>
              ) : onBringToLife && (
                <button className="pe-min-life" title="Render this sketch into a photorealistic product shot" onClick={runBringToLife}>
                  Render sketch
                </button>
              )}
            </div>
          </div>

          <div
            className={`pe-min-stage${dropping ? ' dropping' : ''}${tool === 'transform' ? ' xf' : ''}`} ref={stageRef}
            onDragOver={(e) => { e.preventDefault(); if (!dropping) setDropping(true); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false); }}
            onDrop={(e) => { e.preventDefault(); setDropping(false); importImage(e.dataTransfer.files?.[0]); }}
          >
            <div className="pe-min-pan" style={{ transform: `translate(${mpan.x}px, ${mpan.y}px) scale(${mz})` }}>
              <canvas
                ref={dispRef} width={W} height={H} className="pe-min-canvas"
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              />
            </div>
            <div className="pe-min-drop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M8 8l4-4 4 4M4 20h16" /></svg><span>Drop image</span></div>
            {textEntry && (
              <input className="pe-text-entry nodrag" ref={textInputRef} value={textVal}
                style={{ left: textEntry.sx, top: textEntry.sy, color }}
                onChange={(e) => setTextVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitText(); } else if (e.key === 'Escape') { e.preventDefault(); setTextEntry(null); setTextVal(''); } }}
                onBlur={commitText}
                placeholder="label (e.g. mesh)…" />
            )}
            {dissolve && (
              <div className="pe-min-applying">
                <FaceIdDissolve src={dissolveSrc} active={!!applying} />
                <span className="pe-faceid-label">{applying ? (lifeMode ? 'rendering…' : 'applying edits…') : 'assembling…'}</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { importImage(e.target.files?.[0]); e.currentTarget.value = ''; }} />

            {labelMode && sketchThumb && (
              <button className="pe-label-thumb nodrag" onPointerDown={(e) => e.stopPropagation()} onClick={exitLabelMode} title="Back to your sketch">
                <img src={sketchThumb} alt="sketch" /><span>Sketch</span>
              </button>
            )}
            {labelRendering && (
              <div className="pe-min-applying"><span className="pe-min-spin" /><span className="pe-faceid-label">rendering label…</span></div>
            )}
          </div>

          <div className="pe-min-bar">
            <button className="pe-min-b pe-min-ur" onClick={undo} title="Undo" aria-label="Undo">
              <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a4.5 4.5 0 0 1 0 9H8" /></svg>
            </button>
            <button className="pe-min-b pe-min-ur" onClick={redo} title="Redo" aria-label="Redo">
              <svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a4.5 4.5 0 0 0 0 9H16" /></svg>
            </button>
            <span className="pe-min-sep" />
            {simple.map((t) => (
              <button key={t.key} className={`pe-min-b${tool === t.key ? ' on' : ''}`} title={t.label} onClick={() => setTool(t.key)}>
                <svg viewBox="0 0 24 24"><path d={t.icon} /></svg>
              </button>
            ))}
            <span className="pe-min-sep" />
            <div className="pe-min-pop-wrap">
              <button className={`pe-min-b pe-min-color${wheelOpen ? ' on' : ''}`} title="Colour" onClick={() => { setWheelOpen((o) => !o); setSizeOpen(false); setLayersOpen(false); }}>
                <span className="pe-min-chip" style={{ background: color }} />
              </button>
              {wheelOpen && <div className="pe-min-pop"><ColorWheel value={color} onChange={(c) => { setColor(c); if (tool === 'eraser') setTool('brush'); }} /></div>}
            </div>
            <div className="pe-min-pop-wrap">
              <button className={`pe-min-b${sizeOpen ? ' on' : ''}`} title="Brush size" onClick={() => { setSizeOpen((o) => !o); setWheelOpen(false); setLayersOpen(false); }}>
                <span className="pe-min-dot" style={{ width: dotD, height: dotD }} />
              </button>
              {sizeOpen && (
                <div className="pe-min-pop pe-min-sizepop">
                  <input type="range" min={1} max={120} value={size} onChange={(e) => setSize(+e.target.value)} />
                  <b>{size}</b>
                </div>
              )}
            </div>
            <div className="pe-min-pop-wrap">
              <button className={`pe-min-b${layersOpen ? ' on' : ''}`} title="Layers" aria-label="Layers" onClick={() => { setLayersOpen((o) => !o); setWheelOpen(false); setSizeOpen(false); }}>
                <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></svg>
              </button>
              {layersOpen && (
                <div className="pe-min-pop pe-min-layerspop">
                  <div className="pe-ml-head">
                    <span>Layers</span>
                    <span className="pe-ml-acts">
                      <button onClick={addLayer} title="New layer"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>
                      <button onClick={removeBackground} title="Remove background (active layer)"><svg viewBox="0 0 24 24"><circle cx="6.5" cy="6.5" r="2.6" /><circle cx="6.5" cy="17.5" r="2.6" /><path d="M20 5 9 13M9 11l11 8" /></svg></button>
                      <button onClick={() => moveLayer(1)} title="Move up"><svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6" /></svg></button>
                      <button onClick={() => moveLayer(-1)} title="Move down"><svg viewBox="0 0 24 24"><path d="M6 10l6 6 6-6" /></svg></button>
                      <button onClick={delLayer} title="Delete layer"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" /></svg></button>
                    </span>
                  </div>
                  <div className="pe-ml-list nowheel">
                    {[...d.layers].reverse().map((l) => (
                      <div key={l.id} className={`pe-ml-row${l.id === d.activeId ? ' on' : ''}`} onClick={() => setActive(l.id)}>
                        <button className="pe-ml-eye" onClick={(e) => { e.stopPropagation(); toggleVis(l.id); }} title={l.visible ? 'Hide' : 'Show'}>
                          {l.visible
                            ? <svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                            : <svg viewBox="0 0 24 24" opacity="0.5"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 2.9M6.6 6.6A13 13 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 3.4-.6" /></svg>}
                        </button>
                        <canvas className="pe-ml-thumb" width={34} height={42} ref={(el) => { if (!el) return; const tc = el.getContext('2d'); if (!tc) return; tc.clearRect(0, 0, 34, 42); try { tc.drawImage(l.cv, 0, 0, 34, 42); } catch { /* tainted layer — skip */ } }} />
                        <span className="pe-ml-name">{l.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`peditor${open ? ' open' : ''}${full ? ' full' : ''}`} aria-hidden={!open}>
      <div className="pe-top">
        <span className="pe-title">Sketch studio</span>
        <div className="pe-views">
          {VIEWS.map((v) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); onViewChange?.(v); }}>{v}{views[v] ? ' •' : ''}</button>
          ))}
        </div>
        <div className="pe-top-r">
          <button onClick={undo} title="Undo (⌘Z)">↶</button>
          <button onClick={redo} title="Redo">↷</button>
          <span className="pe-zoom">
            <button onClick={() => setZoom((z) => Math.max(0.15, z - 0.12))}>−</button>
            <b>{Math.round(zoom * 100)}%</b>
            <button onClick={() => setZoom((z) => Math.min(4, z + 0.12))}>+</button>
          </span>
          <button onClick={() => setFull((f) => !f)} title={full ? 'Exit full screen' : 'Full screen'}>
            {full
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m13-5h-3a2 2 0 0 0-2 2v3" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>}
          </button>
          {onBringToLife && (
            <button className="pe-life" title="Render this sketch into a photorealistic product shot" onClick={runBringToLife}>
              Render sketch
            </button>
          )}
          <button className="pe-done" onClick={() => onClose()}>Done</button>
        </div>
      </div>

      <div className="pe-body">
        <div className="pe-rail">
          {(full ? TOOLS : TOOLS.filter((t) => SIMPLE_TOOLS.has(t.key))).map((t) => (
            <button key={t.key} className={`pe-tool${tool === t.key ? ' on' : ''}`} title={t.label} onClick={() => setTool(t.key)}>
              <svg viewBox="0 0 24 24"><path d={t.icon} /></svg>
            </button>
          ))}
          {full && (
            <>
              <div className="pe-rail-sp" />
              <button className="pe-tool" title="Import image" onClick={() => fileRef.current?.click()}>
                <svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M4 20h16" /></svg>
              </button>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { importImage(e.target.files?.[0]); e.currentTarget.value = ''; }} />
        </div>

        <div className="pe-stage" ref={stageRef} onWheel={onWheel}>
          <div className="pe-canvas-wrap" style={{ width: W * zoom, height: H * zoom }}>
            <canvas
              ref={dispRef} width={W} height={H} className="pe-canvas" style={{ width: W * zoom, height: H * zoom }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            />
          </div>
        </div>

        <div className="pe-side">
          <div className="pe-panel">
            <div className="pe-ph">Color</div>
            {full ? (
              <>
                <div className="pe-color-row">
                  <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === 'eraser') setTool('brush'); }} className="pe-color" />
                  <input className="pe-hex" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
                <div className="pe-swatches">
                  {SWATCHES.map((c) => <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => { setColor(c); if (tool === 'eraser') setTool('brush'); }} />)}
                </div>
                {recent.length > 0 && <div className="pe-swatches recent">{recent.map((c, i) => <button key={i} style={{ background: c }} onClick={() => setColor(c)} />)}</div>}
              </>
            ) : (
              <ColorWheel value={color} onChange={(c) => { setColor(c); if (tool === 'eraser') setTool('brush'); }} />
            )}
          </div>

          <div className="pe-panel">
            <div className="pe-ph">Brush</div>
            <label className="pe-slider"><span>Size</span><input type="range" min={1} max={120} value={size} onChange={(e) => setSize(+e.target.value)} /><b>{size}</b></label>
            {full && (
              <>
                <label className="pe-slider"><span>Opacity</span><input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)} /><b>{opacity}</b></label>
                <label className="pe-slider"><span>Hardness</span><input type="range" min={0} max={100} value={hardness} onChange={(e) => setHardness(+e.target.value)} /><b>{hardness}</b></label>
                {(tool === 'rect' || tool === 'ellipse') && (
                  <div className="pe-fillmode">
                    <button className={fillShape ? 'on' : ''} onClick={() => setFillShape(true)}>Fill</button>
                    <button className={!fillShape ? 'on' : ''} onClick={() => setFillShape(false)}>Stroke</button>
                  </div>
                )}
              </>
            )}
          </div>

          {full && (
          <div className="pe-panel pe-layers">
            <div className="pe-ph">Layers
              <span className="pe-layer-actions">
                <button onClick={addLayer} title="New layer">＋</button>
                <button onClick={dupLayer} title="Duplicate">⧉</button>
                <button onClick={() => moveLayer(1)} title="Up">↑</button>
                <button onClick={() => moveLayer(-1)} title="Down">↓</button>
                <button onClick={delLayer} title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13" /></svg></button>
              </span>
            </div>
            <label className="pe-slider sm"><span>Opacity</span><input type="range" min={0} max={100} value={Math.round(act.opacity * 100)} onChange={(e) => setLayerOpacity(+e.target.value)} /><b>{Math.round(act.opacity * 100)}</b></label>
            <select className="pe-blend" value={act.blend} onChange={(e) => setLayerBlend(e.target.value as Blend)}>
              {BLENDS.map((b) => <option key={b} value={b}>{BLEND_LABEL[b]}</option>)}
            </select>
            <div className="pe-layer-list">
              {[...d.layers].reverse().map((l) => (
                <div key={l.id} className={`pe-layer${l.id === d.activeId ? ' on' : ''}`} onClick={() => setActive(l.id)}>
                  <button className="pe-eye" onClick={(e) => { e.stopPropagation(); toggleVis(l.id); }} title={l.visible ? 'Hide' : 'Show'}>
                    {l.visible
                      ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"><path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a13 13 0 0 1-2.2 2.9M6.6 6.6A13 13 0 0 0 2 12s3.5 7 10 7a9.8 9.8 0 0 0 3.4-.6" /></svg>}
                  </button>
                  <input className="pe-lname" value={l.name} onClick={(e) => e.stopPropagation()} onChange={(e) => rename(l.id, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
