'use client';

import { useEffect, useRef, useState } from 'react';

const SIZE = 152;
const R = SIZE / 2;

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
function hex2rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgb2hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');

// A simple HSV colour wheel: pick hue + saturation on the disc, brightness on the bar.
export default function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(...hex2rgb(value)));

  // keep the wheel in sync when the colour changes elsewhere (e.g. eyedropper)
  useEffect(() => {
    const cur = rgb2hex(...hsvToRgb(hsv[0], hsv[1], hsv[2]));
    if (cur.toLowerCase() !== value.toLowerCase()) setHsv(rgbToHsv(...hex2rgb(value)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // paint the disc once, always at full brightness (colourful); brightness is a
  // separate control so the wheel stays inviting even for dark colours.
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const dx = x - R, dy = y - R, dist = Math.sqrt(dx * dx + dy * dy), i = (y * SIZE + x) * 4;
      if (dist <= R) {
        const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const s = Math.min(1, dist / R);
        const [rr, gg, bb] = hsvToRgb(h, s, 1);
        img.data[i] = rr; img.data[i + 1] = gg; img.data[i + 2] = bb;
        img.data[i + 3] = dist > R - 1 ? Math.max(0, (R - dist) * 255) : 255; // soft edge
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const pick = (e: React.PointerEvent) => {
    const cv = ref.current!; const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * SIZE - R;
    const y = ((e.clientY - r.top) / r.height) * SIZE - R;
    const h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const s = Math.min(1, Math.sqrt(x * x + y * y) / R);
    setHsv([h, s, hsv[2]]);
    onChange(rgb2hex(...hsvToRgb(h, s, hsv[2])));
  };
  const setV = (v: number) => { setHsv([hsv[0], hsv[1], v]); onChange(rgb2hex(...hsvToRgb(hsv[0], hsv[1], v))); };

  const mx = R + Math.cos(hsv[0] * Math.PI / 180) * hsv[1] * R;
  const my = R + Math.sin(hsv[0] * Math.PI / 180) * hsv[1] * R;

  return (
    <div className="cw">
      <div className="cw-disc" style={{ width: SIZE, height: SIZE }}>
        <canvas ref={ref} width={SIZE} height={SIZE} onPointerDown={pick} onPointerMove={(e) => { if (e.buttons) pick(e); }} />
        <span className="cw-marker" style={{ left: `${(mx / SIZE) * 100}%`, top: `${(my / SIZE) * 100}%`, background: value }} />
      </div>
      <input className="cw-val" type="range" min={0} max={100} value={Math.round(hsv[2] * 100)}
        onChange={(e) => setV(+e.target.value / 100)}
        style={{ background: `linear-gradient(90deg, #000, ${rgb2hex(...hsvToRgb(hsv[0], hsv[1], 1))})` }} />
    </div>
  );
}
