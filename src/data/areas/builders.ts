import type { MapDef, PaletteId } from '@/types';
import { mulberry32 } from '@/sim/core';

export type MapStyle = 'plain' | 'ring' | 'rooms' | 'lanes' | 'maze' | 'spires';

export interface MapSpec {
  id: string;
  name: string;
  w: number;
  h: number;
  palette: PaletteId;
  style: MapStyle;
  /** diag: bases in opposite corners; side: bases mid-left / mid-right. */
  layout?: 'diag' | 'side';
  seed: number;
  thorium: 1 | 2 | 3;
  rocks: number;
  craters?: number;
}

const RIM = 2;
const SAFE = 3;

type Tile = { tx: number; ty: number };

/** Mirrored canvas: every stamp is also written 180 degrees rotated, keeping the plateau symmetric. */
class Canvas {
  readonly g: string[][];
  constructor(readonly w: number, readonly h: number, private readonly bases: readonly Tile[]) {
    this.g = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
        const corner = Math.min(x, w - 1 - x) + Math.min(y, h - 1 - y) < RIM + 3;
        if (edge < RIM || corner) this.g[y][x] = '#';
      }
    }
  }

  protectedAt(x: number, y: number): boolean {
    return this.bases.some((b) => Math.abs(b.tx - x) <= SAFE && Math.abs(b.ty - y) <= SAFE);
  }

  private set(x: number, y: number, c: string): void {
    if (x < RIM || y < RIM || x >= this.w - RIM || y >= this.h - RIM || this.protectedAt(x, y)) return;
    if (this.g[y][x] === '#' && c === 'o') return;
    this.g[y][x] = c;
  }

  put(x: number, y: number, c: string): void {
    this.set(x, y, c);
    this.set(this.w - 1 - x, this.h - 1 - y, c);
  }
}

type Stamp = (c: Canvas, rnd: () => number) => void;

const STAMPS: Record<MapStyle, Stamp> = {
  plain: () => undefined,
  ring: (c) => {
    const cx = c.w / 2;
    const cy = c.h / 2;
    const r = Math.round(Math.min(c.w, c.h) * 0.27);
    for (let y = 0; y < c.h; y++) {
      for (let x = 0; x < c.w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const gap = Math.abs(x + 0.5 - cx) < 2 || Math.abs(y + 0.5 - cy) < 2;
        if (!gap && Math.abs(d - r) < 0.75) c.put(x, y, '#');
      }
    }
  },
  rooms: (c) => {
    const x1 = Math.round(c.w * 0.3);
    const gy = Math.round(c.h * 0.3);
    for (let y = 3; y < c.h - 3; y++) if (y < gy || y > gy + 2) c.put(x1, y, '#');
    const x2 = Math.round(c.w * 0.5) - 1;
    for (let y = Math.round(c.h * 0.55); y < c.h - 3; y++) c.put(x2, y, '#');
  },
  lanes: (c) => {
    const y1 = Math.round(c.h / 3);
    const gx = Math.round(c.w * 0.25);
    for (let x = 3; x < c.w - 3; x++) if (x < gx || x > gx + 2) c.put(x, y1, '#');
  },
  maze: (c) => {
    for (let k = 0, y = 4; y < c.h / 2 - 1; k++, y += 4) {
      for (let x = 3; x < c.w - 3; x++) {
        const gap = k % 2 === 0 ? x < 6 : x >= c.w - 6;
        if (!gap) c.put(x, y, '#');
      }
    }
  },
  spires: (c, rnd) => {
    const off = Math.floor(rnd() * 2);
    for (let y = 5; y < c.h / 2 + 1; y += 5) {
      for (let x = 6 + off; x < c.w - 4; x += 6) {
        c.put(x, y, '#');
        c.put(x + 1, y, '#');
        c.put(x, y + 1, '#');
        c.put(x + 1, y + 1, '#');
      }
    }
  },
};

function open(c: string): boolean {
  return c === '.';
}

/** Carves the cheapest corridor (rock costs 1, floor 0) between the bases when the plateau is split. */
function ensureConnected(g: string[][], a: Tile, b: Tile): void {
  const h = g.length;
  const w = g[0].length;
  const dist = new Array<number>(w * h).fill(Infinity);
  const prev = new Array<number>(w * h).fill(-1);
  const start = a.ty * w + a.tx;
  dist[start] = 0;
  const queue = [start];
  while (queue.length > 0) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (dist[queue[i]] < dist[queue[bi]]) bi = i;
    const cur = queue.splice(bi, 1)[0];
    const x = cur % w;
    const y = (cur - x) / w;
    if (x === b.tx && y === b.ty) break;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < RIM || ny < RIM || nx >= w - RIM || ny >= h - RIM) continue;
      const nd = dist[cur] + (open(g[ny][nx]) ? 0 : 1);
      if (nd < dist[ny * w + nx]) {
        dist[ny * w + nx] = nd;
        prev[ny * w + nx] = cur;
        queue.push(ny * w + nx);
      }
    }
  }
  if (!Number.isFinite(dist[b.ty * w + b.tx]) || dist[b.ty * w + b.tx] === 0) return;
  for (let i = b.ty * w + b.tx; i >= 0; i = prev[i]) g[Math.floor(i / w)][i % w] = '.';
}

export function baseTilesFor(spec: Pick<MapSpec, 'w' | 'h' | 'layout'>): [Tile, Tile] {
  if (spec.layout === 'side') {
    const my = Math.floor(spec.h / 2);
    return [{ tx: 5, ty: my }, { tx: spec.w - 6, ty: spec.h - 1 - my }];
  }
  return [{ tx: 5, ty: 5 }, { tx: spec.w - 6, ty: spec.h - 6 }];
}

/** Authored-style plateau: cliff rim, a style stamp, craters, symmetric about the centre, bases always connected. */
export function makeMap(spec: MapSpec): MapDef {
  const bases = baseTilesFor(spec);
  const c = new Canvas(spec.w, spec.h, bases);
  const rnd = mulberry32(spec.seed);
  STAMPS[spec.style](c, rnd);
  const craters = spec.craters ?? Math.round((spec.w * spec.h) / 90);
  for (let i = 0; i < craters; i++) {
    const x = RIM + 1 + Math.floor(rnd() * (spec.w / 2 - RIM - 1));
    const y = RIM + 1 + Math.floor(rnd() * (spec.h - 2 * RIM - 2));
    c.put(x, y, 'o');
    if (rnd() < 0.5) c.put(x + 1, y, 'o');
  }
  ensureConnected(c.g, bases[0], bases[1]);
  return {
    id: spec.id, name: spec.name, w: spec.w, h: spec.h, rows: c.g.map((r) => r.join('')),
    baseTiles: [bases[0], bases[1], null, null], thoriumLevel: spec.thorium, rockCount: spec.rocks, palette: spec.palette,
  };
}
