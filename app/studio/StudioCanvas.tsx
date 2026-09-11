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
import PaywallModal from '@/components/PaywallModal';
import UnlockModal from '@/components/UnlockModal';
import TrialBadge from '@/components/TrialBadge';
import { openUnlock } from '@/lib/unlock';
import ProfileModal from '@/components/ProfileModal';
import { openPaywall, blockedByCap } from '@/lib/paywall';
import { announcePopout, onPopout } from '@/lib/popout';
import { openProfile } from '@/lib/profile';
import StudioLibrary, { type LibItem } from '@/components/StudioLibrary';
import { useRouter } from 'next/navigation';
import TechpackPanel from '@/components/TechpackPanel';
import ExtractPanel from '@/components/ExtractPanel';
import PatternMakerPanel from '@/components/PatternMakerPanel';
import ManufacturePanel from '@/components/ManufacturePanel';
import RetailerPanel from '@/components/RetailerPanel';
import ProducePanel from '@/components/ProducePanel';
import ShipPanel from '@/components/ShipPanel';
import ShipNode from '@/components/ShipNode';
import GhostNode from '@/components/GhostNode';
import { StudioContext } from '@/lib/studio-context';
import { STAGES, NEXT, STAGE_HOTKEYS, type StageKey, type View } from '@/lib/nodeTypes';
import { identityImage } from '@/lib/identities';
import { normalizeTechpack, type Techpack, type Label } from '@/lib/techpack';
import { tickOrder, type Order } from '@/lib/order';
import type { ChosenManufacturer } from '@/lib/manufacturers';
import type { ChosenRetailer, CollectionBrief } from '@/lib/retailers';
import type { Sample } from '@/lib/sample';
import { getProject, saveProject, createProject } from '@/lib/client-store';
import { offloadFlowImages } from '@/lib/offload-images';
import { useMe, notifyGenUsed } from '@/lib/use-billing';
import { entitlementsFor, type Tier } from '@/lib/entitlements';
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
  ship: ShipNode,
  group: GroupNode,
  note: NoteNode,
  ghost: GhostNode,
};
const CUSTOM: Record<string, string> = { sketch: 'sketch', visualise: 'visualise', studio: 'studio', extract: 'extract', pattern: 'pattern', techpack: 'techpack', sample: 'sample', manufacture: 'manufacture', retailer: 'retailer', ship: 'ship' };
const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));
// Stages shown in the side dock — Pattern + Ship are hidden from it.
const DOCK_STAGES = STAGES.filter((s) => s.key !== 'pattern' && s.key !== 'ship');
// Preferred ghost suggestion per stage (the production-forward path). Must be a
// legal NEXT of the source; falls back to the first available NEXT otherwise.
const PRIMARY_NEXT: Partial<Record<StageKey, StageKey>> = {
  sketch: 'techpack',
  techpack: 'sample',
  sample: 'ship',
};
const edgeTypes = { wire: WireEdge };
let counter = 1;

// Stages not yet released to the public — shown as "coming soon" and blocked for
// everyone except the owner account (who can still build/test them). Gated on the
// exact email, NOT the isAdmin flag (several accounts carry isAdmin).
const OWNER_EMAIL = 'lohokur123@gmail.com';
const COMING_SOON_STAGES = new Set<StageKey>(['pattern', 'ship']); // not yet released — shown "coming soon" (ship = 3PL routing)

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
  const [editingSketchView, setEditingSketchView] = useState<View>('front'); // which view the pad opens on
  const [applyingEdits, setApplyingEdits] = useState(false); // annotate → re-render in progress
  const [editingTechpack, setEditingTechpack] = useState<string | null>(null);
  const [editingExtract, setEditingExtract] = useState<string | null>(null);
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [editingManufacture, setEditingManufacture] = useState<string | null>(null);
  const [editingRetailer, setEditingRetailer] = useState<string | null>(null);
  const [editingSample, setEditingSample] = useState<string | null>(null);
  const [editingShip, setEditingShip] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ after: string; stages: StageKey[] } | null>(null); // next-node suggestion chain
  const ghostRef = useRef<{ after: string; stages: StageKey[] } | null>(null);
  useEffect(() => { ghostRef.current = ghost; }, [ghost]);
  // Independent Model-branch suggestion off a sketch (id of the sketch, or null). Kept
  // separate from the main chain so materializing one doesn't clear the other.
  const [branch, setBranch] = useState<string | null>(null);

  // light mode is the DEFAULT view; only an explicit '0' opts into the dark canvas
  const [light, setLight] = useState(true);
  useEffect(() => { setLight(localStorage.getItem('lk-studio-light') !== '0'); }, []);
  const toggleLight = useCallback(() => setLight((v) => { const nv = !v; try { localStorage.setItem('lk-studio-light', nv ? '1' : '0'); } catch { /* private mode */ } return nv; }), []);

  // Liquid-glass theme (admin toggle) — restyles the whole studio (nodes, dock, panels).
  const [glass, setGlass] = useState(false);
  useEffect(() => { setGlass(localStorage.getItem('lk-liquid-glass') === '1'); }, []);
  const toggleGlass = useCallback(() => setGlass((v) => { const nv = !v; try { localStorage.setItem('lk-liquid-glass', nv ? '1' : '0'); } catch { /* private mode */ } return nv; }), []);
  const dirty = useRef(false);
  const loaded = useRef(false);
  const loadedNonEmpty = useRef(false); // did the project load with nodes? guards empty-clobber
  const saving = useRef(false); // a save is in flight — don't overlap
  const saveFailStreak = useRef(0); // consecutive save failures → exponential back-off
  const [saveDegraded, setSaveDegraded] = useState(false); // DB unreachable → show "reconnecting…"
  const revealed = useRef(false); // skeleton → real-node swap has happened
  const revealFn = useRef<() => void>(() => {}); // the swap, held until the loader lifts
  const [revealArmed, setRevealArmed] = useState(false); // images ready → waiting to reveal
  const [skeletonShown, setSkeletonShown] = useState(false); // instant skeletons painted from cached layout
  const [booting, setBooting] = useState(true);
  const [dataProg, setDataProg] = useState(0.08); // real data-load progress, 0.08 → 0.9
  const [canvasReady, setCanvasReady] = useState(false); // ReactFlow onInit fired
  const rf = useRef<ReactFlowInstance | null>(null); // React Flow instance (for viewport math)
  const viewportRef = useRef({ x: 0, y: 0, zoom: 1 }); // live React Flow viewport for the dot field
  const savedViewport = useRef<{ x: number; y: number; zoom: number } | undefined>(undefined); // last view, restored on load
  const vpApplied = useRef(false); // have we set the initial viewport yet?
  const adminView = useRef(false); // true when an admin is viewing someone else's canvas (read-only)
  const [isAdminView, setIsAdminView] = useState(false);
  const router = useRouter();
  const realMe = useMe();
  const isOwner = realMe?.email === OWNER_EMAIL;
  // Owner-only: preview any tier (Free/Studio/Pro/Brand) without switching account.
  const [tierOverride, setTierOverride] = useState<Tier | null>(null);
  useEffect(() => { try { const v = localStorage.getItem('lk-tier-override'); if (v && ['free', 'studio', 'pro', 'brand'].includes(v)) setTierOverride(v as Tier); } catch { /* noop */ } }, []);
  const setPreviewTier = useCallback((t: Tier | null) => {
    setTierOverride(t);
    try { if (t) localStorage.setItem('lk-tier-override', t); else localStorage.removeItem('lk-tier-override'); } catch { /* noop */ }
  }, []);
  const previewing = isOwner && !!tierOverride;
  const ownerPower = isOwner && !previewing; // owner privileges apply only when NOT previewing a tier
  // While previewing, the app behaves exactly as that tier: adopt its entitlements
  // and drop the owner/admin bypass so all the gates fire.
  const me = useMemo(() => {
    if (!realMe || !previewing) return realMe;
    // preview the tier fresh: adopt its entitlements, drop the owner/admin bypass,
    // and start from zero usage (don't inherit the owner's real gens against the cap)
    return { ...realMe, tier: tierOverride!, entitlements: entitlementsFor(tierOverride!), isAdmin: false, email: '__preview__', gensUsed: 0 };
  }, [realMe, previewing, tierOverride]);
  const meRef = useRef(me);
  meRef.current = me; // always-fresh usage for proactive cap checks inside callbacks
  // Free plan: side/back views are paid → the render/model/tech-pack side+back slots
  // show a blurred paywall (using the free front image) instead of a real generation.
  const sideLocked = !!me && !me.isAdmin && me.email !== OWNER_EMAIL && !me.entitlements.sideViews;
  // Free plan: a node may generate only regenPerNode times (1). Pass the node's
  // generation count so far; returns true — and opens the paywall — when blocked.
  const regenBlocked = useCallback((genCount: number) => {
    const m = meRef.current;
    const lim = m?.entitlements.regenPerNode ?? Infinity;
    if (lim !== Infinity && !m?.isAdmin && m?.email !== OWNER_EMAIL && genCount >= lim) { openPaywall(); return true; }
    return false;
  }, []);
  const genCountOf = useCallback((id: string) => ((nodesRef.current.find((n) => n.id === id)?.data as { genCount?: number } | undefined)?.genCount ?? 0), []);
  // Free plan is FRONT-only: side/back views (render, model, tech-pack flats) and
  // tech-pack material swatches are paid. Owner/admin always allowed.
  const canSideViews = useCallback(() => {
    const m = meRef.current;
    return !!(m?.isAdmin || m?.email === OWNER_EMAIL || m?.entitlements.sideViews);
  }, []);
  const canMaterials = useCallback(() => {
    const m = meRef.current;
    return !!(m?.isAdmin || m?.email === OWNER_EMAIL || m?.entitlements.materials);
  }, []);
  const stageLocked = useCallback(
    (k: StageKey) => (me ? !me.entitlements.stages.includes(k) : false),
    [me],
  );
  // Unreleased stages: unavailable to everyone but the owner (shown as "coming soon").
  const stageComingSoon = useCallback(
    (k: StageKey) => COMING_SOON_STAGES.has(k) && !ownerPower,
    [ownerPower],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Library keeps EVERY image ever made here — a new generation is added, it never
  // overrides the previous one, even after a node's own image is replaced.
  const libAccum = useRef<{ url: string; kind: string }[]>([]);
  const libSeen = useRef<Set<string>>(new Set());
  const [menu, setMenu] = useState<MenuState>(null); // right-click context menu
  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null); // in-app node copy buffer
  const [running, setRunning] = useState(false); // Run-chain in flight

  // lightweight undo/redo history of the flow (nodes + edges)
  const hist = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const hIdx = useRef(-1);
  const applying = useRef(false); // true while an undo/redo is being applied
  const [histMeta, setHistMeta] = useState({ undo: false, redo: false });
  const syncHist = useCallback(() => setHistMeta({ undo: hIdx.current > 0, redo: hIdx.current < hist.current.length - 1 }), []);

  // ---- write-reduction (Supabase Disk IO) --------------------------------------
  // The flow is one image-heavy JSONB row; rewriting it on every selection/hover/
  // pan is what was burning Disk IO. We only persist when the MEANINGFUL content
  // changes. Signature ignores volatile UI state (selected/dragging/measured) by
  // keying data objects on reference identity (React Flow keeps the same data ref
  // on selection, and hands a NEW one only when we actually edit via setNodeData).
  const dataIds = useRef(new WeakMap<object, number>());
  const dataSeq = useRef(0);
  const dataId = useCallback((d: unknown) => {
    if (!d || typeof d !== 'object') return 0;
    const m = dataIds.current;
    let id = m.get(d as object);
    if (id === undefined) { id = ++dataSeq.current; m.set(d as object, id); }
    return id;
  }, []);
  const flowSig = useCallback((ns: Node[], es: Edge[]) =>
    ns.map((n) => `${n.id},${Math.round(n.position.x)},${Math.round(n.position.y)},${n.type},${dataId(n.data)}`).join('|')
    + '#' + es.map((e) => `${e.id},${e.source}>${e.target}`).join('|'),
  [dataId]);
  const lastSig = useRef('');

  // Loader progress reflects actual work: the data phase fills to 0.9, and the
  // final 0.1 lands only once the canvas has mounted. Never a fixed timer.
  const dataDone = dataProg >= 0.9;
  const progress = dataDone && canvasReady ? 1 : Math.min(dataProg, 0.9);
  // After the branded loader hands off, skeleton placeholders sit in for the real
  // image-bearing nodes until they load. Count them so we can reassure the user
  // their saved work is coming back (not lost) during that window.
  const hydratingCount = nodes.reduce((c, n) => c + (n.type === 'skeleton' ? 1 : 0), 0);
  // Only surface the reassurance when hydration is actually slow (>500ms), so it
  // never flashes on a fast load — it's there precisely for the "is my work gone?" case.
  const [showRestoring, setShowRestoring] = useState(false);
  useEffect(() => {
    if (booting || !project || hydratingCount === 0) { setShowRestoring(false); return; }
    const t = setTimeout(() => setShowRestoring(true), 500);
    return () => clearTimeout(t);
  }, [booting, project, hydratingCount]);

  useEffect(() => {
    let cancelled = false;
    revealed.current = false; setRevealArmed(false); // fresh load → skeletons first

    // INSTANT skeletons from a locally-cached layout, painted BEFORE the fetch — so
    // a slow Supabase read (up to 30s under load) never shows a blank canvas. We
    // draw placeholder shapes at each remembered node position immediately.
    let hadCache = false;
    try {
      const rawLayout = localStorage.getItem(`lk-layout-${projectId}`);
      if (rawLayout) {
        const layout = JSON.parse(rawLayout) as { id: string; type?: string; position: { x: number; y: number } }[];
        if (Array.isArray(layout) && layout.length) {
          setNodes(layout.map((l) => ({
            id: l.id, type: 'skeleton', position: l.position, data: { type: l.type },
            // explicit size + measured so React Flow v12 renders them immediately
            // (it hides unmeasured nodes) and fitView can position them
            width: 210, height: 182, measured: { width: 210, height: 182 },
            draggable: false, selectable: false, connectable: false, deletable: false,
          })) as Node[]);
          const rawVp = localStorage.getItem(`lk-vp-${projectId}`);
          if (rawVp) savedViewport.current = JSON.parse(rawVp);
          hadCache = true;
        }
      }
    } catch { /* ignore */ }
    setSkeletonShown(hadCache);
    if (hadCache) setBooting(false); // skip the branded loader — show the skeleton canvas now

    setDataProg(hadCache ? 0.6 : 0.15); // fetch started
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
        // Prefer the locally-remembered view (panning no longer touches the DB);
        // fall back to whatever was last stored in the flow for older projects.
        let localVp: { x: number; y: number; zoom: number } | undefined;
        try { const raw = localStorage.getItem(`lk-vp-${projectId}`); if (raw) localVp = JSON.parse(raw); } catch { /* ignore */ }
        savedViewport.current = localVp ?? (p.flow as { viewport?: { x: number; y: number; zoom: number } } | undefined)?.viewport;
        // Migrate legacy 'image' nodes (now merged into Sketch) so old canvases still render.
        const ns = ((p.flow?.nodes as Node[]) ?? []).map((n) => {
          if (n.type !== 'image') return n;
          const d = (n.data ?? {}) as { image?: string; views?: Record<string, string> };
          const views = d.views ?? (d.image ? { front: d.image } : undefined);
          return { ...n, type: 'sketch', data: { ...d, type: 'sketch', ...(views ? { views } : {}) } } as Node;
        });
        const es = ((p.flow?.edges as Edge[]) ?? []).map((e) => ({ ...e, type: 'wire' as const, animated: false }));
        // Refresh the local layout cache so next open paints instant skeletons.
        try { localStorage.setItem(`lk-layout-${projectId}`, JSON.stringify(ns.map((n) => ({ id: n.id, type: n.type, position: n.position })))); } catch { /* ignore */ }
        // Paint shaped skeleton placeholders at each node's spot right away, then
        // reveal — don't hold the loader hostage to the image bytes.
        const skel = ns.map((n) => ({
          ...n, type: 'skeleton', data: { type: n.type },
          // explicit size + measured — React Flow v12 keeps unmeasured nodes hidden
          width: 210, height: 182, measured: { width: 210, height: 182 },
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
        const doReveal = () => {
          if (cancelled || revealed.current) return;
          revealed.current = true;
          if (ns.length) setNodes(ns); // swap placeholders for the real, image-bearing nodes
          loadedNonEmpty.current = ns.length > 0;
          lastSig.current = flowSig(ns, es); // baseline: don't re-save the flow we just loaded
          loaded.current = true;
        };
        revealFn.current = doReveal;
        // Arm the reveal once images are ready; the reveal EFFECT then waits for the
        // branded loader to lift so the skeleton canvas is actually shown first.
        const arm = () => { if (!cancelled) setRevealArmed(true); };
        if (urls.length) {
          Promise.all(urls.map((src) => new Promise<void>((res) => {
            const im = new Image();
            const fin = () => res();
            im.onload = fin; im.onerror = fin; im.src = src;
          }))).then(arm);
        } else {
          arm();
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

  // Swap skeletons → real nodes only AFTER the branded loader has lifted, then hold
  // the placeholders a short beat, so the "canvas loading in" state is actually seen
  // (fast loads used to swap in real nodes before the loader even finished fading).
  useEffect(() => {
    if (!revealArmed || booting || revealed.current) return;
    const t = setTimeout(() => revealFn.current(), 480);
    return () => clearTimeout(t);
  }, [revealArmed, booting]);

  // Restore the last view the user had (pan + zoom) once the canvas is ready AND
  // its nodes exist. Crucially: if the restored view shows NO node (stale/empty
  // saved viewport, or the user left it panned to blank space), fit to the work
  // so the canvas never looks empty when it isn't.
  useEffect(() => {
    if (vpApplied.current || !canvasReady || !rf.current) return;
    const inst = rf.current;
    if (!inst.getNodes().length) return; // nothing painted yet — wait for the skeletons
    vpApplied.current = true;

    const svp = savedViewport.current;
    const validSvp = !!svp && Number.isFinite(svp.x) && Number.isFinite(svp.y) && (svp.zoom ?? 0) > 0.05;
    if (validSvp) inst.setViewport(svp!);
    else inst.fitView({ padding: 0.3 });

    // Guarantee the work is actually on screen. Check on the next frame (after the
    // viewport applies); if not a single node is in view, fit to all of them.
    requestAnimationFrame(() => {
      const rf2 = rf.current;
      if (!rf2) return;
      const { x, y, zoom } = rf2.getViewport();
      const W = window.innerWidth, H = window.innerHeight;
      const anyVisible = rf2.getNodes().some((n) => {
        const w = ((n.measured?.width ?? (n.width as number) ?? 210)) * zoom;
        const h = ((n.measured?.height ?? (n.height as number) ?? 120)) * zoom;
        const sx = n.position.x * zoom + x, sy = n.position.y * zoom + y;
        return sx + w > 8 && sx < W - 8 && sy + h > 8 && sy < H - 8;
      });
      if (!anyVisible) rf2.fitView({ padding: 0.3 });
    });
  }, [canvasReady, project, nodes]);

  // live refs for validation / lookups (avoids stale closures)
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // One popout at a time. The canvas node panels share the right edge with the
  // global popouts (paywall / unlock / profile), so opening a node panel closes
  // those, and opening a global popout closes every node panel.
  const anyPanelOpen = editing || editingTechpack || editingExtract || editingPattern || editingManufacture || editingRetailer || editingSample || editingShip;
  useEffect(() => { if (anyPanelOpen) announcePopout('node'); }, [anyPanelOpen]);
  useEffect(() => onPopout('node', () => {
    setEditing(null); setEditingTechpack(null); setEditingExtract(null);
    setEditingPattern(null); setEditingManufacture(null); setEditingRetailer(null); setEditingSample(null); setEditingShip(null);
  }), []);

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
  // Render mirrors the sketch's views: it renders Front always, and Side/Back only
  // when a connected input actually carries that view. Each view is stored in byView
  // and shown by the render node's Front/Back/Side switcher.
  const visualise = useCallback(
    async (id: string, onlyView?: View) => {
      const node = nodesRef.current.find((n) => n.id === id);
      const data0 = node?.data as { byView?: Partial<Record<View, string>> } | undefined;
      const byView: Partial<Record<View, string>> = { ...(data0?.byView ?? {}) };

      // connected inputs, each with its per-view images (front falls back to the card image)
      const inputs = edgesRef.current
        .filter((e) => e.target === id)
        .map((e) => nodesRef.current.find((n) => n.id === e.source))
        .filter((n): n is Node => !!n)
        .map((n) => {
          const nd = n.data as { image?: string; views?: Partial<Record<View, string>> };
          return {
            kind: (n.type as string) || 'sketch',
            views: { front: nd.image ?? nd.views?.front, side: nd.views?.side, back: nd.views?.back } as Partial<Record<View, string>>,
          };
        });

      if (!inputs.length) {
        setNodeData(id, { note: 'plug in a sketch or image, then run' });
        setTimeout(() => setNodeData(id, { note: undefined }), 2600);
        return;
      }

      // Free plan: one model generation per node
      if (regenBlocked(genCountOf(id))) return;

      const ALL: View[] = ['front', 'side', 'back'];
      const available = ALL.filter((v) => inputs.some((i) => i.views[v]));
      // refresh button → just the shown view; else every available view missing a render
      const targets = (onlyView ? [onlyView] : available.filter((v) => !byView[v])).filter((v) => available.includes(v));
      let toRender = targets.length ? targets : available;
      if (!toRender.length) {
        setNodeData(id, { note: 'nothing to render — draw a front first' });
        setTimeout(() => setNodeData(id, { note: undefined }), 2600);
        return;
      }

      // Free plan: front only — side/back are paid.
      if (!canSideViews()) {
        const frontOnly = toRender.filter((v) => v === 'front');
        if (!frontOnly.length) { openUnlock('visualise'); setNodeData(id, { busyView: undefined, note: undefined }); return; }
        toRender = frontOnly;
      }

      if (blockedByCap(meRef.current)) { setNodeData(id, { busyView: undefined, note: undefined }); return; }

      // dress the identity the user picked in the node (falls back to the default base)
      const modelPath = identityImage((node?.data as { model?: string } | undefined)?.model) ?? '/base.jpg';
      const base = await urlToDataUrl(modelPath);
      for (const v of toRender) {
        const imgs = inputs
          .filter((i) => i.views[v])
          .map((i) => ({ url: i.views[v]!, kind: i.kind }));
        if (!imgs.length) continue;
        setNodeData(id, { busyView: v, note: undefined });
        try {
          const r = await fetch('/api/visualise', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ base, inputs: imgs }),
          });
          const j = await r.json();
          if (j.image) {
            byView[v] = j.image;
            setNodeData(id, { byView: { ...byView }, ...(v === 'front' ? { image: j.image } : {}), busyView: v });
            notifyGenUsed();
          } else if (j.upgrade) {
            openPaywall();
            setNodeData(id, { busyView: undefined, note: undefined });
            return;
          } else if (toRender.length === 1) {
            setNodeData(id, { busyView: undefined, note: j.error || 'render failed' });
            return;
          }
        } catch {
          if (toRender.length === 1) { setNodeData(id, { busyView: undefined, note: 'render failed' }); return; }
        }
      }
      setNodeData(id, { byView, image: byView.front ?? byView[toRender[0]], busyView: undefined, note: undefined, genCount: genCountOf(id) + 1 });
    },
    [setNodeData]
  );

  // enforce the strict pipeline order: only <stage> → NEXT[stage] is allowed
  const isValidConnection = useCallback((c: Connection | Edge) => {
    const s = typeOf(c.source);
    const t = typeOf(c.target);
    return !!s && !!t && !!NEXT[s]?.includes(t);
  }, []);

  // Auto piece-identification: as soon as a design is plugged into a Pattern node,
  // trace the outline → deconstruct into panels → number them, with no click needed.
  const autoDetectPattern = useCallback(async (patternId: string, sourceImg: string) => {
    if (blockedByCap(meRef.current)) return;
    setNodeData(patternId, { detecting: true, note: 'identifying pieces…' });
    const call = async (image: string, mode: string) => {
      const r = await fetch('/api/pattern', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image, mode }),
      });
      const j = await r.json();
      if (j.upgrade) { openPaywall(); return undefined; }
      return j.image as string | undefined;
    };
    try {
      const outline = await call(sourceImg, 'outline');
      if (!outline) { setNodeData(patternId, { detecting: false, note: undefined }); return; }
      notifyGenUsed();
      const panels = await call(outline, 'deconstruct');
      if (!panels) { setNodeData(patternId, { detecting: false, note: undefined, image: outline }); return; }
      notifyGenUsed();
      const numbered = await call(panels, 'number');
      if (numbered) notifyGenUsed();
      setNodeData(patternId, { detecting: false, note: undefined, image: numbered ?? panels });
    } catch { setNodeData(patternId, { detecting: false, note: undefined }); }
  }, [setNodeData, regenBlocked, genCountOf]);

  // Auto tech-pack: as soon as a design is plugged into a Techpack node, an AI
  // vision model looks at it and drafts the whole pack — measurements, materials,
  // construction, sewing, colourways — which the user can then edit + export. The
  // upstream image becomes the technical flat.
  const autoGenTechpack = useCallback(async (techId: string) => {
    if (blockedByCap(meRef.current)) return;
    // resolve the upstream design node → its front/side/back renders (mockups) + label
    const edge = edgesRef.current.find((e) => e.target === techId);
    const src = edge ? nodesRef.current.find((n) => n.id === edge.source) : undefined;
    const sd = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
    const mockups: Partial<Record<View, string>> = { front: sd?.image ?? sd?.views?.front, side: sd?.views?.side, back: sd?.views?.back };
    const front = mockups.front;
    if (!front) return;

    // label propagates from anywhere upstream in the chain
    const findLabel = (): Label | undefined => {
      let cur = src; const seen = new Set<string>();
      for (let i = 0; i < 6 && cur; i++) {
        const l = (cur.data as { label?: Label } | undefined)?.label;
        if (l && (l.image || l.brand)) return l;
        seen.add(cur.id);
        const up = edgesRef.current.find((e) => e.target === cur!.id);
        cur = up ? nodesRef.current.find((n) => n.id === up.source) : undefined;
        if (cur && seen.has(cur.id)) break;
      }
      return undefined;
    };
    const label = findLabel();

    const mid = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const genAsset = async (image: string, kind: string): Promise<string | undefined> => {
      try {
        const r = await fetch('/api/techpack/assets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image, kind }) });
        const j = await r.json();
        if (j.image) { notifyGenUsed(); return j.image as string; }
        if (j.upgrade) openPaywall();
      } catch { /* skip this asset */ }
      return undefined;
    };

    setNodeData(techId, { techpackGenerating: true, note: 'drafting tech pack…' });
    try {
      // 1 · the pack itself (measurements, materials, colourways, vendor, Pantone)
      const r = await fetch('/api/techpack', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: front }) });
      const j = await r.json();
      if (!j.techpack) {
        if (j.upgrade) openPaywall();
        setNodeData(techId, { techpackGenerating: false, note: j.error || undefined });
        return;
      }
      notifyGenUsed();
      // The front technical flat ships WITH the pack (one charge) — so every plan,
      // free included, always gets it. Side/back flats are separately paid below.
      let tp = normalizeTechpack({ ...j.techpack, mockups, label, flats: j.frontFlat ? { front: j.frontFlat } : {} });
      setNodeData(techId, { techpack: tp });

      // 2 + 3 · the slow part of a tech pack is these image generations — side/back
      // flats and the material swatches. In series they stack into minutes (and one
      // stall drags the whole thing out), so we fan them ALL out concurrently and
      // merge each result in as it lands. JS is single-threaded, so each synchronous
      // read-modify-write of `tp` below runs atomically — no races.
      type Mat = (typeof tp.materials)[number];
      const baseMaterials = tp.materials ?? [];
      // image-generated material cards, kept in stable slot order (fabric, binding, thread, then label)
      const swatchSpecs = canMaterials()
        ? ([['fabric', 'Main body fabric', 'Front & back body'], ['binding', 'Binding / rib trim', 'Cuffs · hem · neck'], ['thread', 'Thread', 'All seams']] as const)
        : ([] as const);
      const matSlots: (Mat | null)[] = new Array(swatchSpecs.length + 1).fill(null);

      // technical vectors: the FRONT only if the inline pack didn't return it (a
      // resilient recovery via the same path that reliably produces side/back), plus
      // side/back on paid plans. Front normally ships with the pack for one charge —
      // this just guarantees it never goes missing.
      const flatViews: View[] = [];
      if (!tp.flats.front && mockups.front) flatViews.push('front');
      if (canSideViews()) (['side', 'back'] as View[]).forEach((v) => { if (mockups[v]) flatViews.push(v); });
      const labelWillGen = !label?.image && canMaterials();

      // What's still in flight — the panel reads this to spin the pieces still loading
      // so you can open + read the pack immediately instead of waiting for all of it.
      const loading = { flats: [...flatViews] as string[], materials: swatchSpecs.length + (labelWillGen ? 1 : 0) };
      const push = () => setNodeData(techId, { techpack: tp, tpLoading: { flats: [...loading.flats], materials: loading.materials } });
      const applyMaterials = () => {
        const gen = matSlots.filter((x): x is Mat => !!x).map((m, i) => ({ ...m, ref: String(i + 1) }));
        tp = { ...tp, materials: [...gen, ...baseMaterials] };
        push();
      };
      push(); // publish what's pending up front

      const flatTasks = flatViews.map((v) => genAsset(mockups[v]!, 'vector').then((vec) => {
        if (vec) tp = { ...tp, flats: { ...tp.flats, [v]: vec } };
        loading.flats = loading.flats.filter((x) => x !== v);
        push();
      }));

      // material swatches — PAID. Free skips the generation to save cost (swatches
      // come from a reusable library later).
      const swatchTasks = swatchSpecs.map(([kind, name, placement], i) =>
        genAsset(front, kind).then((img) => {
          if (img) matSlots[i] = { id: mid(), ref: '', name, placement, desc: '', image: img };
          loading.materials = Math.max(0, loading.materials - 1);
          applyMaterials();
        }));

      // an already-uploaded label costs nothing; only GENERATE one on a paid plan
      const labelTask = (async () => {
        const labelImg = label?.image ?? (labelWillGen ? await genAsset(front, 'label') : undefined);
        if (labelImg) matSlots[swatchSpecs.length] = { id: mid(), ref: '', name: label?.brand ? `${label.brand} label` : 'Brand / care label', placement: 'Inside back neck', desc: label?.care ?? '', image: labelImg };
        if (labelWillGen) loading.materials = Math.max(0, loading.materials - 1);
        applyMaterials();
      })();

      await Promise.allSettled([...flatTasks, ...swatchTasks, labelTask]);
      setNodeData(techId, { techpack: tp, techpackGenerating: false, note: undefined, tpLoading: undefined });
    } catch {
      setNodeData(techId, { techpackGenerating: false, note: 'tech pack failed' });
    }
  }, [setNodeData]);

  // Auto tech-pack: the moment ANY sketch/design with an image is wired into an
  // empty Techpack node — however the edge was made (drag, ghost chain, on load,
  // or drawing after connecting) — start generating. No click needed. Keyed by
  // (techpack, image) so it fires once and doesn't retry-loop on failure.
  const autoTechAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const e of edges) {
      const target = nodes.find((n) => n.id === e.target);
      if (target?.type !== 'techpack') continue;
      const td = target.data as { techpack?: Techpack; techpackGenerating?: boolean } | undefined;
      if (td?.techpack || td?.techpackGenerating) continue;
      const src = nodes.find((n) => n.id === e.source);
      const sd = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
      const img = sd?.image ?? sd?.views?.front;
      if (!img) continue;
      const key = `${target.id}:${img.slice(0, 48)}`;
      if (autoTechAttempted.current.has(key)) continue;
      autoTechAttempted.current.add(key);
      void autoGenTechpack(target.id);
    }
  }, [nodes, edges, autoGenTechpack]);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((es) => addEdge({ ...c, type: 'wire' }, es));
      const target = nodesRef.current.find((n) => n.id === c.target);
      const src = nodesRef.current.find((n) => n.id === c.source);
      const sd = src?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
      const img = sd?.image ?? sd?.views?.front;
      if (target?.type === 'pattern') {
        const td = target.data as { image?: string; detecting?: boolean };
        if (img && !td.image && !td.detecting) void autoDetectPattern(c.target!, img);
      }
      // techpack auto-gen is handled by the watcher effect above (covers all cases)
    },
    [setEdges, autoDetectPattern]
  );

  // Production-line panels are paid — free users get bounced to pricing.
  const gated = useCallback((stage: StageKey) => {
    if (stageLocked(stage)) { openUnlock(stage); return true; } // value-selling trial/upgrade prompt
    return false;
  }, [stageLocked]);
  const openSketch = useCallback((id: string, view: View = 'front') => { setEditingSketchView(view); setEditing(id); }, []);
  const openTechpack = useCallback((id: string) => {
    if (gated('techpack')) return;
    setEditingTechpack(id); // auto-gen is handled by the watcher effect, no click needed
  }, [gated]);
  const openExtract = useCallback((id: string) => { if (gated('extract')) return; setEditingExtract(id); }, [gated]);
  const openPattern = useCallback((id: string) => { if (gated('pattern')) return; setEditingPattern(id); }, [gated]);
  const openManufacture = useCallback((id: string) => { if (gated('manufacture')) return; setEditingManufacture(id); }, [gated]);
  const openRetailer = useCallback((id: string) => { if (gated('retailer')) return; setEditingRetailer(id); }, [gated]);
  const openSample = useCallback((id: string) => { if (gated('sample')) return; setEditingSample(id); }, [gated]);
  const openShip = useCallback((id: string) => { if (gated('ship')) return; setEditingShip(id); }, [gated]);
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

  // Bring a sketch to life: render the drawn view into the house ghost-mannequin
  // product shot — the clean piece floating in PURE WHITE studio space — and drop
  // it straight back onto the pad in place (no new node). Uses the same /api/imagine
  // product path as the Sketch node, so the look matches the rest of the pipeline,
  // and reuses the applyingEdits dissolve/reload so the pad swaps in the result.
  const bringToLife = useCallback(
    async (view: View, dataUrl: string) => {
      if (!editing) return;
      if (view !== 'front' && !canSideViews()) { openUnlock('visualise'); return; } // side/back are paid
      if (blockedByCap(meRef.current)) return;
      const id = editing;
      const call = (p: string, imgs: string[], v: View) =>
        fetch('/api/imagine', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: p, images: imgs, mode: 'product', view: v }),
        }).then((r) => r.json() as Promise<{ image?: string; upgrade?: boolean; error?: string }>);

      // PRIMARY view (usually front) — realise the drawn sketch as the product shot.
      setApplyingEdits(true);
      let front: { image?: string; upgrade?: boolean };
      try {
        front = await call('The exact garment shown in this design sketch — faithfully keep its silhouette, proportions, panels, seams, closures, colour and material.', [dataUrl], view);
      } catch { setApplyingEdits(false); return; }
      if (!front.image) { if (front.upgrade) openPaywall(); setApplyingEdits(false); return; }
      setNodeView(id, view, front.image);
      notifyGenUsed();
      setApplyingEdits(false); // reveal the realised piece in the pad now

      // Then render the SIDE and BACK from that front image so they're unmistakably
      // the same garment — same follow-up the Sketch node runs after its front.
      // Paid only: the free plan stops at the front shot.
      if (view === 'front' && canSideViews()) {
        setNodeData(id, { viewsBusy: true });
        try {
          const [side, back] = await Promise.all([
            call('This is the exact same garment — reproduce it identically (same design, colour, material, details) but photographed from the side.', [front.image!], 'side'),
            call('This is the exact same garment — reproduce it identically (same design, colour, material, details) but photographed from the back.', [front.image!], 'back'),
          ]);
          if (side.image) setNodeView(id, 'side', side.image);
          if (back.image) setNodeView(id, 'back', back.image);
          if (side.image || back.image) notifyGenUsed();
          if (side.upgrade || back.upgrade) openPaywall();
        } catch { /* network — front already saved */ }
        setNodeData(id, { viewsBusy: false });
      }
    },
    [editing, setNodeView, setNodeData]
  );

  // Annotate → re-render: send the flattened view (render + drawn panels + labels)
  // to the edit model and drop the result back onto that view.
  const applyEdits = useCallback(
    async (view: View, dataUrl: string) => {
      if (!editing) return;
      if (blockedByCap(meRef.current)) return;
      setApplyingEdits(true);
      try {
        const r = await fetch('/api/annotate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ image: dataUrl }),
        });
        const j = await r.json();
        if (j.image) { setNodeView(editing, view, j.image); notifyGenUsed(); }
        else if (j.upgrade) openPaywall();
      } catch { /* network — leave the drawing in place to retry */ }
      finally { setApplyingEdits(false); }
    },
    [editing, setNodeView]
  );

  // The stage to suggest as the "ghost" after a given node — the first legal next
  // stage that's actually available (skips coming-soon / locked).
  const suggestNext = useCallback(
    (type: StageKey): StageKey | null => {
      const nexts = NEXT[type] ?? [];
      const avail = (s: StageKey | undefined): s is StageKey => !!s && nexts.includes(s) && !stageComingSoon(s) && !stageLocked(s);
      const pref = PRIMARY_NEXT[type];
      if (avail(pref)) return pref;
      return nexts.find((n) => !stageComingSoon(n) && !stageLocked(n)) ?? null;
    },
    [stageComingSoon, stageLocked],
  );

  // The full production-forward chain of stages after a given one (e.g. sketch →
  // techpack → produce → ship), following the preferred/available next each step.
  const chainFrom = useCallback((type: StageKey): StageKey[] => {
    const chain: StageKey[] = [];
    const seen = new Set<StageKey>([type]);
    let cur = type;
    for (let i = 0; i < 8; i++) {
      const nx = suggestNext(cur);
      if (!nx || seen.has(nx)) break;
      chain.push(nx); seen.add(nx); cur = nx;
      if (nx === 'ship') break;
    }
    return chain;
  }, [suggestNext]);

  const addNode = useCallback(
    (type: StageKey, anchorId?: string, at?: { x: number; y: number }, keepGhost?: boolean) => {
      if (stageComingSoon(type)) return; // unreleased — dock shows "coming soon"
      if (stageLocked(type)) { openUnlock(type); return; } // gate premium stages → trial/upgrade prompt
      // Free plan: only ONE node per category on the canvas.
      const perStage = meRef.current?.entitlements.maxPerStage ?? Infinity;
      if (perStage !== Infinity && !meRef.current?.isAdmin && meRef.current?.email !== OWNER_EMAIL
        && nodesRef.current.filter((n) => (n.data as { type?: string })?.type === type).length >= perStage) {
        openPaywall(); return;
      }
      const id = `${type}-${Date.now().toString(36)}-${counter++}`;
      const nt = CUSTOM[type] ?? 'stage';

      // auto-attach: to an explicit anchor (the ghost suggestion) or, failing that,
      // the single selected node — if the new node can legally follow it.
      const explicit = anchorId ? nodesRef.current.find((n) => n.id === anchorId) : undefined;
      const sel = nodesRef.current.filter((n) => n.selected);
      const anchor = explicit ?? (sel.length === 1 ? sel[0] : undefined);
      const anchorType = anchor ? (anchor.data as { type?: StageKey } | undefined)?.type : undefined;
      const attach = !!anchor && !!anchorType && !!NEXT[anchorType]?.includes(type);

      let position: { x: number; y: number };
      if (at) {
        // explicit placement (e.g. a branch ghost that sits above the main chain)
        position = at;
      } else if (attach && anchor) {
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
      // show the suggested chain of ghosts trailing off the new node. `keepGhost`
      // (used when materializing a branch) leaves the existing suggestions in place.
      if (!keepGhost) {
        const chain = chainFrom(type);
        setGhost(chain.length ? { after: id, stages: chain } : null);
        setBranch(type === 'sketch' ? id : null);
      }
    },
    [setNodes, setEdges, stageComingSoon, stageLocked, chainFrom, router]
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
      if (editing || editingTechpack || editingExtract || editingPattern || editingManufacture || editingRetailer || editingSample || editingShip || settingsOpen || libraryOpen) return;
      const k = e.key.toLowerCase();
      if (k === 'n') { e.preventDefault(); addNote(); return; }
      const type = STAGE_HOTKEYS[k];
      if (!type) return;
      e.preventDefault();
      addNode(type);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [addNode, addNote, editing, editingTechpack, editingExtract, editingPattern, editingManufacture, editingRetailer, editingSample, editingShip, settingsOpen, libraryOpen]);

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

  // AI image. Sketch prompts are garments → on-brand ghost-mannequin product shot,
  // and we produce all THREE views (front, then side + back generated from the front
  // so they match). Worldbuild (studio) stays free-form and single-image.
  const promptImage = useCallback(async (id: string, prompt: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    const isSketch = node?.type === 'sketch';
    const mode = isSketch ? 'product' : 'freeform';
    // Free plan: one generation per node (drawing/uploading doesn't count)
    if (regenBlocked(genCountOf(id))) { setNodeData(id, { loading: false, note: undefined, prompt }); return; }

    const inputs: string[] = [];
    for (const e of edgesRef.current) {
      if (e.target !== id) continue;
      const src = nodesRef.current.find((n) => n.id === e.source);
      const sd = src?.data as { image?: string; views?: Record<string, string> } | undefined;
      const img = sd?.image ?? sd?.views?.front;
      if (img) inputs.push(img);
    }
    // Worldbuild (freeform): if nothing plugged in carries an image, fall back to the
    // node's own uploaded/base image so it still has something to transform.
    if (!inputs.length && !isSketch) {
      const own = (node?.data as { image?: string } | undefined)?.image;
      if (own) inputs.push(own);
    }
    // out of generations → paywall now, before the slow render
    if (blockedByCap(meRef.current)) { setNodeData(id, { loading: false, note: undefined, prompt }); return; }

    const curViews = (): Record<string, string> =>
      (nodesRef.current.find((n) => n.id === id)?.data as { views?: Record<string, string> } | undefined)?.views ?? {};
    const call = (p: string, imgs: string[], view?: string) =>
      fetch('/api/imagine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: p, images: imgs, mode, view }) })
        .then((r) => r.json() as Promise<{ image?: string; upgrade?: boolean; error?: string }>);

    setNodeData(id, { loading: true, note: 'generating…', prompt });
    try {
      // FRONT — from the typed prompt (or wired-in inputs)
      const front = await call(prompt, inputs, 'front');
      if (!front.image) {
        if (front.upgrade) openPaywall();
        setNodeData(id, { loading: false, note: front.upgrade ? undefined : (front.error || 'no image returned'), prompt });
        return;
      }
      const patch: Record<string, unknown> = { image: front.image, loading: false, note: undefined, prompt, genCount: genCountOf(id) + 1 };
      if (isSketch) patch.views = { ...curViews(), front: front.image };
      setNodeData(id, patch);
      notifyGenUsed();

      // SIDE + BACK — only garments, generated FROM the front so they're the same piece.
      // Paid only: the free plan stops at the front shot.
      if (isSketch && canSideViews()) {
        setNodeData(id, { viewsBusy: true });
        const [side, back] = await Promise.all([
          call('This is the exact same garment — reproduce it identically (same design, colour, material, details) but photographed from the side.', [front.image!], 'side'),
          call('This is the exact same garment — reproduce it identically (same design, colour, material, details) but photographed from the back.', [front.image!], 'back'),
        ]);
        const next = { ...curViews() };
        if (side.image) next.side = side.image;
        if (back.image) next.back = back.image;
        setNodeData(id, { views: next, viewsBusy: false });
        if (side.image || back.image) notifyGenUsed();
        if (side.upgrade || back.upgrade) openPaywall();
      }
    } catch (err) {
      setNodeData(id, { loading: false, viewsBusy: false, note: (err as Error).message || 'generation failed' });
    }
  }, [setNodeData, regenBlocked, genCountOf]);

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
    let ok = false;
    try {
      // Offload a few base64 images to Storage first, so the flow row keeps only
      // URLs (the Disk IO fix). Capped + self-aborting, so it never bursts uploads
      // at a struggling DB.
      let toSave = nodes;
      const offloaded = await offloadFlowImages(nodes);
      if (offloaded) {
        toSave = offloaded;
        lastSig.current = flowSig(offloaded, edges); // the swap must not trigger a re-save
        setNodes(offloaded); // canvas now references URLs → every future save is tiny
      }
      await saveProject(projectId, { flow: { nodes: toSave, edges, viewport: viewportRef.current } });
      if (toSave.length > 0) loadedNonEmpty.current = true;
      // keep the instant-skeleton layout cache in step with the saved canvas
      try { localStorage.setItem(`lk-layout-${projectId}`, JSON.stringify(toSave.filter((n) => n.type !== 'skeleton').map((n) => ({ id: n.id, type: n.type, position: n.position })))); } catch { /* ignore */ }
      ok = true;
    } catch (e) {
      dirty.current = true; // failed — keep dirty so it retries
      console.error('[autosave] save failed, will retry', e);
    } finally {
      saving.current = false;
      // Back off exponentially when the DB is failing (522 / timeout) so the app
      // never hammers a degraded instance; reset the moment a save succeeds.
      saveFailStreak.current = ok ? 0 : Math.min(6, saveFailStreak.current + 1);
      if (dirty.current) {
        const delay = ok ? 700 : Math.min(30000, 1000 * 2 ** saveFailStreak.current);
        setSaveDegraded(!ok && saveFailStreak.current >= 2);
        setTimeout(() => void saveRef.current(), delay);
      } else {
        setSaveDegraded(false);
      }
    }
  }, [projectId, nodes, edges, flowSig, setNodes]);

  // keep a ref to the latest save so leave-handlers can flush without re-subscribing
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!loaded.current) return;
    const sig = flowSig(nodes, edges);
    if (sig === lastSig.current) return; // selection / hover / measurement only — don't rewrite the flow
    lastSig.current = sig;
    dirty.current = true;
    const t = setTimeout(() => { void save(); }, 2500); // longer debounce = fewer DB writes
    return () => clearTimeout(t);
  }, [nodes, edges, save, flowSig]);

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
    if (editingShip && !ids.has(editingShip)) setEditingShip(null);
  }, [nodes, editing, editingTechpack, editingExtract, editingPattern, editingManufacture, editingRetailer, editingSample, editingShip]);

  // Disconnecting a Produce node (no upstream product plugged in) resets it back to
  // a fresh state — clear the chosen factory, sample, order and mode.
  useEffect(() => {
    if (!loaded.current) return;
    for (const n of nodes) {
      if ((n.data as { type?: string })?.type !== 'sample') continue;
      const hasIncoming = edges.some((e) => e.target === n.id);
      if (hasIncoming) continue;
      const dd = n.data as { sample?: unknown; manufacturer?: unknown; order?: unknown };
      if (dd.sample || dd.manufacturer || dd.order) {
        setNodeData(n.id, { sample: undefined, manufacturer: undefined, order: undefined, produceMode: undefined });
      }
    }
  }, [nodes, edges, setNodeData]);

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
    // Accumulate any newly-seen image into the persistent library list. We never
    // drop URLs, so re-generating a node adds a new entry instead of replacing it.
    for (const n of nodes) {
      const d = n.data as { image?: string; views?: Record<string, string>; type?: string } | undefined;
      const kind = KIND[d?.type ?? ''] ?? 'Media';
      const urls: string[] = [];
      if (d?.views) for (const u of Object.values(d.views)) if (typeof u === 'string') urls.push(u);
      if (typeof d?.image === 'string') urls.push(d.image);
      for (const u of urls) {
        if (u && (u.startsWith('data:') || /^https?:/.test(u)) && !libSeen.current.has(u)) {
          libSeen.current.add(u); libAccum.current.push({ url: u, kind });
        }
      }
    }
    return libAccum.current.map((it, i) => ({ id: `lib-${i}`, url: it.url, kind: it.kind })).reverse(); // most recent first
  }, [nodes]);

  const editingLabel = useMemo<Label | undefined>(() => {
    if (!editing) return undefined;
    return (nodes.find((n) => n.id === editing)?.data as { label?: Label } | undefined)?.label;
  }, [editing, nodes]);

  const editingViews = useMemo<Partial<Record<View, string>>>(() => {
    if (!editing) return {};
    const d = nodes.find((n) => n.id === editing)?.data as { image?: string; views?: Partial<Record<View, string>> } | undefined;
    // data.image is the source of truth for the front view (a prompt/upload result,
    // or the last drawn front) — it overrides any stale/blank views.front.
    const views = { ...(d?.views ?? {}) };
    if (d?.image) views.front = d.image;
    return views;
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

  const editingTechpackGenerating = useMemo<boolean>(() => {
    if (!editingTechpack) return false;
    return !!(nodes.find((n) => n.id === editingTechpack)?.data as { techpackGenerating?: boolean } | undefined)?.techpackGenerating;
  }, [editingTechpack, nodes]);

  const editingTechpackLoading = useMemo<{ flats: string[]; materials: number } | undefined>(() => {
    if (!editingTechpack) return undefined;
    return (nodes.find((n) => n.id === editingTechpack)?.data as { tpLoading?: { flats: string[]; materials: number } } | undefined)?.tpLoading;
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

  // Create Sample: EVERY tech pack wired into the produce node (so multiple
  // connected pieces all show up as products you'd sample), plus the stored sample.
  const editingSampleTechpacks = useMemo<Techpack[]>(() => {
    if (!editingSample) return [];
    const tps: Techpack[] = [];
    for (const e of edges) {
      if (e.target !== editingSample) continue;
      const src = nodes.find((n) => n.id === e.source);
      const tp = (src?.data as { techpack?: Techpack } | undefined)?.techpack;
      if (tp) tps.push(tp);
    }
    return tps;
  }, [editingSample, nodes, edges]);
  const editingSampleTechpack = editingSampleTechpacks[0];

  const editingSampleValue = useMemo<Sample | undefined>(() => {
    if (!editingSample) return undefined;
    return (nodes.find((n) => n.id === editingSample)?.data as { sample?: Sample } | undefined)?.sample;
  }, [editingSample, nodes]);

  const editingSampleHasShip = useMemo<boolean>(() => {
    if (!editingSample) return false;
    return edges.some((e) => e.source === editingSample && typeOf(e.target) === 'ship');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSample, nodes, edges]);

  // Produce node: sample-vs-bulk mode + the chosen manufacturer (bulk mode)
  const editingSampleMode = useMemo<'sample' | 'bulk'>(() => {
    if (!editingSample) return 'sample';
    return (nodes.find((n) => n.id === editingSample)?.data as { produceMode?: 'sample' | 'bulk' } | undefined)?.produceMode ?? 'sample';
  }, [editingSample, nodes]);

  const editingSampleManufacturerId = useMemo<string | undefined>(() => {
    if (!editingSample) return undefined;
    return (nodes.find((n) => n.id === editingSample)?.data as { manufacturer?: ChosenManufacturer } | undefined)?.manufacturer?.id;
  }, [editingSample, nodes]);

  const editingSampleOrder = useMemo<Order | undefined>(() => {
    if (!editingSample) return undefined;
    return (nodes.find((n) => n.id === editingSample)?.data as { order?: Order } | undefined)?.order;
  }, [editingSample, nodes]);

  // Ship node: the product it's shipping (nearest tech pack upstream), the chosen
  // destination, and any tracking handed down from a produce order.
  const editingShipTechpack = useMemo<Techpack | undefined>(() => {
    if (!editingShip) return undefined;
    let cur: string | undefined = editingShip;
    const seen = new Set<string>();
    for (let i = 0; i < 8 && cur && !seen.has(cur); i++) {
      seen.add(cur);
      const edge = edges.find((e) => e.target === cur);
      if (!edge) break;
      const src = nodes.find((n) => n.id === edge.source);
      const tp = (src?.data as { techpack?: Techpack } | undefined)?.techpack;
      if (tp) return tp;
      cur = edge.source;
    }
    return undefined;
  }, [editingShip, nodes, edges]);

  const editingShipTracking = useMemo(() => {
    if (!editingShip) return undefined;
    return (nodes.find((n) => n.id === editingShip)?.data as { tracking?: { number: string; carrier: string; orderNo?: string } } | undefined)?.tracking;
  }, [editingShip, nodes]);

  // Simulated liaison agent: advance any live production order through its stages,
  // recording the manufacturer's "updates". (Real manufacturer comms wire in here.)
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      for (const n of nodesRef.current) {
        const o = (n.data as { order?: Order } | undefined)?.order;
        if (!o) continue;
        const next = tickOrder(o, now);
        if (next !== o) setNodeData(n.id, { order: next });
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [setNodeData]);

  // Green-light shipping: mark the order shipped, mint a tracking number, and hand
  // it to a connected Ship node.
  const shipOrder = useCallback((produceId: string) => {
    const node = nodesRef.current.find((n) => n.id === produceId);
    const order = (node?.data as { order?: Order } | undefined)?.order;
    if (!order) return;
    const tracking = 'LK' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const factoryOrderNo = order.factoryOrderNo ?? `LK-${order.id.slice(-6).toUpperCase()}`;
    const shipped: Order = { ...order, status: 'shipped', carrier: 'DHL Express', trackingNumber: tracking, factoryOrderNo };
    setNodeData(produceId, { order: shipped });
    const shipEdge = edgesRef.current.find((e) => e.source === produceId && typeOf(e.target) === 'ship');
    if (shipEdge?.target) setNodeData(shipEdge.target, { tracking: { number: tracking, carrier: 'DHL Express', orderNo: factoryOrderNo } });
  }, [setNodeData]);

  // Build stages[0..upto] as real nodes wired in sequence from `afterId`, then
  // continue the ghost chain off the last one. Called when a ghost is clicked.
  const materializeChain = useCallback((afterId: string, stages: StageKey[], upto: number) => {
    const afterNode = nodesRef.current.find((n) => n.id === afterId);
    if (!afterNode) return;
    let x = afterNode.position.x;
    let w = (afterNode as { measured?: { width?: number } }).measured?.width ?? 236;
    const y = afterNode.position.y;
    let anchorId = afterId;
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const end = Math.min(upto, stages.length - 1);
    for (let i = 0; i <= end; i++) {
      const type = stages[i];
      x = x + w + 90; w = 236;
      const id = `${type}-${Date.now().toString(36)}-${counter++}`;
      newNodes.push({ id, type: CUSTOM[type] ?? 'stage', position: { x, y }, data: { type }, selected: i === end, className: 'spawn-flash' });
      newEdges.push({ id: `e-${anchorId}-${id}`, source: anchorId, target: id, type: 'wire' });
      anchorId = id;
    }
    setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), ...newNodes]);
    setEdges((es) => es.concat(newEdges));
    const ids = new Set(newNodes.map((n) => n.id));
    setTimeout(() => setNodes((ns) => ns.map((n) => (ids.has(n.id) ? { ...n, className: undefined } : n))), 1100);
    // keep the suggestion going off the last new node
    const rest = stages.slice(end + 1);
    setGhost(rest.length ? { after: anchorId, stages: rest } : null);
  }, [setNodes, setEdges]);

  // Publish the tech pack as a public web page and copy the link — so it can be
  // handed straight to a manufacturer with no app/account.
  const shareTechpack = useCallback(async (id: string) => {
    const node = nodesRef.current.find((n) => n.id === id);
    const d = node?.data as { techpack?: Techpack; shareId?: string; sharing?: boolean } | undefined;
    if (!d?.techpack || d.sharing) return;
    const shareId = d.shareId ?? ('tp' + Math.random().toString(36).slice(2, 11));
    setNodeData(id, { sharing: true, shareError: undefined });
    try {
      const r = await fetch('/api/techpack/share', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ techpack: d.techpack, shareId }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) {
        setNodeData(id, { sharing: false, shareId, shareUrl: j.url, shareError: undefined, shareCopied: true });
        const name = d.techpack.name && d.techpack.name !== 'Untitled garment' ? ` for ${d.techpack.name}` : '';
        const message = `Here's the finalised tech pack${name} — everything you need to quote and produce it is on this page:\n\n${j.url}`;
        try { await navigator.clipboard.writeText(message); } catch { /* clipboard blocked — link still on node */ }
        // reset the "Link copied" label after a moment so it doesn't stick forever
        setTimeout(() => setNodeData(id, { shareCopied: false }), 2500);
      } else {
        setNodeData(id, { sharing: false, shareError: j.error || `share failed (${r.status})` });
      }
    } catch (e) { setNodeData(id, { sharing: false, shareError: (e as Error).message || 'share failed' }); }
  }, [setNodeData]);

  // Render the ghost chain (non-persisted nodes) trailing off `ghost.after`.
  const displayNodes = useMemo<Node[]>(() => {
    // Inject the upstream product render + name into each produce node so its card
    // can show the piece being made (render-only — never written to the saved flow).
    const prodFor = (nodeId: string): { image?: string; name?: string; techpackReady: boolean } => {
      let cur: string | undefined = nodeId;
      const seen = new Set<string>();
      let image: string | undefined; let name: string | undefined; let techpackReady = false;
      for (let i = 0; i < 8 && cur && !seen.has(cur); i++) {
        seen.add(cur);
        const e = edges.find((x) => x.target === cur);
        if (!e) break;
        const src = nodes.find((n) => n.id === e.source);
        const dd = src?.data as { techpack?: Techpack; techpackGenerating?: boolean; image?: string; views?: Record<string, string> } | undefined;
        const tp = dd?.techpack;
        // a FULLY generated tech pack: finished drafting + has its front technical flat
        // (the core deliverable) and a real name. Only then is the piece produceable.
        if (tp && !dd?.techpackGenerating && tp.flats?.front && tp.name && tp.name !== 'Untitled garment') techpackReady = true;
        if (image === undefined && name === undefined) {
          image = tp?.mockups?.front ?? tp?.flats?.front ?? tp?.references?.[0] ?? dd?.image
            ?? (dd?.views ? (dd.views.front ?? Object.values(dd.views)[0]) : undefined);
          name = tp?.name && tp.name !== 'Untitled garment' ? tp.name : undefined;
        }
        cur = e.source;
      }
      return { image, name, techpackReady };
    };
    const base = nodes.map((n) => {
      if ((n.data as { type?: string })?.type !== 'sample') return n;
      const { image, name, techpackReady } = prodFor(n.id);
      const cur = n.data as { productImage?: string; productName?: string; techpackReady?: boolean };
      if (image === cur.productImage && name === cur.productName && techpackReady === cur.techpackReady) return n;
      return { ...n, data: { ...n.data, productImage: image, productName: name, techpackReady } };
    });

    const COL = 236 + 90; // column pitch (node width + gap)
    const hasModelChild = (nid: string) => edges.some((e) => e.source === nid
      && (nodes.find((n) => n.id === e.target)?.data as { type?: string } | undefined)?.type === 'visualise');
    const ghosts: Node[] = [];

    // main suggestion chain — all on the SAME horizontal line as the parent.
    if (ghost) {
      const after = base.find((n) => n.id === ghost.after);
      if (after) {
        const y = after.position.y;
        const afterW = (after as { measured?: { width?: number } }).measured?.width ?? 236;
        const col0 = after.position.x + afterW + 90;
        // the whole chain stays on the parent's line; the Model branch rises above it
        ghost.stages.forEach((stage, i) => {
          ghosts.push({
            id: `__ghost_${i}__`, type: 'ghost', position: { x: col0 + i * COL, y },
            data: {
              label: STAGE_LABEL[stage] ?? stage,
              onAdd: () => materializeChain(ghost.after, ghost.stages, i),
              onDismiss: () => setGhost(null),
            },
            width: 236, height: 315, measured: { width: 236, height: 315 },
            draggable: false, selectable: false, deletable: false, connectable: false,
          } as Node);
        });
      }
    }

    // independent Model branch off a sketch — column 0, SAME line, and it survives
    // even after the tech-pack chain is materialised (and vice versa).
    if (branch) {
      const sk = base.find((n) => n.id === branch);
      if (sk && (sk.data as { type?: string } | undefined)?.type === 'sketch' && !hasModelChild(branch)) {
        const skW = (sk as { measured?: { width?: number } }).measured?.width ?? 236;
        // above the first chain column (techpack), branching up off the sketch
        const bpos = { x: sk.position.x + skW + 90, y: sk.position.y - 315 - 60 };
        ghosts.push({
          id: '__ghost_branch_visualise__', type: 'ghost', position: bpos,
          data: {
            label: STAGE_LABEL.visualise ?? 'Model',
            onAdd: () => { addNode('visualise', branch, bpos, true); setBranch(null); },
            onDismiss: () => setBranch(null),
          },
          width: 236, height: 315, measured: { width: 236, height: 315 },
          draggable: false, selectable: false, deletable: false, connectable: false,
        } as Node);
      }
    }

    return ghosts.length ? [...base, ...ghosts] : base;
  }, [nodes, edges, ghost, branch, materializeChain, addNode]);

  // Dashed edges chaining after → ghost0 → ghost1 → … so it reads as plugged in.
  const displayEdges = useMemo<Edge[]>(() => {
    const style = { stroke: light ? 'rgba(0,0,0,.5)' : '#a9f0d0', strokeWidth: 1.5, strokeDasharray: '6 5', opacity: light ? 0.7 : 0.5 };
    const gedges: Edge[] = [];
    if (ghost && nodes.some((n) => n.id === ghost.after)) {
      ghost.stages.forEach((_, i) => gedges.push({
        id: `__ghostedge_${i}__`,
        source: i === 0 ? ghost.after : `__ghost_${i - 1}__`,
        target: `__ghost_${i}__`,
        type: 'default', animated: true, selectable: false, deletable: false, focusable: false, style,
      } as Edge));
    }
    // independent branch edge: sketch → ghost Model node
    if (branch && nodes.some((n) => n.id === branch)) {
      const hasModel = edges.some((e) => e.source === branch
        && (nodes.find((n) => n.id === e.target)?.data as { type?: string } | undefined)?.type === 'visualise');
      if (!hasModel) gedges.push({
        id: '__ghostedge_branch_visualise__', source: branch, target: '__ghost_branch_visualise__',
        type: 'default', animated: true, selectable: false, deletable: false, focusable: false, style,
      } as Edge);
    }
    return gedges.length ? [...edges, ...gedges] : edges;
  }, [edges, ghost, branch, nodes, light]);

  // Hover or tap a pipeline node → show its suggested ghost chain trailing off it.
  const showChainFor = useCallback((node: Node) => {
    if (node.type === 'ghost') return;
    const t = (node.data as { type?: StageKey } | undefined)?.type;
    // Don't let hovering a Model branch reset the parent sketch's chain suggestion —
    // otherwise clicking the Model ghost (which spawns the node under the cursor and
    // fires mouse-enter) would wipe the tech-pack chain the user still wants.
    if (t === 'visualise' && ghostRef.current) {
      const parent = edgesRef.current.find((ed) => ed.target === node.id)?.source;
      if (parent && parent === ghostRef.current.after) return;
    }
    const chain = t && !edgesRef.current.some((ed) => ed.source === node.id) ? chainFrom(t) : [];
    setGhost(chain.length ? { after: node.id, stages: chain } : null);
    // a sketch with no Model child also gets the independent Model-branch suggestion
    const hasModel = edgesRef.current.some((ed) => ed.source === node.id
      && (nodesRef.current.find((n) => n.id === ed.target)?.data as { type?: string } | undefined)?.type === 'visualise');
    setBranch(t === 'sketch' && !hasModel ? node.id : null);
  }, [chainFrom]);

  // Clear the ghost once its anchor is gone or wired up manually — but a Model branch
  // off a sketch is a parallel suggestion, not "wired up the chain", so ignore it.
  useEffect(() => {
    if (!ghost) return;
    const gone = !nodes.some((n) => n.id === ghost.after);
    // only a RESOLVED non-model child counts as "wired up the chain" — a Model branch
    // (or a transient/unfound edge target) must not clear the suggestion.
    const wiredNonModel = edges.some((e) => {
      if (e.source !== ghost.after) return false;
      const tt = (nodes.find((n) => n.id === e.target)?.data as { type?: string } | undefined)?.type;
      return !!tt && tt !== 'visualise';
    });
    if (gone || wiredNonModel) setGhost(null);
  }, [nodes, edges, ghost]);

  if (project === null) {
    return (
      <main className="home">
        <p className="home-sub">Project not found.</p>
        <Link href="/" className="new-btn" style={{ display: 'inline-block' }}>← Back to projects</Link>
      </main>
    );
  }

  return (
    <StudioContext.Provider value={{ openSketch, visualise, openTechpack, shareTechpack, openExtract, openPattern, openManufacture, openRetailer, openSample, openShip, setNodeImage, promptImage, renameGroup, setNoteText, sideLocked }}>
      <div className={`studio${light ? ' light' : ''}${glass ? ' lg' : ''}${(booting || project === undefined) && !skeletonShown ? ' emerging' : ''}`}>
        <DotField viewportRef={viewportRef} light={light} />
        {isOwner && (
          <div className="tier-preview" role="group" aria-label="Preview tier">
            <span className="tp-lbl">Preview as</span>
            <button className={!tierOverride ? 'on' : ''} onClick={() => setPreviewTier(null)} title="Your real account">Off</button>
            {(['free', 'studio', 'pro', 'brand'] as const).map((t) => (
              <button key={t} className={tierOverride === t ? 'on' : ''} onClick={() => setPreviewTier(t)}>{t}</button>
            ))}
            <span className="tp-div" aria-hidden="true" />
            <button className={`tp-glass${glass ? ' on' : ''}`} onClick={toggleGlass} title="Liquid-glass theme" aria-pressed={glass}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14l-1.5 5.5a6 6 0 0 1-4 4.2V19h3v1.5H7.5V19h3v-5.3a6 6 0 0 1-4-4.2z" /></svg>
              Glass
            </button>
          </div>
        )}
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onPaneClick={() => { setGhost(null); setBranch(null); setEditing(null); }}
          onNodeMouseEnter={(_e, node) => showChainFor(node)}
          onNodeClick={(_e, node) => { showChainFor(node); const st = (node.data as { type?: string })?.type; if (st === 'sample') openSample(node.id); else if (st === 'ship') openShip(node.id); }}
          onInit={(inst) => { rf.current = inst; viewportRef.current = inst.getViewport(); setCanvasReady(true); }}
          onMove={(_, vp) => { viewportRef.current = vp; }}
          onMoveEnd={(_, vp) => {
            viewportRef.current = vp;
            if (!loaded.current) return;
            // Panning/zooming persists the view LOCALLY only — it must never rewrite
            // the image-heavy flow to the DB (that was a major Disk IO source).
            try { localStorage.setItem(`lk-vp-${projectId}`, JSON.stringify(vp)); } catch { /* ignore */ }
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
            else if (node.type === 'ship' || (node.data as { type?: string })?.type === 'ship') openShip(node.id);
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
            <TrialBadge />
          </Panel>

          <Panel position="bottom-right">
            <button className="theme-toggle" onClick={toggleLight} title={light ? 'Switch to dark canvas' : 'Switch to light canvas'} aria-label="Toggle light mode">
              {light ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              )}
            </button>
          </Panel>

          <Panel position="center-left">
            <StudioDock stages={DOCK_STAGES} onAdd={addNode} onNote={addNote} onLibrary={() => setLibraryOpen((o) => !o)} onProfile={openProfile} isLocked={stageLocked} onLocked={(k) => openUnlock(k)} comingSoon={stageComingSoon} />
          </Panel>
        </ReactFlow>

        <PaywallModal />
        <UnlockModal />
        <ProfileModal />


        <SketchStudio
          open={!!editing}
          nodeId={editing}
          initialView={editingSketchView}
          views={editingViews}
          onView={(view, d) => { if (editing) setNodeView(editing, view, d); }}
          onViewChange={(v) => { if (editing) setNodeData(editing, { view: v }); }}
          onApplyEdits={applyEdits}
          applying={applyingEdits}
          onBringToLife={(view, d) => bringToLife(view, d)}
          label={editingLabel}
          onLabel={(l) => { if (editing) setNodeData(editing, { label: l }); }}
          onClose={() => setEditing(null)}
        />

        <TechpackPanel
          open={!!editingTechpack}
          nodeId={editingTechpack}
          value={editingTechpackValue}
          image={editingTechpackImage}
          generating={editingTechpackGenerating}
          loading={editingTechpackLoading}
          onChange={(tp) => { if (editingTechpack) setNodeData(editingTechpack, { techpack: tp }); }}
          onClose={() => setEditingTechpack(null)}
        />

        {/* legacy Extract nodes (vaulted) still open the standalone extractor */}
        <ExtractPanel
          open={!!editingExtract}
          image={editingExtractImage}
          onExtracted={(img) => { if (editingExtract) setNodeImage(editingExtract, img); }}
          onClose={() => setEditingExtract(null)}
        />

        {/* Pattern maker now extracts first, then traces the pattern automatically */}
        <PatternMakerPanel
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

        <ProducePanel
          open={!!editingSample}
          nodeId={editingSample}
          techpack={editingSampleTechpack}
          techpacks={editingSampleTechpacks}
          mode={editingSampleMode}
          sample={editingSampleValue}
          manufacturerId={editingSampleManufacturerId}
          order={editingSampleOrder}
          hasShipNode={editingSampleHasShip}
          onModeChange={(m) => { if (editingSample) setNodeData(editingSample, { produceMode: m }); }}
          onSampleChange={(s) => { if (editingSample) setNodeData(editingSample, { sample: s }); }}
          onChooseManufacturer={(m) => { if (editingSample) setNodeData(editingSample, { manufacturer: m }); }}
          onOrder={(o) => { if (editingSample) setNodeData(editingSample, { order: o }); }}
          onShip={() => { if (editingSample) shipOrder(editingSample); }}
          onClose={() => setEditingSample(null)}
        />

        <ShipPanel
          open={!!editingShip}
          techpack={editingShipTechpack}
          tracking={editingShipTracking}
          onClose={() => setEditingShip(null)}
        />
      </div>
      {libraryOpen && <StudioLibrary items={libItems} onClose={() => setLibraryOpen(false)} />}

      <CanvasMenu menu={menu} onClose={() => setMenu(null)} />


      {(booting || project === undefined) && !skeletonShown && <StudioLoader progress={progress} onDone={() => setBooting(false)} />}

      {/* reassurance while the real nodes swap in behind the skeletons (slow loads only) */}
      {showRestoring && hydratingCount > 0 && (
        <div className="canvas-restoring" role="status" aria-live="polite">
          <span className="cr-spin" aria-hidden="true" />
          Restoring your canvas — {hydratingCount} {hydratingCount === 1 ? 'piece' : 'pieces'} loading. Your work is safe.
        </div>
      )}

      {/* DB unreachable — saves are backing off, not lost */}
      {saveDegraded && (
        <div className="canvas-restoring canvas-degraded" role="status" aria-live="polite">
          <span className="cr-spin" aria-hidden="true" />
          Reconnecting… your changes are kept and will save once the server responds.
        </div>
      )}

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
