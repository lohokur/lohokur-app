'use client';

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';

const COLORS = ['#141414', '#e5484d', '#3b82f6', '#22c55e', '#eab308', '#ffffff'];
const SIZES = [2, 5, 12];
const PAPER = '#f6f3ec';
const W = 900;
const H = 680;

export default function SketchPad({
  open,
  nodeId,
  image,
  onChange,
  onClose,
}: {
  open: boolean;
  nodeId: string | null;
  image?: string;
  onChange: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const history = useRef<string[]>([]);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#141414');
  const [size, setSize] = useState(5);

  const ctx = () => canvasRef.current!.getContext('2d')!;
  const fillPaper = () => {
    const c = ctx();
    c.fillStyle = PAPER;
    c.fillRect(0, 0, W, H);
  };
  const snapshot = () => {
    history.current.push(canvasRef.current!.toDataURL());
    if (history.current.length > 30) history.current.shift();
  };
  const emit = () => onChange(canvasRef.current!.toDataURL('image/png'));

  // (re)load whenever we open a different node
  useEffect(() => {
    if (!canvasRef.current) return;
    fillPaper();
    history.current = [];
    if (image) {
      const img = new Image();
      img.onload = () => {
        ctx().drawImage(img, 0, 0, W, H);
        snapshot();
      };
      img.src = image;
    } else {
      snapshot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, open]);

  const pos = (e: RPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  };
  const down = (e: RPointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent) => {
    if (!drawing.current) return;
    const p = pos(e);
    const c = ctx();
    c.strokeStyle = tool === 'eraser' ? PAPER : color;
    c.lineWidth = tool === 'eraser' ? size * 3 : size;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(last.current!.x, last.current!.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    snapshot();
    emit();
  };
  const undo = () => {
    if (history.current.length < 2) return;
    history.current.pop();
    const prev = history.current[history.current.length - 1];
    const img = new Image();
    img.onload = () => {
      const c = ctx();
      c.clearRect(0, 0, W, H);
      c.drawImage(img, 0, 0, W, H);
      emit();
    };
    img.src = prev;
  };
  const clear = () => {
    fillPaper();
    snapshot();
    emit();
  };

  return (
    <aside className={`sketchpad${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sp-head">
        <span>Sketch pad</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="sp-canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      />

      <div className="sp-tools">
        <div className="sp-group">
          <button className={tool === 'pen' ? 'on' : ''} onClick={() => setTool('pen')}>Pen</button>
          <button className={tool === 'eraser' ? 'on' : ''} onClick={() => setTool('eraser')}>Eraser</button>
        </div>
        <div className="sp-group swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`sw${color === c && tool === 'pen' ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => { setColor(c); setTool('pen'); }}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
        <div className="sp-group">
          {SIZES.map((s) => (
            <button key={s} className={`sz${size === s ? ' on' : ''}`} onClick={() => setSize(s)} aria-label={`Size ${s}`}>
              <span style={{ width: s + 3, height: s + 3 }} />
            </button>
          ))}
          <button onClick={undo}>Undo</button>
          <button onClick={clear}>Clear</button>
        </div>
        <button className="sp-done" onClick={onClose}>Done</button>
      </div>
    </aside>
  );
}
