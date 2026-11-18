// Map generation helpers shared by all battle maps: a symmetric canvas, shape painters and a finishing
// pass that seals unreachable pockets. Every painter writes all symmetric images, so maps stay fair.
import type { MapDef, PaletteId } from '@/types';
import { mulberry32 } from '@/sim/core/rng';

export type Sym = 'rot2' | 'mirror4';

export interface Tile {
  tx: number;
  ty: number;
}

export interface Canvas {
  w: number;
  h: number;
  sym: Sym;
  g: string[][];
}

export function canvas(w: number, h: number, sym: Sym): Canvas {
  return { w, h, sym, g: Array.from({ length: h }, () => new Array<string>(w).fill('.')) };
}

function images(c: Canvas, x: number, y: number): [number, number][] {
  const mx = c.w - 1 - x;
  const my = c.h - 1 - y;
  return c.sym === 'rot2' ? [[x, y], [mx, my]] : [[x, y], [mx, y], [x, my], [mx, my]];
}

export function put(c: Canvas, x: number, y: number, ch: string): void {
  for (const [ix, iy] of images(c, x, y)) if (ix >= 0 && iy >= 0 && ix < c.w && iy < c.h) c.g[iy][ix] = ch;
}

export function box(c: Canvas, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(c, x, y, ch);
}

/** Annulus around (cx, cy) in tile-centre space; rIn 0 gives a filled disc. */
export function ring(c: Canvas, cx: number, cy: number, rIn: number, rOut: number, ch: string): void {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d >= rIn && d <= rOut) put(c, x, y, ch);
    }
  }
}

export function line(c: Canvas, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) put(c, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), ch);
}

/** Cliff rim with diagonally cut corners (written directly: the rim is already symmetric). */
export function rim(c: Canvas, thickness: number, cut: number): void {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const edge = Math.min(x, y, c.w - 1 - x, c.h - 1 - y);
      if (edge < thickness || Math.min(x, c.w - 1 - x) + Math.min(y, c.h - 1 - y) < cut) c.g[y][x] = '#';
    }
  }
}

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Deterministic rock clumps (1..maxSize tiles wide) inside a region. */
export function scatter(c: Canvas, rnd: () => number, count: number, r: Region, ch: string, maxSize: number): void {
  for (let i = 0; i < count; i++) {
    const x = r.x0 + Math.floor(rnd() * (r.x1 - r.x0 + 1));
    const y = r.y0 + Math.floor(rnd() * (r.y1 - r.y0 + 1));
    const bw = 1 + Math.floor(rnd() * maxSize);
    const bh = 1 + Math.floor(rnd() * maxSize);
    box(c, x, y, x + bw - 1, y + bh - 1, ch);
  }
}

export function clearZone(c: Canvas, tiles: readonly (Tile | null)[], radius: number): void {
  for (const t of tiles) if (t) box(c, t.tx - radius, t.ty - radius, t.tx + radius, t.ty + radius, '.');
}

/** Four-corner starts ordered TL, BR, TR, BL so two players always face each other diagonally. */
export function corners(w: number, h: number, ix: number, iy: number): Tile[] {
  return [
    { tx: ix, ty: iy },
    { tx: w - 1 - ix, ty: h - 1 - iy },
    { tx: w - 1 - ix, ty: iy },
    { tx: ix, ty: h - 1 - iy },
  ];
}

export function rngFor(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return mulberry32(h | 0);
}

export interface MapMeta {
  id: string;
  name: string;
  palette: PaletteId;
  thoriumLevel: 1 | 2 | 3;
  rockCount: number;
  bases: readonly (Tile | null)[];
}

/** Floor regions not connected to the first base (or the largest region) are filled with rock. */
function sealPockets(c: Canvas, seed: Tile | null): void {
  const label = new Int32Array(c.w * c.h);
  const sizes: number[] = [0];
  for (let sy = 0; sy < c.h; sy++) {
    for (let sx = 0; sx < c.w; sx++) {
      if (c.g[sy][sx] !== '.' || label[sy * c.w + sx]) continue;
      const id = sizes.length;
      sizes.push(0);
      const stack = [sy * c.w + sx];
      label[stack[0]] = id;
      while (stack.length) {
        const i = stack.pop() as number;
        sizes[id]++;
        const x = i % c.w;
        const y = (i - x) / c.w;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= c.w || ny >= c.h) continue;
          const ni = ny * c.w + nx;
          if (c.g[ny][nx] === '.' && !label[ni]) {
            label[ni] = id;
            stack.push(ni);
          }
        }
      }
    }
  }
  let keep = 1;
  if (seed) keep = label[seed.ty * c.w + seed.tx];
  else for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[keep]) keep = i;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) if (c.g[y][x] === '.' && label[y * c.w + x] !== keep) c.g[y][x] = '#';
  }
}

export function finish(c: Canvas, meta: MapMeta): MapDef {
  sealPockets(c, meta.bases.find((b) => b !== null) ?? null);
  return {
    id: meta.id,
    name: meta.name,
    w: c.w,
    h: c.h,
    rows: c.g.map((r) => r.join('')),
    baseTiles: meta.bases,
    thoriumLevel: meta.thoriumLevel,
    rockCount: meta.rockCount,
    palette: meta.palette,
  };
}
