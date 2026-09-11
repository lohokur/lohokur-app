'use client';

import { useEffect, useRef, useState } from 'react';
import type { Label } from '@/lib/techpack';

// Design the brand / care label for this pipeline. Renders a clean woven-label
// image on a canvas, saved onto the sketch node — it then propagates downstream
// (the tech pack, etc.) from wherever this sketch is connected.
const W = 640, H = 400;

export default function LabelDesigner({
  open, value, onSave, onClose,
}: {
  open: boolean;
  value?: Label;
  onSave: (label: Label) => void;
  onClose: () => void;
}) {
  const [brand, setBrand] = useState(value?.brand ?? '');
  const [care, setCare] = useState(value?.care ?? 'MADE IN\n100% COTTON\nMACHINE WASH COLD\nDO NOT TUMBLE DRY');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { if (open) { setBrand(value?.brand ?? ''); setCare(value?.care ?? 'MADE IN\n100% COTTON\nMACHINE WASH COLD\nDO NOT TUMBLE DRY'); } }, [open, value]);

  // live-render the label onto the canvas
  useEffect(() => {
    const cv = canvasRef.current; if (!cv || !open) return;
    const c = cv.getContext('2d'); if (!c) return;
    c.clearRect(0, 0, W, H);
    // cream woven tag
    c.fillStyle = '#f6f3ec'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 2; c.strokeRect(14, 14, W - 28, H - 28);
    // brand
    c.fillStyle = '#141414'; c.textAlign = 'center';
    c.font = '700 54px "Helvetica Neue", Helvetica, Arial, sans-serif';
    c.fillText((brand || 'YOUR BRAND').toUpperCase(), W / 2, 132);
    // divider
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(W / 2 - 120, 168); c.lineTo(W / 2 + 120, 168); c.stroke();
    // care lines
    c.font = '400 22px ui-monospace, "SF Mono", Menlo, monospace';
    c.fillStyle = '#3a3a3a';
    const lines = care.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 6);
    lines.forEach((l, i) => c.fillText(l, W / 2, 214 + i * 32));
  }, [brand, care, open]);

  if (!open) return null;

  const save = () => {
    const img = canvasRef.current?.toDataURL('image/png');
    onSave({ brand: brand.trim(), care: care.trim(), image: img });
    onClose();
  };

  return (
    <div className="ld-scrim" onMouseDown={onClose}>
      <div className="ld-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ld-head"><span>Design your label</span><button className="sp-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="ld-body">
          <div className="ld-preview"><canvas ref={canvasRef} width={W} height={H} /></div>
          <div className="ld-fields">
            <label className="ld-f">Brand name<input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Your brand" /></label>
            <label className="ld-f">Care & content<textarea rows={5} value={care} onChange={(e) => setCare(e.target.value)} placeholder="One line each" /></label>
            <p className="ld-note">This label carries through the whole pipeline from this sketch — into the tech pack and beyond.</p>
          </div>
        </div>
        <div className="ld-foot">
          <button className="ld-save" onClick={save}>Save label</button>
        </div>
      </div>
    </div>
  );
}
