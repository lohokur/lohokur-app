'use client';

import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react';
import { VIEWS, type View } from '@/lib/nodeTypes';

const W = 1000, H = 750;
type Tool = 'brush' | 'pencil' | 'eraser' | 'fill' | 'eyedropper' | 'line' | 'rect' | 'ellipse' | 'move' | 'hand';
type Blend = 'source-over' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'hard-light' | 'soft-light' | 'difference';
type Layer = { id: string; name: string; visible: boolean; opacity: number; blend: Blend; cv: HTMLCanvasElement };
type Doc = { layers: Layer[]; activeId: string };
type Snap = { layers: { id: string; name: string; visible: boolean; opacity: number; blend: Blend; url: string }[]; activeId: string };

const BLENDS: Blend[] = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'hard-light', 'soft-light', 'difference'];
const BLEND_LABEL: Record<Blend, string> = { 'source-over': 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken', lighten: 'Lighten', 'color-dodge': 'Dodge', 'hard-light': 'Hard light', 'soft-light': 'Soft light', difference: 'Difference' };
const SWATCHES = ['#141414', '#ffffff', '#e5484d', '#f5a623', '#eab308', '#22c55e', '#0ea5e9', '#3b82f6', '#8b5cf6', '#ec4899', '#a9784b', '#8b98a5'];
const TOOLS: { key: Tool; label: string; icon: string }[] = [
  { key: 'move', label: 'Move (V)', icon: 'M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3' },
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
  open, nodeId, views, onView, onClose, initialView = 'front', onViewChange,
}: {
  open: boolean;
  nodeId: string | null;
  views: Partial<Record<View, string>>;
  onView: (view: View, dataUrl: string) => void;
  onClose: () => void;
  initialView?: View; // which view to open on (F/S/B clicked on the node)
  onViewChange?: (view: View) => void; // reflect the pad's F/S/B on the node card
}) {
  const docs = useRef<Partial<Record<View, Doc>>>({});
  const undoStack = useRef<Partial<Record<View, Snap[]>>>({});
  const redoStack = useRef<Partial<Record<View, Snap[]>>>({});
  const loadedSrc = useRef<Partial<Record<View, string>>>({}); // which image is painted into each view's background
  const dispRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<View>('front');
  const [full, setFull] = useState(false);
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
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

  const drawing = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const lastP = useRef({ x: 0, y: 0 });
  const moveSnap = useRef<HTMLCanvasElement | null>(null);
  const panning = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

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
    for (const l of doc().layers) {
      if (!l.visible) continue;
      c.globalAlpha = l.opacity; c.globalCompositeOperation = l.blend;
      c.drawImage(l.cv, 0, 0);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    extra?.(c);
  }
  function flat(): HTMLCanvasElement {
    const out = makeCanvas();
    const c = out.getContext('2d')!;
    for (const l of doc().layers) { if (!l.visible) continue; c.globalAlpha = l.opacity; c.globalCompositeOperation = l.blend; c.drawImage(l.cv, 0, 0); }
    return out;
  }
  const emit = () => {
    const url = flat().toDataURL('image/png');
    loadedSrc.current[view] = url; // we just wrote this; don't let the load effect reload/clobber the strokes
    onView(view, url);
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
    docs.current = {}; undoStack.current = {}; redoStack.current = {}; loadedSrc.current = {};
    if (open) setView(initialView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, open, initialView]);

  // load the saved image for the current view into its background layer, then
  // paint. Runs whenever the view or the incoming views change, and tracks what
  // it loaded so a doc created before `views` was ready still gets its image.
  useEffect(() => {
    if (!open) return;
    const src = views[view];
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
  }, [open, nodeId, view, views]);

  const fit = () => {
    const st = stageRef.current; if (!st) return;
    const z = Math.min((st.clientWidth - 44) / W, (st.clientHeight - 44) / H);
    setZoom(Math.max(0.12, Math.min(1.6, z)));
  };
  useEffect(() => { if (!open) return; const id = requestAnimationFrame(fit); return () => cancelAnimationFrame(id); /* eslint-disable-next-line */ }, [open, full]);

  const pushRecent = (c: string) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 8));

  const pt = (e: RPE) => {
    const r = dispRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  };

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
    if (tool === 'hand') { const st = stageRef.current!; panning.current = { x: e.clientX, y: e.clientY, sl: st.scrollLeft, st: st.scrollTop }; return; }
    if (tool === 'eyedropper') { const c = dispRef.current!.getContext('2d')!; const d = c.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; const hex = '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join(''); setColor(hex); pushRecent(hex); return; }
    if (tool === 'fill') { snapshot(); floodFill(p); composite(); emit(); return; }
    drawing.current = true;
    if (tool === 'move') { moveSnap.current = makeCanvas(); moveSnap.current.getContext('2d')!.drawImage(active().cv, 0, 0); snapshot(); return; }
    if (tool === 'brush' || tool === 'pencil') { const b = buf().getContext('2d')!; b.clearRect(0, 0, W, H); }
    if (tool === 'eraser') { snapshot(); }
  };

  const move = (e: RPE) => {
    if (tool === 'hand' && panning.current) { const st = stageRef.current!; st.scrollLeft = panning.current.sl - (e.clientX - panning.current.x); st.scrollTop = panning.current.st - (e.clientY - panning.current.y); return; }
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
    if (!drawing.current) return; drawing.current = false;
    const p = lastP.current;
    if (tool === 'brush' || tool === 'pencil') { snapshot(); const c = active().cv.getContext('2d')!; c.globalAlpha = opacity / 100; c.drawImage(buf(), 0, 0); c.globalAlpha = 1; pushRecent(color); }
    else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') { snapshot(); drawShape(active().cv.getContext('2d')!, start.current, p); pushRecent(color); }
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
    img.onload = () => { snapshot(); const cv = makeCanvas(); const s = Math.min(W / img.width, H / img.height); cv.getContext('2d')!.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); const d = doc(); const l: Layer = { id: nid(), name: f.name.slice(0, 16), visible: true, opacity: 1, blend: 'source-over', cv }; d.layers.push(l); d.activeId = l.id; rerender(); composite(); emit(); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };

  const onWheel = (e: React.WheelEvent) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(4, Math.max(0.15, z - e.deltaY * 0.001))); } };

  // Before the browser mounts (SSR + first client render) render an inert shell —
  // doc()/makeCanvas touch `document`, which does not exist on the server.
  if (!mounted) return <div className="peditor" aria-hidden="true" />;

  const d = doc();
  const act = d.layers.find((l) => l.id === d.activeId) ?? d.layers[d.layers.length - 1];

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
          <button className="pe-done" onClick={() => onClose()}>Done</button>
        </div>
      </div>

      <div className="pe-body">
        <div className="pe-rail">
          {TOOLS.map((t) => (
            <button key={t.key} className={`pe-tool${tool === t.key ? ' on' : ''}`} title={t.label} onClick={() => setTool(t.key)}>
              <svg viewBox="0 0 24 24"><path d={t.icon} /></svg>
            </button>
          ))}
          <div className="pe-rail-sp" />
          <button className="pe-tool" title="Import image" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M4 20h16" /></svg>
          </button>
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
            <div className="pe-color-row">
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === 'eraser') setTool('brush'); }} className="pe-color" />
              <input className="pe-hex" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
            <div className="pe-swatches">
              {SWATCHES.map((c) => <button key={c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => { setColor(c); if (tool === 'eraser') setTool('brush'); }} />)}
            </div>
            {recent.length > 0 && <div className="pe-swatches recent">{recent.map((c, i) => <button key={i} style={{ background: c }} onClick={() => setColor(c)} />)}</div>}
          </div>

          <div className="pe-panel">
            <div className="pe-ph">Brush</div>
            <label className="pe-slider"><span>Size</span><input type="range" min={1} max={120} value={size} onChange={(e) => setSize(+e.target.value)} /><b>{size}</b></label>
            <label className="pe-slider"><span>Opacity</span><input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)} /><b>{opacity}</b></label>
            <label className="pe-slider"><span>Hardness</span><input type="range" min={0} max={100} value={hardness} onChange={(e) => setHardness(+e.target.value)} /><b>{hardness}</b></label>
            {(tool === 'rect' || tool === 'ellipse') && (
              <div className="pe-fillmode">
                <button className={fillShape ? 'on' : ''} onClick={() => setFillShape(true)}>Fill</button>
                <button className={!fillShape ? 'on' : ''} onClick={() => setFillShape(false)}>Stroke</button>
              </div>
            )}
          </div>

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
        </div>
      </div>
    </div>
  );
}
