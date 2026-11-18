// Pure, deterministic noise helpers used by the procedural texture/geometry generators (no DOM, no three.js).

/** Integer hash -> [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

const wrap = (i: number, n: number): number => ((i % n) + n) % n;
const smooth = (t: number): number => t * t * (3 - 2 * t);

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a: number, b: number, v: number): number => smooth(clamp01((v - a) / (b - a)));

/** Value noise in [0,1] that repeats every `px` x `py` lattice cells (seamless textures). */
export function valueNoise(x: number, y: number, px: number, py: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const ix0 = wrap(x0, px);
  const iy0 = wrap(y0, py);
  const ix1 = wrap(x0 + 1, px);
  const iy1 = wrap(y0 + 1, py);
  const a = hash2(ix0, iy0, seed);
  const b = hash2(ix1, iy0, seed);
  const c = hash2(ix0, iy1, seed);
  const d = hash2(ix1, iy1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fractal value noise in [0,1], periodic in (px, py) base cells. */
export function fbm(x: number, y: number, px: number, py: number, octaves: number, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * f, y * f, px * f, py * f, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

export interface VoronoiSample {
  /** Distance to nearest / second nearest feature point, in cell units. */
  d1: number;
  d2: number;
  id: number;
}

/** Periodic jittered-grid Voronoi over an nx x ny lattice; x,y in lattice units. */
export function voronoi(x: number, y: number, nx: number, ny: number, seed = 0): VoronoiSample {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = cx + i;
      const gy = cy + j;
      const wx = wrap(gx, nx);
      const wy = wrap(gy, ny);
      const px = gx + 0.15 + 0.7 * hash2(wx, wy, seed);
      const py = gy + 0.15 + 0.7 * hash2(wx, wy, seed + 101);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = wy * nx + wx;
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id };
}

export interface HexSample {
  /** Stable plate id (periodic in the lattice, 0..2*nI*nJ-1). */
  id: number;
  /** Id of the plate across the nearest edge. */
  neighbor: number;
  /** Distance to the nearest edge in circumradius units (0 at the seam, ~0.87 at the centre). */
  edge: number;
  /** Offset from the plate centre in circumradius units. */
  dx: number;
  dy: number;
}

const SQ3 = Math.sqrt(3);

function hexCellId(x: number, y: number, nI: number, nJ: number): number {
  const ia = Math.round(x / 3);
  const ja = Math.round(y / SQ3);
  if (Math.abs(x - ia * 3) < 1e-3 && Math.abs(y - ja * SQ3) < 1e-3) return (wrap(ja, nJ) * nI + wrap(ia, nI)) * 2;
  const ib = Math.round((x - 1.5) / 3);
  const jb = Math.round((y - SQ3 / 2) / SQ3);
  return (wrap(jb, nJ) * nI + wrap(ib, nI)) * 2 + 1;
}

/**
 * Flat-top hexagonal lattice with circumradius 1. Plates repeat every 3*nI (x) by SQ3*nJ (y) units.
 * Two interleaved rectangular lattices (A at the origin, B shifted by half a period) form the hexes.
 */
export function hexCell(x: number, y: number, nI: number, nJ: number): HexSample {
  const pick = (ox: number, oy: number) => {
    const cx = ox + Math.round((x - ox) / 3) * 3;
    const cy = oy + Math.round((y - oy) / SQ3) * SQ3;
    return { cx, cy, d: (x - cx) ** 2 + (y - cy) ** 2 };
  };
  const a = pick(0, 0);
  const b = pick(1.5, SQ3 / 2);
  const c = a.d <= b.d ? a : b;
  const dx = x - c.cx;
  const dy = y - c.cy;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const side = SQ3 * 0.5 * ax + 0.5 * ay;
  const edge = SQ3 / 2 - Math.max(ay, side);
  const sx = dx < 0 ? -1 : 1;
  const sy = dy < 0 ? -1 : 1;
  const vertical = ay >= side;
  const nbX = c.cx + (vertical ? 0 : sx * 1.5);
  const nbY = c.cy + (vertical ? sy * SQ3 : sy * SQ3 * 0.5);
  return { id: hexCellId(c.cx, c.cy, nI, nJ), neighbor: hexCellId(nbX, nbY, nI, nJ), edge, dx, dy };
}
