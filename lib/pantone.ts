import 'server-only';
import data from '@/lib/pantone-colors.json';

// Nearest official Pantone colour to a hex, so colourways sync to a real Pantone
// name. Dataset: 2,310 Pantone colours (name + hex). Server-only — keeps the
// dataset out of the client bundle.

const names: string[] = (data as { names: string[] }).names;
const values: string[] = (data as { values: string[] }).values;

// pre-parse the palette to RGB once
const rgb = values.map((h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as number[];
});

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Returns the Pantone colour name closest to the given hex (weighted-RGB distance,
// a cheap perceptual approximation), or '' if the hex is unparseable.
export function nearestPantone(hex: string): string {
  const c = hexToRgb(hex);
  if (!c) return '';
  let best = -1, bestD = Infinity;
  for (let i = 0; i < rgb.length; i++) {
    const dr = c[0] - rgb[i][0], dg = c[1] - rgb[i][1], db = c[2] - rgb[i][2];
    // luminance-weighted so matches read closer to human perception
    const d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best >= 0 ? titleCase(names[best]) : '';
}
