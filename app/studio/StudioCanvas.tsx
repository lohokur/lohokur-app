'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
import SketchPad from '@/components/SketchPad';
import { StudioContext } from '@/lib/studio-context';
import { STAGES, type StageKey } from '@/lib/nodeTypes';
import { getProject, saveProject } from '@/lib/client-store';
import type { Project } from '@/lib/types';

const nodeTypes = { stage: StageNode, sketch: SketchNode };
let counter = 1;

export default function StudioCanvas({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editing, setEditing] = useState<string | null>(null);
  const dirty = useRef(false);
  const loaded = useRef(false);

  useEffect(() => {
    getProject(projectId).then((p) => {
      setProject(p);
      if (p) {
        setNodes((p.flow?.nodes as Node[]) ?? []);
        setEdges((p.flow?.edges as Edge[]) ?? []);
      }
      loaded.current = true;
    });
  }, [projectId, setNodes, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => addEdge({ ...c, animated: true }, es)),
    [setEdges]
  );

  const openSketch = useCallback((id: string) => setEditing(id), []);
  const setNodeImage = useCallback(
    (id: string, image: string) =>
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, image } } : n))),
    [setNodes]
  );

  const addNode = useCallback(
    (type: StageKey) => {
      const id = `${type}-${Date.now().toString(36)}-${counter++}`;
      const isSketch = type === 'sketch';
      setNodes((ns) => [
        ...ns,
        {
          id,
          type: isSketch ? 'sketch' : 'stage',
          position: { x: 160 + (ns.length % 5) * 60, y: 120 + ns.length * 26 },
          data: { type },
        },
      ]);
      if (isSketch) setEditing(id); // drop it on the canvas AND open the pad
    },
    [setNodes]
  );

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

  const statusLabel = useMemo(
    () => (status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save'),
    [status]
  );

  const editingImage = useMemo(
    () => (editing ? (nodes.find((n) => n.id === editing)?.data as { image?: string })?.image : undefined),
    [editing, nodes]
  );

  if (project === null) {
    return (
      <main className="home">
        <p className="home-sub">Project not found.</p>
        <Link href="/" className="new-btn" style={{ display: 'inline-block' }}>← Back to projects</Link>
      </main>
    );
  }

  return (
    <StudioContext.Provider value={{ openSketch }}>
      <div className="studio">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={(_e, node) => { if (node.type === 'sketch') openSketch(node.id); }}
          nodeTypes={nodeTypes}
          colorMode="dark"
          fitView
          snapToGrid
          snapGrid={[16, 16]}
          defaultEdgeOptions={{ animated: true }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={30} size={1.4} color="rgba(255,255,255,0.09)" />
          <MiniMap pannable zoomable nodeColor="#3a4640" maskColor="rgba(6,7,9,.7)" />
          <Controls />

          <Panel position="top-left" className="topbar">
            <Link href="/" className="crumb">← Projects</Link>
            <span className="pname">{project?.name ?? '…'}</span>
          </Panel>

          <Panel position="top-right">
            <button className="save-btn" onClick={save}>{statusLabel}</button>
          </Panel>

          <Panel position="center-left" className="dock">
            <div className="dock-h">Add</div>
            {STAGES.map((s) => (
              <button key={s.key} className="dock-btn" onClick={() => addNode(s.key)} title={s.hint}>
                {s.label}
              </button>
            ))}
          </Panel>
        </ReactFlow>

        <SketchPad
          open={!!editing}
          nodeId={editing}
          image={editingImage}
          onChange={(d) => { if (editing) setNodeImage(editing, d); }}
          onClose={() => setEditing(null)}
        />
      </div>
    </StudioContext.Provider>
  );
}
