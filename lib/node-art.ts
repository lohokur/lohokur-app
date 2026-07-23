// Procedural generative-art background — the same grainy, glowing look as the
// dashboard cards (ported from the homepage halo). A grey palette gives the
// "highlighter" glow + grain that node cards use behind their icons.

const GREY = ['#45464c', '#ece9e2', '#7c7d84', '#141518'];

function mk(seed: number) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function hexc(h: string) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

function paintArt(cv: HTMLCanvasElement, cols: string[], seed: number) {
  const w = cv.width, h = cv.height, x = cv.getContext('2d'); if (!x) return;
  const R = mk(seed + 7);
  const base = hexc(cols[cols.length - 1] || '#101012');
  x.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; x.fillRect(0, 0, w, h);
  // glowing radial blooms (additive) — the "highlighter" light
  for (let i = 0; i < 7; i++) {
    const cx = R() * w, cy = R() * h, rad = (0.25 + R() * 0.6) * w;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad), c = cols[i % cols.length];
    g.addColorStop(0, c + 'cc'); g.addColorStop(1, c + '00');
    x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill();
  }
  // faint diagonal streaks
  x.globalCompositeOperation = 'overlay'; const lite = cols[1] || cols[0];
  for (let j = 0; j < 9; j++) {
    x.strokeStyle = `rgba(${hexc(lite).join(',')},${(0.05 + R() * 0.14).toFixed(2)})`;
    x.lineWidth = 1 + R() * 2; x.beginPath(); const yy = R() * h; x.moveTo(-10, yy); x.lineTo(w + 10, yy + (R() - 0.5) * h * 0.5); x.stroke();
  }
  // film grain
  x.globalCompositeOperation = 'source-over';
  const img = x.getImageData(0, 0, w, h), d2 = img.data;
  for (let p = 0; p < d2.length; p += 4) { const n = (R() * 255) | 0, a = 18; d2[p] += (n - 128) * a / 255; d2[p + 1] += (n - 128) * a / 255; d2[p + 2] += (n - 128) * a / 255; }
  x.putImageData(img, 0, 0);
  // top sheen → bottom shade
  const sg = x.createLinearGradient(0, 0, 0, h);
  sg.addColorStop(0, 'rgba(255,255,255,.16)'); sg.addColorStop(.25, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(0,0,0,.28)');
  x.fillStyle = sg; x.fillRect(0, 0, w, h);
}

export function paintNodeArt(cv: HTMLCanvasElement, seed: number) {
  paintArt(cv, GREY, seed);
}

// stable per-node seed from its id, so each card's art is unique but consistent
export function seedFrom(id: string): number {
  let s = 0;
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) >>> 0;
  return s % 100000;
}
