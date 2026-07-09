// Minimal 3D-garment-surface → 2D-pattern flattening (the core LA VIPÈRE-style idea).
// A triangle-mesh surface is unfolded to the plane by relaxing every edge toward its
// true 3D length (as-isometric-as-possible). Where the surface has Gaussian curvature
// it CANNOT flatten without distortion — so the residual stretch shows exactly where a
// dart/seam is needed. Pure geometry, no AI, runs in the browser.

export type Mesh = { V: [number, number, number][]; F: [number, number, number][] };
export type Garment = { key: string; label: string; note: string; mesh: Mesh };

const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

/* ---------- sample garment surfaces ---------- */

// a truncated cone = a sleeve. Developable → flattens to a flat sector with ~0 distortion.
function sleeve(nu = 24, nv = 12): Mesh {
  const V: [number, number, number][] = [];
  const F: [number, number, number][] = [];
  const rTop = 90, rBot = 150, h = 320, span = Math.PI; // half-tube sleeve
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const r = rTop + (rBot - rTop) * v;
    for (let i = 0; i <= nu; i++) {
      const a = -span / 2 + span * (i / nu);
      V.push([r * Math.sin(a), -h * v, r * Math.cos(a)]);
    }
  }
  const w = nu + 1;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const p = j * w + i;
      F.push([p, p + 1, p + w]);
      F.push([p + 1, p + w + 1, p + w]);
    }
  return { V, F };
}

// a flat bodice panel with a bust curve (Gaussian bump) = NON-developable.
// Flattening it leaves excess material around the bump → that's where the dart goes.
function bodice(nu = 22, nv = 26): Mesh {
  const V: [number, number, number][] = [];
  const F: [number, number, number][] = [];
  const W = 320, H = 420, amp = 130, sx = 70, sy = 90, cx = 0, cy = -70;
  for (let j = 0; j <= nv; j++) {
    const y = -H / 2 + H * (j / nv);
    for (let i = 0; i <= nu; i++) {
      const x = -W / 2 + W * (i / nu);
      const z = amp * Math.exp(-(((x - cx) ** 2) / (2 * sx * sx) + ((y - cy) ** 2) / (2 * sy * sy)));
      V.push([x, y, z]);
    }
  }
  const w = nu + 1;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const p = j * w + i;
      F.push([p, p + 1, p + w]);
      F.push([p + 1, p + w + 1, p + w]);
    }
  return { V, F };
}

// a cowl / draped panel — strong curvature, lots of excess.
function cowl(nu = 26, nv = 22): Mesh {
  const V: [number, number, number][] = [];
  const F: [number, number, number][] = [];
  const W = 360, H = 340;
  for (let j = 0; j <= nv; j++) {
    const y = -H / 2 + H * (j / nv);
    for (let i = 0; i <= nu; i++) {
      const x = -W / 2 + W * (i / nu);
      const z = 120 * Math.sin((Math.PI * (i / nu))) * (0.4 + 0.6 * (1 - j / nv));
      V.push([x, y, z]);
    }
  }
  const w = nu + 1;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const p = j * w + i;
      F.push([p, p + 1, p + w]);
      F.push([p + 1, p + w + 1, p + w]);
    }
  return { V, F };
}

// a structured, origami-shouldered jacket front. Faceted (not smooth): diamond
// pyramids give the sharp angular shoulders, a tapered silhouette with a neck
// opening reads as the garment, plus a centre fold ridge + knot. The facets
// themselves are flat (developable — a crease unfolds clean); curvature is
// concentrated only at the pyramid apexes, which is exactly where joins/darts go.
function structured(nx = 40, ny = 48): Mesh {
  const Wb = 460, Hb = 480;
  const yTop = Hb / 2;

  // garment outline: square wide shoulders → taper to waist → slight peplum flare
  const halfW = (y: number) => {
    const yShoulder = 118, yWaist = -120, yHem = -232;
    if (y >= yShoulder) return 210;
    if (y >= yWaist) { const t = (y - yWaist) / (yShoulder - yWaist); return 118 + t * (210 - 118); }
    const t = Math.max(0, Math.min(1, (y - yHem) / (yWaist - yHem)));
    return 118 + (1 - t) * (155 - 118);
  };
  const inside = (x: number, y: number) => {
    if (y > yTop || y < -232) return false;
    if (Math.abs(x) > halfW(y)) return false;
    if (y > 150 && Math.abs(x) < 52) return false; // neck / head opening
    return true;
  };
  // faceted height field — L1 (diamond) pyramids give sharp origami ridges
  const height = (x: number, y: number) => {
    const pyr = (cx: number, cy: number, r: number, h: number) => {
      const d = (Math.abs(x - cx) + Math.abs(y - cy)) / r;
      return d < 1 ? h * (1 - d) : 0;
    };
    let z = 0;
    z = Math.max(z, pyr(-138, 150, 120, 155)); // left structured shoulder
    z = Math.max(z, pyr(138, 150, 120, 155));  // right structured shoulder
    z = Math.max(z, pyr(0, 150, 88, 58));       // collar
    z = Math.max(z, pyr(0, 40, 58, 92));        // centre knot
    if (Math.abs(x) < 26 && y < 118 && y > -64) z = Math.max(z, 40 * (1 - Math.abs(x) / 26)); // fold ridge
    return z;
  };

  const V: [number, number, number][] = [];
  const F: [number, number, number][] = [];
  const idx = new Map<number, number>();
  const vert = (i: number, j: number): number | null => {
    const x = -Wb / 2 + Wb * (i / nx);
    const y = -Hb / 2 + Hb * (j / ny);
    if (!inside(x, y)) return null;
    const k = j * (nx + 1) + i;
    let vi = idx.get(k);
    if (vi === undefined) { vi = V.length; V.push([x, y, height(x, y)]); idx.set(k, vi); }
    return vi;
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      if (a !== null && b !== null && c !== null) F.push([a, b, c]);
      if (b !== null && d !== null && c !== null) F.push([b, d, c]);
    }
  return { V, F };
}

export const GARMENTS: Garment[] = [
  { key: 'sleeve', label: 'Sleeve (cone)', note: 'developable — flattens clean', mesh: sleeve() },
  { key: 'bodice', label: 'Bodice + bust', note: 'curved — dart needed at the bust', mesh: bodice() },
  { key: 'cowl', label: 'Draped panel', note: 'strong curvature — lots of excess', mesh: cowl() },
  { key: 'structured', label: 'Structured jacket', note: 'sharp shoulder peaks — seams converge at each apex', mesh: structured() },
];

/* ---------- flattening (edge-length relaxation) ---------- */

export type FlatResult = {
  P: [number, number][]; // 2D positions per vertex
  F: [number, number, number][];
  triDistortion: number[]; // 0 = isometric, higher = more stretch
  meanDistortion: number;
};

function edges(F: [number, number, number][]): [number, number][] {
  const set = new Set<string>();
  const E: [number, number][] = [];
  for (const [a, b, c] of F)
    for (const [i, j] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const k = i < j ? `${i}_${j}` : `${j}_${i}`;
      if (!set.has(k)) { set.add(k); E.push([i, j]); }
    }
  return E;
}

export function flatten(mesh: Mesh, iterations = 260): FlatResult {
  const { V, F } = mesh;
  const E = edges(F);
  const rest = E.map(([i, j]) => len3(sub(V[i], V[j])));

  // init: drop the z coord (orthographic) as a starting guess
  const P: [number, number][] = V.map((v) => [v[0], v[1]]);

  // Gauss–Seidel style: pull each edge toward its true 3D length
  for (let it = 0; it < iterations; it++) {
    for (let e = 0; e < E.length; e++) {
      const [i, j] = E[e];
      const dx = P[j][0] - P[i][0];
      const dy = P[j][1] - P[i][1];
      const L = Math.hypot(dx, dy) || 1e-6;
      const diff = (L - rest[e]) / L;
      const cx = 0.5 * diff * dx;
      const cy = 0.5 * diff * dy;
      P[i][0] += cx; P[i][1] += cy;
      P[j][0] -= cx; P[j][1] -= cy;
    }
  }

  // per-triangle distortion = mean relative edge-length error
  const triDistortion = F.map(([a, b, c]) => {
    let s = 0;
    for (const [i, j] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const d3 = len3(sub(V[i], V[j]));
      const d2 = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
      s += Math.abs(d2 - d3) / (d3 || 1);
    }
    return s / 3;
  });
  const meanDistortion = triDistortion.reduce((a, b) => a + b, 0) / (triDistortion.length || 1);
  return { P, F, triDistortion, meanDistortion };
}

/* ---------- render the flat pattern as SVG (heat-mapped by distortion) ---------- */

function heat(t: number): string {
  const x = Math.max(0, Math.min(1, t / 0.18)); // scale: 18% stretch = full red
  const r = Math.round(124 + x * (255 - 124));
  const g = Math.round(255 - x * (255 - 90));
  const b = Math.round(176 - x * (176 - 90));
  return `rgb(${r},${g},${b})`;
}

export function toSVG(res: FlatResult, pad = 30): string {
  const xs = res.P.map((p) => p[0]);
  const ys = res.P.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const X = (x: number) => (x - minX + pad).toFixed(1);
  const Y = (y: number) => (y - minY + pad).toFixed(1);
  const tris = res.F.map((f, k) => {
    const [a, b, c] = f;
    return `<polygon points="${X(res.P[a][0])},${Y(res.P[a][1])} ${X(res.P[b][0])},${Y(res.P[b][1])} ${X(res.P[c][0])},${Y(res.P[c][1])}" fill="${heat(res.triDistortion[k])}" fill-opacity="0.55" stroke="rgba(0,0,0,.18)" stroke-width="0.4"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" style="background:#0e1013"><g>${tris}</g></svg>`;
}
