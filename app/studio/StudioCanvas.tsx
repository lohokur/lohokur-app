'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  SelectionMode,
  type ReactFlowInstance,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Link from 'next/link';
import StageNode from '@/components/StageNode';
import SketchNode from '@/components/SketchNode';
import VisualiseNode from '@/components/VisualiseNode';
import PatternNode from '@/components/PatternNode';
import TechpackNode from '@/components/TechpackNode';
import ManufactureNode from '@/components/ManufactureNode';
import SampleNode from '@/components/SampleNode';
import ExtractNode from '@/components/ExtractNode';
import StudioNode from '@/components/StudioNode';
import ImageNode from '@/components/ImageNode';
import WireEdge from '@/components/WireEdge';
import DotField from '@/components/DotField';
import SketchStudio from '@/components/SketchStudio';
import StudioLoader from '@/components/StudioLoader';
import StudioTopbar from '@/components/StudioTopbar';
import StudioDock from '@/components/StudioDock';
import StudioLibrary, { type LibItem } from '@/components/StudioLibrary';
import { useRouter } from 'next/navigation';
import TechpackPanel from '@/components/TechpackPanel';
import ExtractPanel from '@/components/ExtractPanel';
import PatternProtoPanel from '@/components/PatternProtoPanel';
import ManufacturePanel from '@/components/ManufacturePanel';
import SamplePanel from '@/components/SamplePanel';
import { StudioContext } from '@/lib/studio-context';
import { STAGES, NEXT, VIEWS, type StageKey, type View } from '@/lib/nodeTypes';
import type { Techpack } from '@/lib/techpack';
import type { ChosenManufacturer } from '@/lib/manufacturers';
import type { Sample } from '@/lib/sample';
import { getProject, saveProject, createProject } from '@/lib/client-store';
import type { Project } from '@/lib/types';

const nodeTypes = {
  stage: StageNode,
  sketch: SketchNode,
  visualise: VisualiseNode,
  studio: StudioNode,
  image: ImageNode,
  extract: ExtractNode,
  pattern: PatternNode,
  techpack: TechpackNode,
  sample: SampleNode,
  manufacture: ManufactureNode,
};
const CUSTOM: Record<string, string> = { sketch: 'sketch', visualise: 'visualise', studio: 'studio', image: 'image', extract: 'extract', pattern: 'pattern', techpack: 'techpack', sample: 'sample', manufacture: 'manufacture' };
const edgeTypes = { wire: WireEdge };
let counter = 1;

async function urlToDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  const b = await r.blob();
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });
}

export default function StudioCanvas({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editing, setEditing] = useState<string | null>(null);
  const [editingTechpack, setEditingTechpack] = useState<string | null>(null);
  const [editingExtract, setEditingExtract] = useState<string | null>(null);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [editingManufacture, setEditingManufacture] = useState<string | null>(null);
  const [editingSample, setEditingSample] = useState<string | null>(null);
  const dirty = useRef(false);
  const loaded = useRef(false);
  const [booting, setBooting] = useState(true);
  const [dataProg, setDataProg] = useState(0.08); // real data-load progress, 0.08 → 0.9
  const [canvasReady, setCanvasReady] = useState(false); // ReactFlow onInit fired
  const rf = useRef<ReactFlowInstance | null>(null); // React Flow instance (for viewport math)
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 }); // live React Flow viewport for the dot field
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // lightweight undo/redo history of the flow (nodes + edges)
  const hist = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const hIdx = useRef(-1);
  const applying = useRef(false); // true while an undo/redo is being applied
  const [histMeta, setHistMeta] = useState({ undo: false, redo: false });
  const syncHist = useCallback(() => setHistMeta({ undo: hIdx.current > 0, redo: hIdx.current < hist.current.length - 1 }), []);

  // Loader progress reflects actual work: the data phase fills to 0.9, and the
  // final 0.1 lands only once the canvas has mounted. Never a fixed timer.
  const dataDone = dataProg >= 0.9;
  const progress = dataDone && canvasReady ? 1 : Math.min(dataProg, 0.9);

  useEffect(() => {
    let cancelled = false;
    setDataProg(0.15); // fetch started
    getProject(projectId).then(async (p) => {
      if (cancelled) return;
      setProject(p);
      setDataProg(0.5); // project fetched
      if (p) {
        const ns = (p.flow?.nodes as Node[]) ?? [];
        const es = ((p.flow?.edges as Edge[]) ?? []).map((e) => ({ ...e, type: 'wire' as const, animated: false }));
        setNodes(ns);
        setEdges(es);
        hist.current = [{ nodes: ns, edges: es }]; // history baseline
        hIdx.current = 0;
        syncHist();
        setDataProg(0.6); // nodes/edges hydrated
        // preload every image the nodes reference so the canvas paints instantly
        const urls: string[] = [];
        for (const n of ns) {
          const d = n.data as { image?: string; views?: Record<string, string> } | undefined;
          if (d?.image) urls.push(d.image);
          if (d?.views) for (const v of Object.values(d.views)) if (typeof v === 'string') urls.push(v);
        }
        if (urls.length) {
          let n = 0;
          await Promise.all(urls.map((src) => new Promise<void>((res) => {
            const im = new Image();
            const fin = () => { n++; if (!cancelled) setDataProg(0.6 + (n / urls.length) * 0.3); res(); };
            im.onload = fin; im.onerror = fin; im.src = src;
          })));
        }
      }
      if (!cancelled) { setDataProg(0.9); loaded.current = true; }
    });
    // safety net: never let the loader hang if an image or onInit never resolves
    const bail = setTimeout(() => { if (!cancelled) { setDataProg(0.9); setCanvasReady(true); } }, 6000);
    return () => { cancelled = true; clearTimeout(bail); };
  }, [projectId, setNodes, setEdges, syncHist]);

  // live refs for validation / lookups (avoids stale closures)
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  const typeOf = (id?: string | null) =>
    (nodesRef.current.find((n) => n.id === id)?.data as { type?: StageKey } | undefined)?.type;

  const setNodeData = useCallback(
    (id: string, patch: Record<string, unknown>) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))),
    [setNodes]
  );

  // Visualise: BATCH — render each connected sketch view (front, then side, then back) on the base
  const visualise = useCallback(
    async (id: string) => {
      const edge = edgesRef.current.find((e) => e.target === id);
      const src = edge ? nodesRef.current.find((n) => n.id === edge.source) : undefined;
      const sd = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
      const sviews: Partial<Record<View, string>> = sd?.views ?? (sd?.image ? { front: sd.image } : {});
      const present = VIEWS.filter((v) => sviews[v]);
      if (!present.length) {
        setNodeData(id, { note: 'connect a sketch first' });
        setTimeout(() => setNodeData(id, { note: undefined }), 2600);
        return;
      }
      const base = await urlToDataUrl('/base.jpg');
      const out: Partial<Record<View, string>> = {};
      setNodeData(id, { loading: true, note: undefined, views: {}, image: undefined });
      for (let i = 0; i < present.length; i++) {
        const view = present[i];
        setNodeData(id, { loading: true, note: `rendering ${view}… (${i + 1}/${present.length})` });
        try {
          const r = await fetch('/api/visualise', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sketch: sviews[view], base, view }),
          });
          const j = await r.json();
          if (j.image) {
            out[view] = j.image;
            setNodeData(id, { views: { ...out }, image: out.front ?? out[view], loading: true });
          }
        } catch {
          /* keep going with the other views */
        }
      }
      const any = Object.keys(out).length > 0;
      setNodeData(id, {
        views: out,
        image: out.front ?? Object.values(out)[0],
        loading: false,
        note: any ? undefined : 'render failed',
      });
    },
    [setNodeData]
  );

  // enforce the strict pipeline order: only <stage> → NEXT[stage] is allowed
  const isValidConnection = useCallback((c: Connection | Edge) => {
    const s = typeOf(c.source);
    const t = typeOf(c.target);
    return !!s && !!t && !!NEXT[s]?.includes(t);
  }, []);

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, type: 'wire' }, es)),
    [setEdges]
  );

  const openSketch = useCallback((id: string) => setEditing(id), []);
  const openTechpack = useCallback((id: string) => setEditingTechpack(id), []);
  const openExtract = useCallback((id: string) => setEditingExtract(id), []);
  const openPattern = useCallback((id: string) => setEditingPattern(id), []);
  const openManufacture = useCallback((id: string) => setEditingManufacture(id), []);
  const openSample = useCallback((id: string) => setEditingSample(id), []);
  const setNodeImage = useCallback(
    (id: string, image: string) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, image } } : n))),
    [setNodes]
  );

  // store a sketch per view (front/side/back); front also mirrors to `image` for the card
  const setNodeView = useCallback(
    (id: string, view: View, url: string) =>
      setNodes((ns) =>
        ns.map((n) => {
          if (n.id !== id) return n;
          const views = { ...(n.data as { views?: Record<string, string> }).views, [view]: url };
          return { ...n, data: { ...n.data, views, ...(view === 'front' ? { image: url } : {}) } };
        })
      ),
    [setNodes]
  );

  const addNode = useCallback(
    (type: StageKey) => {
      const id = `${type}-${Date.now().toString(36)}-${counter++}`;
      const nt = CUSTOM[type] ?? 'stage';
      // spawn at the centre of what the user is currently looking at, so it's always in view
      const inst = rf.current;
      const center = inst?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      const position = center ? { x: center.x - 190, y: center.y - 70 } : { x: 160, y: 120 };
      setNodes((ns) => [
        ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
        { id, type: nt, position, data: { type }, selected: true, className: 'spawn-flash' },
      ]);
      // clear the flash class once the pulse has played
      setTimeout(() => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, className: undefined } : n))), 1100);
      if (type === 'sketch') setEditing(id); // drop it on the canvas AND open the pad
    },
    [setNodes]
  );

  // drop an image straight onto the canvas (paste / upload) as a ready Image node
  const addImageNode = useCallback((image: string) => {
    const id = `image-${Date.now().toString(36)}-${counter++}`;
    const center = rf.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = center ? { x: center.x - 190, y: center.y - 70 } : { x: 160, y: 120 };
    setNodes((ns) => [
      ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
      { id, type: 'image', position, data: { type: 'image', image }, selected: true, className: 'spawn-flash' },
    ]);
    setTimeout(() => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, className: undefined } : n))), 1100);
  }, [setNodes]);

  // paste an image anywhere on the canvas → new Image node (ignored while typing)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      for (const item of Array.from(e.clipboardData?.items ?? [])) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const r = new FileReader();
          r.onload = () => addImageNode(r.result as string);
          r.readAsDataURL(file);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addImageNode]);

  // AI image: text-to-image, or transform/rebrand every image wired into this node
  const promptImage = useCallback(async (id: string, prompt: string) => {
    const inputs: string[] = [];
    for (const e of edgesRef.current) {
      if (e.target !== id) continue;
      const src = nodesRef.current.find((n) => n.id === e.source);
      const sd = src?.data as { image?: string; views?: Record<string, string> } | undefined;
      const img = sd?.image ?? sd?.views?.front;
      if (img) inputs.push(img);
    }
    setNodeData(id, { loading: true, note: 'generating…', prompt });
    try {
      const res = await fetch('/api/imagine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, images: inputs }),
      });
      const j = await res.json();
      if (j.image) setNodeData(id, { image: j.image, loading: false, note: undefined, prompt });
      else setNodeData(id, { loading: false, note: j.error || 'no image returned' });
    } catch (err) {
      setNodeData(id, { loading: false, note: (err as Error).message || 'generation failed' });
    }
  }, [setNodeData]);

  const save = useCallback(async () => {
    if (!loaded.current) return;
    setStatus('saving');
    await saveProject(projectId, { flow: { nodes, edges } });
    dirty.current = false;
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 1400);
  }, [projectId, nodes, edges]);

  useEffect(() => {
    if (!loaded.current) return;
    dirty.current = true;
    const t = setTimeout(() => {
      if (dirty.current) save();
    }, 1200);
    return () => clearTimeout(t);
  }, [nodes, edges, save]);

  // record a history snapshot when the flow settles (skip the change caused by undo/redo itself)
  useEffect(() => {
    if (!loaded.current) return;
    if (applying.current) { applying.current = false; syncHist(); return; }
    const t = setTimeout(() => {
      hist.current = hist.current.slice(0, hIdx.current + 1);
      hist.current.push({ nodes, edges });
      if (hist.current.length > 60) hist.current.shift();
      hIdx.current = hist.current.length - 1;
      syncHist();
    }, 500);
    return () => clearTimeout(t);
  }, [nodes, edges, syncHist]);

  // if a node with an open editor gets deleted, close that editor
  useEffect(() => {
    const ids = new Set(nodes.map((n) => n.id));
    if (editing && !ids.has(editing)) setEditing(null);
    if (editingTechpack && !ids.has(editingTechpack)) setEditingTechpack(null);
    if (editingExtract && !ids.has(editingExtract)) setEditingExtract(null);
    if (editingPattern && !ids.has(editingPattern)) setEditingPattern(null);
    if (editingManufacture && !ids.has(editingManufacture)) setEditingManufacture(null);
    if (editingSample && !ids.has(editingSample)) setEditingSample(null);
  }, [nodes, editing, editingTechpack, editingExtract, editingPattern, editingManufacture, editingSample]);

  const undo = useCallback(() => {
    if (hIdx.current <= 0) return;
    applying.current = true;
    hIdx.current -= 1;
    const s = hist.current[hIdx.current];
    setNodes(s.nodes); setEdges(s.edges);
    syncHist();
  }, [setNodes, setEdges, syncHist]);

  const redo = useCallback(() => {
    if (hIdx.current >= hist.current.length - 1) return;
    applying.current = true;
    hIdx.current += 1;
    const s = hist.current[hIdx.current];
    setNodes(s.nodes); setEdges(s.edges);
    syncHist();
  }, [setNodes, setEdges, syncHist]);

  // ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z (or Ctrl+Y) redo — ignored while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const renameProject = useCallback(async (name: string) => {
    setProject((p) => (p ? { ...p, name } : p));
    await saveProject(projectId, { name });
  }, [projectId]);

  const newProject = useCallback(async () => {
    const p = await createProject('Untitled');
    router.push(`/studio/${p.id}`);
  }, [router]);

  const duplicateProject = useCallback(async () => {
    const p = await createProject(`${project?.name ?? 'Untitled'} copy`);
    await saveProject(p.id, { flow: { nodes, edges } });
    router.push(`/studio/${p.id}`);
  }, [project, nodes, edges, router]);

  const statusLabel = useMemo(
    () => (status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save'),
    [status]
  );

  // every image made on this canvas (sketches, visualisations, extracts, …) for the Library
  const libItems = useMemo<LibItem[]>(() => {
    const KIND: Record<string, string> = {
      sketch: 'Sketch', visualise: 'Visualisation', extract: 'Extract',
      pattern: 'Pattern', techpack: 'Techpack', sample: 'Sample', manufacture: 'Manufacture',
    };
    const seen = new Set<string>();
    const out: LibItem[] = [];
    for (const n of nodes) {
      const d = n.data as { image?: string; views?: Record<string, string>; type?: string } | undefined;
      const kind = KIND[d?.type ?? ''] ?? 'Media';
      const urls: string[] = [];
      if (d?.views) for (const u of Object.values(d.views)) if (typeof u === 'string') urls.push(u);
      if (typeof d?.image === 'string') urls.push(d.image);
      for (const u of urls) {
        if (u && (u.startsWith('data:') || /^https?:/.test(u)) && !seen.has(u)) {
          seen.add(u); out.push({ id: `${n.id}-${out.length}`, url: u, kind });
        }
      }
    }
    return out.reverse(); // most recent first
  }, [nodes]);

  const editingViews = useMemo<Partial<Record<View, string>>>(() => {
    if (!editing) return {};
    const d = nodes.find((n) => n.id === editing)?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
    return d?.views ?? (d?.image ? { front: d.image } : {});
  }, [editing, nodes]);

  // the visualised look feeding the Extract node being edited
  const editingExtractImage = useMemo<string | undefined>(() => {
    if (!editingExtract) return undefined;
    const edge = edges.find((e) => e.target === editingExtract);
    const src = edge ? nodes.find((n) => n.id === edge.source) : undefined;
    const d = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
    return d?.views?.front ?? d?.image;
  }, [editingExtract, nodes, edges]);

  // the stored tech pack + the upstream piece feeding the Techpack node being edited
  const editingTechpackValue = useMemo<Techpack | undefined>(() => {
    if (!editingTechpack) return undefined;
    return (nodes.find((n) => n.id === editingTechpack)?.data as { techpack?: Techpack } | undefined)?.techpack;
  }, [editingTechpack, nodes]);

  const editingTechpackImage = useMemo<string | undefined>(() => {
    if (!editingTechpack) return undefined;
    const edge = edges.find((e) => e.target === editingTechpack);
    const src = edge ? nodes.find((n) => n.id === edge.source) : undefined;
    const d = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
    return d?.image ?? d?.views?.front;
  }, [editingTechpack, nodes, edges]);

  // the tech pack feeding the Manufacture node being edited (for garment-specific quotes)
  const editingManufactureTechpack = useMemo<Techpack | undefined>(() => {
    if (!editingManufacture) return undefined;
    const edge = edges.find((e) => e.target === editingManufacture);
    const src = edge ? nodes.find((n) => n.id === edge.source) : undefined;
    return (src?.data as { techpack?: Techpack } | undefined)?.techpack;
  }, [editingManufacture, nodes, edges]);

  const editingManufactureChosen = useMemo<string | undefined>(() => {
    if (!editingManufacture) return undefined;
    return (nodes.find((n) => n.id === editingManufacture)?.data as { manufacturer?: ChosenManufacturer } | undefined)?.manufacturer?.id;
  }, [editingManufacture, nodes]);

  // Create Sample: the upstream tech pack, the stored sample, and whether a Ship node hangs off it
  const editingSampleTechpack = useMemo<Techpack | undefined>(() => {
    if (!editingSample) return undefined;
    const edge = edges.find((e) => e.target === editingSample);
    const src = edge ? nodes.find((n) => n.id === edge.source) : undefined;
    return (src?.data as { techpack?: Techpack } | undefined)?.techpack;
  }, [editingSample, nodes, edges]);

  const editingSampleValue = useMemo<Sample | undefined>(() => {
    if (!editingSample) return undefined;
    return (nodes.find((n) => n.id === editingSample)?.data as { sample?: Sample } | undefined)?.sample;
  }, [editingSample, nodes]);

  const editingSampleHasShip = useMemo<boolean>(() => {
    if (!editingSample) return false;
    return edges.some((e) => e.source === editingSample && typeOf(e.target) === 'ship');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSample, nodes, edges]);

  if (project === null) {
    return (
      <main className="home">
        <p className="home-sub">Project not found.</p>
        <Link href="/" className="new-btn" style={{ display: 'inline-block' }}>← Back to projects</Link>
      </main>
    );
  }

  return (
    <StudioContext.Provider value={{ openSketch, visualise, openTechpack, openExtract, openPattern, openManufacture, openSample, setNodeImage, promptImage }}>
      <div className={`studio${booting || project === undefined ? ' emerging' : ''}`}>
        <DotField viewportRef={viewportRef} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(inst) => { rf.current = inst; viewportRef.current = inst.getViewport(); setCanvasReady(true); }}
          onMove={(_, vp) => { viewportRef.current = vp; }}
          isValidConnection={isValidConnection}
          connectionRadius={44}
          onNodeDoubleClick={(_e, node) => {
            if (node.type === 'sketch') openSketch(node.id);
            else if (node.type === 'techpack') openTechpack(node.id);
            else if (node.type === 'extract') openExtract(node.id);
            else if (node.type === 'pattern') openPattern(node.id);
            else if (node.type === 'manufacture') openManufacture(node.id);
            else if (node.type === 'sample') openSample(node.id);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode="dark"
          fitView
          minZoom={0.1}                  /* zoom out much further than the 0.5 default */
          maxZoom={2.5}
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={{ type: 'wire' }}
          proOptions={{ hideAttribution: true }}
          panOnScroll                    /* two-finger trackpad pans the canvas */
          zoomOnScroll={false}           /* scroll pans; pinch still zooms */
          zoomOnPinch
          selectionOnDrag                /* left-drag on empty canvas = marquee select */
          panOnDrag={[1, 2]}             /* pan with middle / right drag instead */
          selectionMode={SelectionMode.Partial} /* grab nodes the box even partially touches */
          multiSelectionKeyCode={['Shift', 'Meta']}
        >

          <Panel position="top-left" className="topbar">
            <StudioTopbar
              name={project?.name ?? 'Untitled'}
              onRename={renameProject}
              onBack={() => router.push('/')}
              onProfile={() => router.push('/profile')}
              onNew={newProject}
              onDuplicate={duplicateProject}
              onUndo={undo}
              onRedo={redo}
              onSettings={() => setSettingsOpen(true)}
              canUndo={histMeta.undo}
              canRedo={histMeta.redo}
            />
          </Panel>

          <Panel position="top-right">
            <button className="save-btn" onClick={save}>{statusLabel}</button>
          </Panel>

          <Panel position="center-left">
            <StudioDock stages={STAGES} onAdd={addNode} onLibrary={() => setLibraryOpen((o) => !o)} onProfile={() => router.push('/profile')} />
          </Panel>
        </ReactFlow>

        <SketchStudio
          open={!!editing}
          nodeId={editing}
          views={editingViews}
          onView={(view, d) => { if (editing) setNodeView(editing, view, d); }}
          onClose={() => setEditing(null)}
        />

        <TechpackPanel
          open={!!editingTechpack}
          nodeId={editingTechpack}
          value={editingTechpackValue}
          image={editingTechpackImage}
          onChange={(tp) => { if (editingTechpack) setNodeData(editingTechpack, { techpack: tp }); }}
          onClose={() => setEditingTechpack(null)}
        />

        <ExtractPanel
          open={!!editingExtract}
          image={editingExtractImage}
          onExtracted={(img) => { if (editingExtract) setNodeImage(editingExtract, img); }}
          onClose={() => setEditingExtract(null)}
        />

        <PatternProtoPanel
          open={!!editingPattern}
          onGenerated={(img) => { if (editingPattern) setNodeImage(editingPattern, img); }}
          onClose={() => setEditingPattern(null)}
        />

        <ManufacturePanel
          open={!!editingManufacture}
          techpack={editingManufactureTechpack}
          chosenId={editingManufactureChosen}
          onChoose={(m) => { if (editingManufacture) setNodeData(editingManufacture, { manufacturer: m }); }}
          onClose={() => setEditingManufacture(null)}
        />

        <SamplePanel
          open={!!editingSample}
          techpack={editingSampleTechpack}
          value={editingSampleValue}
          hasShipNode={editingSampleHasShip}
          onChange={(s) => { if (editingSample) setNodeData(editingSample, { sample: s }); }}
          onClose={() => setEditingSample(null)}
        />
      </div>
      {libraryOpen && <StudioLibrary items={libItems} onClose={() => setLibraryOpen(false)} />}

      {(booting || project === undefined) && <StudioLoader progress={progress} onDone={() => setBooting(false)} />}

      {settingsOpen && project && (
        <div className="pset-scrim" onMouseDown={() => setSettingsOpen(false)}>
          <div className="pset" role="dialog" aria-label="Project settings" onMouseDown={(e) => e.stopPropagation()}>
            <div className="pset-head">
              <span>Project settings</span>
              <button className="pset-x" aria-label="Close" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <label className="pset-field">
              <span>Name</span>
              <input
                defaultValue={project.name}
                onKeyDown={(e) => { if (e.key === 'Enter') { renameProject((e.target as HTMLInputElement).value); setSettingsOpen(false); } }}
                onBlur={(e) => renameProject(e.target.value)}
              />
            </label>
            <dl className="pset-meta">
              <div><dt>Project ID</dt><dd>{project.id}</dd></div>
              <div><dt>Nodes</dt><dd>{nodes.length}</dd></div>
              <div><dt>Created</dt><dd>{new Date(project.createdAt).toLocaleString()}</dd></div>
              <div><dt>Updated</dt><dd>{new Date(project.updatedAt).toLocaleString()}</dd></div>
            </dl>
          </div>
        </div>
      )}
    </StudioContext.Provider>
  );
}
