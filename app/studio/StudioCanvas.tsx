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
import RetailerNode from '@/components/RetailerNode';
import SampleNode from '@/components/SampleNode';
import ExtractNode from '@/components/ExtractNode';
import StudioNode from '@/components/StudioNode';
import GroupNode from '@/components/GroupNode';
import NoteNode from '@/components/NoteNode';
import WireEdge from '@/components/WireEdge';
import CanvasMenu, { type MenuState, type MenuItem } from '@/components/CanvasMenu';
import DotField from '@/components/DotField';
import SketchStudio from '@/components/SketchStudio';
import StudioLoader from '@/components/StudioLoader';
import SkeletonNode from '@/components/SkeletonNode';
import StudioTopbar from '@/components/StudioTopbar';
import StudioDock from '@/components/StudioDock';
import GenMeter from '@/components/GenMeter';
import PaywallModal from '@/components/PaywallModal';
import UnlockModal from '@/components/UnlockModal';
import TrialBadge from '@/components/TrialBadge';
import { openUnlock } from '@/lib/unlock';
import ProfileModal from '@/components/ProfileModal';
import { openPaywall, blockedByCap } from '@/lib/paywall';
import { openProfile } from '@/lib/profile';
import StudioLibrary, { type LibItem } from '@/components/StudioLibrary';
import { useRouter } from 'next/navigation';
import TechpackPanel from '@/components/TechpackPanel';
import ExtractPanel from '@/components/ExtractPanel';
import PatternPanel from '@/components/PatternPanel';
import ManufacturePanel from '@/components/ManufacturePanel';
import RetailerPanel from '@/components/RetailerPanel';
import SamplePanel from '@/components/SamplePanel';
import { StudioContext } from '@/lib/studio-context';
import { STAGES, NEXT, STAGE_HOTKEYS, type StageKey, type View } from '@/lib/nodeTypes';
import type { Techpack } from '@/lib/techpack';
import type { ChosenManufacturer } from '@/lib/manufacturers';
import type { ChosenRetailer, CollectionBrief } from '@/lib/retailers';
import type { Sample } from '@/lib/sample';
import { getProject, saveProject, createProject } from '@/lib/client-store';
import { useMe, notifyGenUsed } from '@/lib/use-billing';
import type { Project } from '@/lib/types';

const nodeTypes = {
  stage: StageNode,
  skeleton: SkeletonNode,
  sketch: SketchNode,
  visualise: VisualiseNode,
  studio: StudioNode,
  extract: ExtractNode,
  pattern: PatternNode,
  techpack: TechpackNode,
  sample: SampleNode,
  manufacture: ManufactureNode,
  retailer: RetailerNode,
  group: GroupNode,
  note: NoteNode,
};
const CUSTOM: Record<string, string> = { sketch: 'sketch', visualise: 'visualise', studio: 'studio', extract: 'extract', pattern: 'pattern', techpack: 'techpack', sample: 'sample', manufacture: 'manufacture', retailer: 'retailer' };
const edgeTypes = { wire: WireEdge };
let counter = 1;

// Stages not yet released to the public — shown as "coming soon" and blocked for
// everyone except the owner account (who can still build/test them). Gated on the
// exact email, NOT the isAdmin flag (several accounts carry isAdmin).
const OWNER_EMAIL = 'lohokur123@gmail.com';
const COMING_SOON_STAGES = new Set<StageKey>([]); // nothing 'coming soon' now — the production line is paid-gated by tier

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

// the best displayable image a node holds (front view wins, else any view/image)
function nodeImage(n?: Node): string | undefined {
  const d = n?.data as { image?: string; views?: Record<string, string> } | undefined;
  return d?.image ?? d?.views?.front ?? (d?.views ? Object.values(d.views).find((u) => typeof u === 'string') : undefined);
}

// clone a set of nodes with fresh ids, offset by (dx,dy); remaps only the edges
// that live entirely inside the set so the copy keeps its internal wiring.
function cloneNodes(src: Node[], allEdges: Edge[], dx: number, dy: number) {
  const idMap = new Map<string, string>();
  const newNodes: Node[] = src.map((n) => {
    const type = (n.data as { type?: string } | undefined)?.type ?? 'node';
    const nid = `${type}-${Date.now().toString(36)}-${counter++}`;
    idMap.set(n.id, nid);
    return {
      ...n,
      id: nid,
      position: { x: n.position.x + dx, y: n.position.y + dy },
      data: { ...(n.data as object) },
      selected: true,
      dragging: false,
      className: 'spawn-flash',
    } as Node;
  });
  const srcIds = new Set(src.map((n) => n.id));
  const newEdges: Edge[] = allEdges
    .filter((e) => srcIds.has(e.source) && srcIds.has(e.target))
    .map((e) => ({
      ...e,
      id: `e-${Date.now().toString(36)}-${counter++}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      selected: false,
    }));
  return { newNodes, newEdges };
}

export default function StudioCanvas({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editingTechpack, setEditingTechpack] = useState<string | null>(null);
  const [editingExtract, setEditingExtract] = useState<string | null>(null);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [editingManufacture, setEditingManufacture] = useState<string | null>(null);
  const [editingRetailer, setEditingRetailer] = useState<string | null>(null);
  const [editingSample, setEditingSample] = useState<string | null>(null);
  const dirty = useRef(false);
  const loaded = useRef(false);
  const loadedNonEmpty = useRef(false); // did the project load with nodes? guards empty-clobber
  const saving = useRef(false); // a save is in flight — don't overlap
  const [booting, setBooting] = useState(true);
  const [dataProg, setDataProg] = useState(0.08); // real data-load progress, 0.08 → 0.9
  const [canvasReady, setCanvasReady] = useState(false); // ReactFlow onInit fired
  const rf = useRef<ReactFlowInstance | null>(null); // React Flow instance (for viewport math)
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 }); // live React Flow viewport for the dot field
  const savedViewport = useRef<{ x: number; y: number; zoom: number } | undefined>(undefined); // last view, restored on load
  const vpApplied = useRef(false); // have we set the initial viewport yet?
  const vpSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined); // debounce viewport saves
  const adminView = useRef(false); // true when an admin is viewing someone else's canvas (read-only)
  const [isAdminView, setIsAdminView] = useState(false);
  const router = useRouter();
  const me = useMe();
  const meRef = useRef(me);
  meRef.current = me; // always-fresh usage for proactive cap checks inside callbacks
  const isOwner = me?.email === OWNER_EMAIL;
  const stageLocked = useCallback(
    (k: StageKey) => (me ? !me.entitlements.stages.includes(k) : false),
    [me],
  );
  // Unreleased stages: unavailable to everyone but the owner (shown as "coming soon").
  const stageComingSoon = useCallback(
    (k: StageKey) => COMING_SOON_STAGES.has(k) && !isOwner,
    [isOwner],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState>(null); // right-click context menu
  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null); // in-app node copy buffer
  const [running, setRunning] = useState(false); // Run-chain in flight

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
    getProject(projectId).then(async (fetched) => {
      if (cancelled) return;
      let p = fetched;
      // Not the user's own project? If they're an admin, load it read-only via the
      // admin endpoint (RLS-bypassing, server-gated to admins).
      if (!p) {
        try {
          const r = await fetch(`/api/admin/project/${projectId}`);
          if (r.ok) { p = await r.json(); adminView.current = true; setIsAdminView(true); }
        } catch { /* not an admin / not found → stays null */ }
      }
      if (cancelled) return;
      setProject(p);
      setDataProg(0.5); // project fetched
      if (p) {
        savedViewport.current = (p.flow as { viewport?: { x: number; y: number; zoom: number } } | undefined)?.viewport;
        // Migrate legacy 'image' nodes (now merged into Sketch) so old canvases still render.
        const ns = ((p.flow?.nodes as Node[]) ?? []).map((n) => {
          if (n.type !== 'image') return n;
          const d = (n.data ?? {}) as { image?: string; views?: Record<string, string> };
          const views = d.views ?? (d.image ? { front: d.image } : undefined);
          return { ...n, type: 'sketch', data: { ...d, type: 'sketch', ...(views ? { views } : {}) } } as Node;
        });
        const es = ((p.flow?.edges as Edge[]) ?? []).map((e) => ({ ...e, type: 'wire' as const, animated: false }));
        // Paint shaped skeleton placeholders at each node's spot right away, then
        // reveal — don't hold the loader hostage to the image bytes.
        const skel = ns.map((n) => ({
          ...n, type: 'skeleton', data: { type: n.type },
          draggable: false, selectable: false, connectable: false, deletable: false,
        })) as Node[];
        setNodes(ns.length ? skel : ns);
        setEdges(es);
        hist.current = [{ nodes: ns, edges: es }]; // history baseline = the REAL nodes
        hIdx.current = 0;
        syncHist();
        setDataProg(0.9); // layout known → hand the loader off to the skeleton canvas

        // Background: preload every referenced image, then swap skeletons → real nodes.
        const urls: string[] = [];
        for (const n of ns) {
          const d = n.data as { image?: string; views?: Record<string, string> } | undefined;
          if (d?.image) urls.push(d.image);
          if (d?.views) for (const v of Object.values(d.views)) if (typeof v === 'string') urls.push(v);
        }
        const reveal = () => {
          if (cancelled) return;
          if (ns.length) setNodes(ns); // swap placeholders for the real, image-bearing nodes
          loadedNonEmpty.current = ns.length > 0;
          loaded.current = true;
        };
        if (urls.length) {
          Promise.all(urls.map((src) => new Promise<void>((res) => {
            const im = new Image();
            const fin = () => res();
            im.onload = fin; im.onerror = fin; im.src = src;
          }))).then(reveal);
        } else {
          reveal();
        }
      } else if (!cancelled) {
        setDataProg(0.9);
        loaded.current = true;
      }
    });
    // safety net: never let the loader hang if an image or onInit never resolves
    const bail = setTimeout(() => { if (!cancelled) { setDataProg(0.9); setCanvasReady(true); } }, 6000);
    return () => { cancelled = true; clearTimeout(bail); };
  }, [projectId, setNodes, setEdges, syncHist]);

  // Restore the last view the user had (pan + zoom) once the canvas is ready.
  // No saved viewport (new or older project) → fall back to fitting the nodes.
  useEffect(() => {
    if (vpApplied.current || !canvasReady || !rf.current || project === undefined) return;
    vpApplied.current = true;
    const svp = savedViewport.current;
    if (svp) rf.current.setViewport(svp);
    else rf.current.fitView({ padding: 0.3 });
  }, [canvasReady, project]);

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

  // Visualise: dress the base model in the SELECTED sketch(es) plugged in, using any
  // selected image(s) as style/material reference. Each run appends a card to the
  // node's gallery (kept to the last 20) so you can compare different input combos.
  const visualise = useCallback(
    async (id: string) => {
      const node = nodesRef.current.find((n) => n.id === id);
      const data0 = node?.data as { order?: string[]; preview?: string; byInput?: Record<string, string> } | undefined;
      const order = data0?.order ?? [];
      const byInput: Record<string, string> = { ...(data0?.byInput ?? {}) };

      // connected inputs (ordered), each with a usable image
      const inputs = edgesRef.current
        .filter((e) => e.target === id)
        .map((e) => nodesRef.current.find((n) => n.id === e.source))
        .filter((n): n is Node => !!n)
        .sort((a, b) => {
          const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
          return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
        })
        .map((n) => {
          const nd = n.data as { image?: string; views?: Record<string, string> };
          const img = nd.image ?? nd.views?.front;
          return img ? { id: n.id, kind: (n.type as string) || 'sketch', img } : null;
        })
        .filter((x): x is { id: string; kind: string; img: string } => !!x);

      if (!inputs.length) {
        setNodeData(id, { note: 'plug in a sketch or image, then run' });
        setTimeout(() => setNodeData(id, { note: undefined }), 2600);
        return;
      }

      // a selected card → redo just that one; otherwise visualise every input that
      // doesn't have a render yet (each node gets its own visualisation)
      const focused = data0?.preview && inputs.some((w) => w.id === data0.preview) ? data0.preview : undefined;
      const targets = focused ? inputs.filter((w) => w.id === focused) : inputs.filter((w) => !byInput[w.id]);
      if (!targets.length) {
        setNodeData(id, { note: 'all visualised — tap a card to redo' });
        setTimeout(() => setNodeData(id, { note: undefined }), 2600);
        return;
      }

      // out of generations → paywall now, before any slow render
      if (blockedByCap(meRef.current)) { setNodeData(id, { busy: undefined, note: undefined }); return; }

      const base = await urlToDataUrl('/base.jpg');
      let last: string | undefined;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        // mark only THIS input as busy — the rest of the node stays viewable
        setNodeData(id, { busy: t.id, note: undefined });
        try {
          const r = await fetch('/api/visualise', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ base, inputs: [{ url: t.img, kind: t.kind }] }),
          });
          const j = await r.json();
          if (j.image) {
            byInput[t.id] = j.image;
            last = j.image;
            setNodeData(id, { byInput: { ...byInput }, image: j.image, busy: t.id });
            notifyGenUsed();
          } else if (j.upgrade) {
            openPaywall(); // hit the cap mid-batch — stop and surface the paywall
            setNodeData(id, { busy: undefined, note: undefined });
            return;
          } else if (targets.length === 1) {
            setNodeData(id, { busy: undefined, note: j.error || 'render failed' });
            return;
          }
        } catch {
          if (targets.length === 1) { setNodeData(id, { busy: undefined, note: 'render failed' }); return; }
        }
      }
      setNodeData(id, { byInput, image: last ?? byInput[inputs[0].id], busy: undefined, note: undefined });
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

  // Production-line panels are paid — free users get bounced to pricing.
  const gated = useCallback((stage: StageKey) => {
    if (stageLocked(stage)) { openUnlock(stage); return true; } // value-selling trial/upgrade prompt
    return false;
  }, [stageLocked]);
  const openSketch = useCallback((id: string) => setEditing(id), []);
  const openTechpack = useCallback((id: string) => { if (gated('techpack')) return; setEditingTechpack(id); }, [gated]);
  const openExtract = useCallback((id: string) => { if (gated('extract')) return; setEditingExtract(id); }, [gated]);
  const openPattern = useCallback((id: string) => { if (gated('pattern')) return; setEditingPattern(id); }, [gated]);
  const openManufacture = useCallback((id: string) => { if (gated('manufacture')) return; setEditingManufacture(id); }, [gated]);
  const openRetailer = useCallback((id: string) => { if (gated('retailer')) return; setEditingRetailer(id); }, [gated]);
  const openSample = useCallback((id: string) => { if (gated('sample')) return; setEditingSample(id); }, [gated]);
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
      if (stageComingSoon(type)) return; // unreleased — dock shows "coming soon"
      if (stageLocked(type)) { openUnlock(type); return; } // gate premium stages → trial/upgrade prompt
      const id = `${type}-${Date.now().toString(36)}-${counter++}`;
      const nt = CUSTOM[type] ?? 'stage';

      // auto-attach: if exactly one node is selected and the new node can legally
      // follow it (per the pipeline rules), wire into it and drop it just to the right.
      const sel = nodesRef.current.filter((n) => n.selected);
      const anchor = sel.length === 1 ? sel[0] : undefined;
      const anchorType = anchor ? (anchor.data as { type?: StageKey } | undefined)?.type : undefined;
      const attach = !!anchor && !!anchorType && !!NEXT[anchorType]?.includes(type);

      let position: { x: number; y: number };
      if (attach && anchor) {
        const w = (anchor as { measured?: { width?: number } }).measured?.width ?? 240;
        position = { x: anchor.position.x + w + 90, y: anchor.position.y };
      } else {
        // otherwise spawn at the centre of what the user is currently looking at
        const center = rf.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        position = center ? { x: center.x - 190, y: center.y - 70 } : { x: 160, y: 120 };
      }

      setNodes((ns) => [
        ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
        { id, type: nt, position, data: { type }, selected: true, className: 'spawn-flash' },
      ]);
      if (attach && anchor) {
        setEdges((es) => addEdge({ id: `e-${anchor.id}-${id}`, source: anchor.id, target: id, type: 'wire' }, es));
      }
      // clear the flash class once the pulse has played
      setTimeout(() => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, className: undefined } : n))), 1100);
      if (type === 'sketch') setEditing(id); // drop it on the canvas AND open the pad
    },
    [setNodes, setEdges, stageComingSoon, stageLocked, router]
  );

  // drop a sticky note at the centre of the current view (not a pipeline stage — no gating)
  const addNote = useCallback(() => {
    const id = `note-${Date.now().toString(36)}-${counter++}`;
    const center = rf.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = center ? { x: center.x - 110, y: center.y - 70 } : { x: 160, y: 120 };
    setNodes((ns) => [
      ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
      { id, type: 'note', position, data: { text: '' }, selected: true, className: 'spawn-flash' },
    ]);
    setTimeout(() => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, className: undefined } : n))), 1100);
  }, [setNodes]);

  // seed an empty canvas with a starter chain (from the fresh-canvas quick-starts)
  const seed = useCallback((stages: StageKey[]) => {
    stages = stages.filter((s) => !stageComingSoon(s)); // spawn the whole chain — locked nodes gate on interaction
    if (!stages.length) return;
    const gap = 300;
    const ns: Node[] = [];
    const es: Edge[] = [];
    stages.forEach((st, i) => {
      const id = `${st}-${Date.now().toString(36)}-${counter++}`;
      ns.push({ id, type: CUSTOM[st] ?? 'stage', position: { x: 140 + i * gap, y: 190 }, data: { type: st }, className: 'spawn-flash' });
      if (i > 0) es.push({ id: `e-${ns[i - 1].id}-${id}`, source: ns[i - 1].id, target: id, type: 'wire' });
    });
    setNodes(ns);
    setEdges(es);
    setTimeout(() => setNodes((cur) => cur.map((n) => ({ ...n, className: undefined }))), 1100);
    setTimeout(() => rf.current?.fitView({ duration: 400, padding: 0.35 }), 80);
    if (stages[0] === 'sketch') setEditing(ns[0].id); // open the pad on the first sketch
  }, [setNodes, setEdges, stageComingSoon]);

  const setNoteText = useCallback(
    (id: string, text: string) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, text } } : n))),
    [setNodes],
  );

  // single-key shortcuts spawn nodes — ignored while typing or an editor/panel is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (editing || editingTechpack || editingExtract || editingPattern || editingManufacture || editingRetailer || editingSample || settingsOpen || libraryOpen) return;
      const k = e.key.toLowerCase();
      if (k === 'n') { e.preventDefault(); addNote(); return; }
      const type = STAGE_HOTKEYS[k];
      if (!type) return;
      e.preventDefault();
      addNode(type);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addNode, addNote, editing, editingTechpack, editingExtract, editingPattern, editingManufacture, editingRetailer, editingSample, settingsOpen, libraryOpen]);

  // drop an image straight onto the canvas (paste / upload) as a ready Sketch node
  const addImageNode = useCallback((image: string) => {
    const id = `sketch-${Date.now().toString(36)}-${counter++}`;
    const center = rf.current?.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const position = center ? { x: center.x - 190, y: center.y - 70 } : { x: 160, y: 120 };
    setNodes((ns) => [
      ...ns.map((n) => (n.selected ? { ...n, selected: false } : n)),
      { id, type: 'sketch', position, data: { type: 'sketch', image, views: { front: image } }, selected: true, className: 'spawn-flash' },
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
    // out of generations → paywall now, before the slow render
    if (blockedByCap(meRef.current)) { setNodeData(id, { loading: false, note: undefined, prompt }); return; }

    setNodeData(id, { loading: true, note: 'generating…', prompt });
    try {
      const res = await fetch('/api/imagine', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, images: inputs }),
      });
      const j = await res.json();
      if (j.image) { setNodeData(id, { image: j.image, loading: false, note: undefined, prompt }); notifyGenUsed(); }
      else if (j.upgrade) { openPaywall(); setNodeData(id, { loading: false, note: undefined, prompt }); }
      else setNodeData(id, { loading: false, note: j.error || 'no image returned' });
    } catch (err) {
      setNodeData(id, { loading: false, note: (err as Error).message || 'generation failed' });
    }
  }, [setNodeData]);

  // Run the pipeline: walk nodes in dependency (topological) order and fire each
  // automatable action — Visualise renders its sketch, Image/Brand-studio nodes
  // re-run their saved prompt. Sequential + awaited so each downstream node sees
  // its upstream output. Nodes that need human input (extract, techpack, sample,
  // manufacture) are skipped. `startId` runs only that node + everything below it.
  const runChain = useCallback(async (startId?: string) => {
    if (running) return;
    const ns = nodesRef.current;
    const es = edgesRef.current;
    const outAdj = new Map<string, string[]>();
    ns.forEach((n) => outAdj.set(n.id, []));
    es.forEach((e) => { if (outAdj.has(e.source)) outAdj.get(e.source)!.push(e.target); });

    // scope = every node to run: all of them, or startId and its descendants
    let scope: Set<string>;
    if (startId) {
      scope = new Set();
      const stack = [startId];
      while (stack.length) {
        const id = stack.pop()!;
        if (scope.has(id)) continue;
        scope.add(id);
        for (const nx of outAdj.get(id) ?? []) stack.push(nx);
      }
    } else {
      scope = new Set(ns.map((n) => n.id));
    }

    // Kahn topological sort restricted to the scope
    const indeg = new Map<string, number>();
    scope.forEach((id) => indeg.set(id, 0));
    for (const id of scope) for (const nx of outAdj.get(id) ?? []) if (scope.has(nx)) indeg.set(nx, (indeg.get(nx) ?? 0) + 1);
    const queue = [...scope].filter((id) => (indeg.get(id) ?? 0) === 0);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const nx of outAdj.get(id) ?? []) {
        if (!scope.has(nx)) continue;
        indeg.set(nx, (indeg.get(nx) ?? 1) - 1);
        if ((indeg.get(nx) ?? 0) === 0) queue.push(nx);
      }
    }

    setMenu(null);
    setRunning(true);
    try {
      for (const id of order) {
        const n = nodesRef.current.find((x) => x.id === id);
        const t = (n?.data as { type?: StageKey } | undefined)?.type;
        const prompt = (n?.data as { prompt?: string } | undefined)?.prompt;
        if (t === 'visualise') await visualise(id);
        else if ((t === 'sketch' || t === 'studio') && prompt?.trim()) await promptImage(id, prompt);
        else continue;
        // let React commit the fresh image into nodesRef before the next node reads it
        await new Promise((r) => setTimeout(r, 40));
      }
    } finally {
      setRunning(false);
    }
  }, [running, visualise, promptImage]);

  // clear the spawn-flash pulse from a batch of nodes once it has played
  const flashOff = useCallback((ids: string[]) => {
    const s = new Set(ids);
    setTimeout(() => setNodes((ns) => ns.map((n) => (s.has(n.id) ? { ...n, className: undefined } : n))), 1100);
  }, [setNodes]);

  // drop a freshly-cloned batch onto the canvas (deselecting whatever was selected)
  const addClones = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    setNodes((cur) => [...cur.map((n) => (n.selected ? { ...n, selected: false } : n)), ...newNodes]);
    if (newEdges.length) setEdges((cur) => [...cur, ...newEdges]);
    flashOff(newNodes.map((n) => n.id));
  }, [setNodes, setEdges, flashOff]);

  const copyNodes = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const set = new Set(ids);
    const ns = nodesRef.current.filter((n) => set.has(n.id)).map((n) => ({ ...n, data: { ...(n.data as object) } }));
    const es = edgesRef.current.filter((e) => set.has(e.source) && set.has(e.target));
    clipboard.current = { nodes: ns, edges: es };
  }, []);

  const pasteNodes = useCallback(() => {
    const clip = clipboard.current;
    if (!clip?.nodes.length) return;
    const { newNodes, newEdges } = cloneNodes(clip.nodes, clip.edges, 40, 40);
    addClones(newNodes, newEdges);
  }, [addClones]);

  const duplicateNodes = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const src = nodesRef.current.filter((n) => set.has(n.id));
    if (!src.length) return;
    const { newNodes, newEdges } = cloneNodes(src, edgesRef.current, 40, 40);
    addClones(newNodes, newEdges);
  }, [addClones]);

  const deleteNodes = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setNodes((ns) => ns.filter((n) => !set.has(n.id)));
    setEdges((es) => es.filter((e) => !set.has(e.source) && !set.has(e.target)));
  }, [setNodes, setEdges]);

  // wrap a selection in a group frame so they move together
  const groupNodes = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const kids = nodesRef.current.filter((n) => set.has(n.id) && n.type !== 'group' && !n.parentId);
    if (kids.length < 2) return;
    const PAD = 30, HEAD = 40;
    const dim = (n: Node) => {
      const m = (n as { measured?: { width?: number; height?: number } }).measured;
      return { w: m?.width ?? 340, h: m?.height ?? 200 };
    };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of kids) {
      const { w, h } = dim(n);
      minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w); maxY = Math.max(maxY, n.position.y + h);
    }
    const gx = minX - PAD, gy = minY - PAD - HEAD;
    const gw = maxX - minX + PAD * 2, gh = maxY - minY + PAD * 2 + HEAD;
    const gid = `group-${Date.now().toString(36)}-${counter++}`;
    const group: Node = {
      id: gid, type: 'group', position: { x: gx, y: gy },
      data: { type: 'group', label: 'Group' }, style: { width: gw, height: gh },
      selected: true, className: 'spawn-flash',
    };
    const kidSet = new Set(kids.map((k) => k.id));
    setNodes((cur) => {
      const rest = cur.filter((n) => !kidSet.has(n.id)).map((n) => (n.selected ? { ...n, selected: false } : n));
      const reparented = kids.map((n) => ({
        ...n, parentId: gid, extent: 'parent' as const,
        position: { x: n.position.x - gx, y: n.position.y - gy }, selected: false,
      }));
      return [group, ...reparented, ...rest]; // parent must precede its children
    });
    flashOff([gid]);
  }, [setNodes, flashOff]);

  // dissolve a group frame, restoring its children to absolute positions
  const ungroup = useCallback((gid: string) => {
    const g = nodesRef.current.find((n) => n.id === gid);
    if (!g) return;
    const { x: gx, y: gy } = g.position;
    setNodes((cur) =>
      cur
        .filter((n) => n.id !== gid)
        .map((n) =>
          n.parentId === gid
            ? { ...n, parentId: undefined, extent: undefined, position: { x: n.position.x + gx, y: n.position.y + gy }, selected: true }
            : n
        )
    );
  }, [setNodes]);

  // remove a group frame together with everything inside it
  const deleteGroup = useCallback((gid: string) => {
    const ids = [gid, ...nodesRef.current.filter((n) => n.parentId === gid).map((n) => n.id)];
    deleteNodes(ids);
  }, [deleteNodes]);

  const renameGroup = useCallback(
    (id: string, label: string) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))),
    [setNodes]
  );

  const downloadImage = useCallback(async (id: string) => {
    const n = nodesRef.current.find((x) => x.id === id);
    const url = nodeImage(n);
    if (!url) return;
    const href = url.startsWith('data:') ? url : await urlToDataUrl(url).catch(() => url);
    const a = document.createElement('a');
    const type = (n?.data as { type?: string } | undefined)?.type ?? 'sketch';
    a.href = href; a.download = `${type}-${id}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }, []);

  const selectedIds = useCallback(() => nodesRef.current.filter((n) => n.selected).map((n) => n.id), []);

  // action menu for a set of selected nodes, anchored on the right-clicked one
  const nodeMenuItems = useCallback((anchor: Node, ids: string[]): MenuItem[] => {
    const multi = ids.length > 1;
    const groupable = ids.filter((id) => {
      const n = nodesRef.current.find((x) => x.id === id);
      return n && n.type !== 'group' && !n.parentId;
    });
    return [
      { label: 'Run from here', shortcut: '▷', disabled: running, onClick: () => runChain(anchor.id) },
      ...(groupable.length >= 2 ? [{ label: `Group ${groupable.length}`, shortcut: '⌘G', onClick: () => groupNodes(groupable) } as MenuItem] : []),
      { sep: true },
      { label: multi ? `Duplicate ${ids.length}` : 'Duplicate', shortcut: '⌘D', onClick: () => duplicateNodes(ids) },
      { label: multi ? `Copy ${ids.length}` : 'Copy', shortcut: '⌘C', onClick: () => copyNodes(ids) },
      { label: 'Download image', disabled: multi || !nodeImage(anchor), onClick: () => downloadImage(anchor.id) },
      { sep: true },
      { label: multi ? `Delete ${ids.length}` : 'Delete', shortcut: '⌫', danger: true, onClick: () => deleteNodes(ids) },
    ];
  }, [running, runChain, groupNodes, duplicateNodes, copyNodes, downloadImage, deleteNodes]);

  // right-click a node → act on the current selection (or just that node)
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    // a group frame gets its own menu
    if (node.type === 'group') {
      setMenu({ x: e.clientX, y: e.clientY, items: [
        { label: 'Ungroup', shortcut: '⌘⇧G', onClick: () => ungroup(node.id) },
        { sep: true },
        { label: 'Delete group + contents', shortcut: '⌫', danger: true, onClick: () => deleteGroup(node.id) },
      ] });
      return;
    }
    let ids = selectedIds();
    if (!ids.includes(node.id)) { ids = [node.id]; setNodes((ns) => ns.map((n) => ({ ...n, selected: n.id === node.id }))); }
    setMenu({ x: e.clientX, y: e.clientY, items: nodeMenuItems(node, ids) });
  }, [selectedIds, setNodes, nodeMenuItems, ungroup, deleteGroup]);

  // right-click the multi-select bounding box → same actions on the whole selection.
  // ReactFlow fires this (not onNodeContextMenu/onPaneContextMenu) when the marquee
  // selection overlay is under the cursor.
  const onSelectionContextMenu = useCallback((e: React.MouseEvent, sel: Node[]) => {
    e.preventDefault();
    if (!sel.length) return;
    setMenu({ x: e.clientX, y: e.clientY, items: nodeMenuItems(sel[0], sel.map((n) => n.id)) });
  }, [nodeMenuItems]);

  // right-click empty canvas → paste / select-all / fit
  const onPaneContextMenu = useCallback((e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const items: MenuItem[] = [
      { label: 'Paste', shortcut: '⌘V', disabled: !clipboard.current?.nodes.length, onClick: pasteNodes },
      { label: 'Select all', shortcut: '⌘A', onClick: () => setNodes((ns) => ns.map((n) => ({ ...n, selected: true }))) },
      { label: 'Fit to view', onClick: () => rf.current?.fitView({ duration: 400, padding: 0.2 }) },
    ];
    setMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, items });
  }, [pasteNodes, setNodes]);

  // ⌘C copy · ⌘D duplicate · ⌘V paste · ⌘A select-all — ignored while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      const sel = nodesRef.current.filter((n) => n.selected).map((n) => n.id);
      if (k === 'c' && sel.length) { e.preventDefault(); copyNodes(sel); }
      else if (k === 'd' && sel.length) { e.preventDefault(); duplicateNodes(sel); }
      else if (k === 'v' && clipboard.current?.nodes.length) { e.preventDefault(); pasteNodes(); }
      else if (k === 'a') { e.preventDefault(); setNodes((ns) => ns.map((n) => ({ ...n, selected: true }))); }
      else if (k === 'g' && !e.shiftKey) { e.preventDefault(); groupNodes(sel); }
      else if (k === 'g' && e.shiftKey) { e.preventDefault(); nodesRef.current.filter((n) => n.selected && n.type === 'group').forEach((n) => ungroup(n.id)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copyNodes, duplicateNodes, pasteNodes, setNodes, groupNodes, ungroup]);

  const save = useCallback(async () => {
    if (adminView.current) return; // viewing someone else's canvas — never write
    if (!loaded.current || !dirty.current || saving.current) return;
    // Safety net: never overwrite a project that had content with an empty canvas.
    // Guards against a load race or transient state emptying the flow and wiping media.
    if (nodes.length === 0 && loadedNonEmpty.current) return;
    saving.current = true;
    // clear dirty BEFORE the await; re-set it on failure so nothing is lost
    dirty.current = false;
    try {
      await saveProject(projectId, { flow: { nodes, edges, viewport: viewportRef.current } });
      if (nodes.length > 0) loadedNonEmpty.current = true;
    } catch (e) {
      dirty.current = true; // failed — keep dirty so it retries
      console.error('[autosave] save failed, will retry', e);
    } finally {
      saving.current = false;
      // edits landed during the write (or it failed) → retry so nothing is dropped
      if (dirty.current) setTimeout(() => void saveRef.current(), 600);
    }
  }, [projectId, nodes, edges]);

  // keep a ref to the latest save so leave-handlers can flush without re-subscribing
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!loaded.current) return;
    dirty.current = true;
    const t = setTimeout(() => { void save(); }, 1200);
    return () => clearTimeout(t);
  }, [nodes, edges, save]);

  // flush pending changes when leaving the page/canvas so nothing in the debounce
  // window (e.g. a just-generated image) is lost on reload / navigation / close.
  useEffect(() => {
    const flush = () => { if (loaded.current && dirty.current) void saveRef.current(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('visibilitychange', flush);
      flush(); // component unmount (e.g. navigating to another project) → flush
    };
  }, []);

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
    if (editingRetailer && !ids.has(editingRetailer)) setEditingRetailer(null);
    if (editingSample && !ids.has(editingSample)) setEditingSample(null);
  }, [nodes, editing, editingTechpack, editingExtract, editingPattern, editingManufacture, editingRetailer, editingSample]);

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

  // every image made on this canvas (sketches, visualisations, extracts, …) for the Library
  const libItems = useMemo<LibItem[]>(() => {
    const KIND: Record<string, string> = {
      sketch: 'Sketch', visualise: 'Visualisation', extract: 'Extract',
      pattern: 'Pattern', techpack: 'Techpack', sample: 'Sample', manufacture: 'Manufacture', retailer: 'Retailer',
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

  // the garment feeding the Pattern node being edited — upstream node, else its own image
  const editingPatternImage = useMemo<string | undefined>(() => {
    if (!editingPattern) return undefined;
    const edge = edges.find((e) => e.target === editingPattern);
    const src = edge ? nodes.find((n) => n.id === edge.source) : undefined;
    const sd = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
    const od = nodes.find((n) => n.id === editingPattern)?.data as { image?: string } | undefined;
    return sd?.views?.front ?? sd?.image ?? od?.image;
  }, [editingPattern, nodes, edges]);

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

  // What the Retailer node knows about the collection being submitted: identity
  // from any tech pack in the flow, size + readiness from the pipeline's shape.
  const editingRetailerBrief = useMemo<CollectionBrief>(() => {
    const nodeType = (n: Node) => (n.data as { type?: string } | undefined)?.type;
    const tp = nodes.map((n) => (n.data as { techpack?: Techpack } | undefined)?.techpack).find(Boolean);
    const pieces = Math.max(1, nodes.filter((n) => nodeType(n) === 'sketch' || nodeType(n) === 'visualise').length);
    const hasType = (t: string) => nodes.some((n) => nodeType(n) === t);
    const polished = hasType('techpack') && hasType('manufacture');
    return { name: tp?.name, category: tp?.category, pieces, polished };
  }, [nodes]);

  const editingRetailerChosen = useMemo<ChosenRetailer | undefined>(() => {
    if (!editingRetailer) return undefined;
    return (nodes.find((n) => n.id === editingRetailer)?.data as { retailer?: ChosenRetailer } | undefined)?.retailer;
  }, [editingRetailer, nodes]);

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
    <StudioContext.Provider value={{ openSketch, visualise, openTechpack, openExtract, openPattern, openManufacture, openRetailer, openSample, setNodeImage, promptImage, renameGroup, setNoteText }}>
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
          onMoveEnd={(_, vp) => {
            viewportRef.current = vp;
            if (!loaded.current) return;
            dirty.current = true; // remember where the user left off
            clearTimeout(vpSaveTimer.current);
            vpSaveTimer.current = setTimeout(() => void saveRef.current?.(), 700);
          }}
          isValidConnection={isValidConnection}
          connectionRadius={90}
          onNodeContextMenu={onNodeContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onPaneContextMenu={onPaneContextMenu}
          deleteKeyCode={['Backspace', 'Delete']}   /* click a node or wire, then Delete to remove it */
          onNodeDoubleClick={(_e, node) => {
            if (node.type === 'sketch') openSketch(node.id);
            else if (node.type === 'techpack') openTechpack(node.id);
            else if (node.type === 'extract') openExtract(node.id);
            else if (node.type === 'pattern') openPattern(node.id);
            else if (node.type === 'manufacture') openManufacture(node.id);
            else if (node.type === 'retailer') openRetailer(node.id);
            else if (node.type === 'sample') openSample(node.id);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode="dark"
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
          panOnDrag={[1]}                /* middle-drag pans; right is free for the context menu */
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

          {isAdminView && (
            <Panel position="top-center">
              <div className="admin-view-banner">Admin view · read-only</div>
            </Panel>
          )}

          <Panel position="bottom-left">
            <GenMeter />
            <TrialBadge />
          </Panel>

          <Panel position="center-left">
            <StudioDock stages={STAGES} onAdd={addNode} onNote={addNote} onLibrary={() => setLibraryOpen((o) => !o)} onProfile={openProfile} isLocked={stageLocked} onLocked={(k) => openUnlock(k)} comingSoon={stageComingSoon} />
          </Panel>
        </ReactFlow>

        <PaywallModal />
        <UnlockModal />
        <ProfileModal />

        {canvasReady && !booting && project && nodes.length === 0 && (
          <div className="freshstart">
            <div className="fs-hint">
              New here? Start with a flow — or press <kbd>S</kbd> sketch · <kbd>V</kbd> render
            </div>
            <div className="fs-pills">
              <button onClick={() => seed(['sketch', 'visualise'])}>Sketch → Render</button>
              <button onClick={() => seed(['sketch', 'visualise', 'extract', 'pattern', 'techpack', 'sample'])}>Sketch → physical product</button>
              <button onClick={() => seed(['sketch', 'visualise', 'extract', 'pattern', 'techpack', 'manufacture', 'ship'])}>Sketch → bulk order</button>
            </div>
          </div>
        )}

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

        <PatternPanel
          open={!!editingPattern}
          nodeId={editingPattern}
          image={editingPatternImage}
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

        <RetailerPanel
          open={!!editingRetailer}
          brief={editingRetailerBrief}
          chosen={editingRetailerChosen}
          onChoose={(r) => { if (editingRetailer) setNodeData(editingRetailer, { retailer: r }); }}
          onClose={() => setEditingRetailer(null)}
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

      <CanvasMenu menu={menu} onClose={() => setMenu(null)} />


      {(booting || project === undefined) && <StudioLoader progress={progress} onDone={() => setBooting(false)} />}

      {settingsOpen && project && (
        <div className="pset-scrim" onMouseDown={() => setSettingsOpen(false)}>
          <div className="pset" role="dialog" aria-label="Project settings" onMouseDown={(e) => e.stopPropagation()}>
            <div className="pset-head">
              <span>Project settings</span>
              <button className="pset-x" aria-label="Close" onClick={() => setSettingsOpen(false)}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
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
