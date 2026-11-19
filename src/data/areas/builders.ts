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

/** Preferred co-op partner spots (player ids 2 and 3) beside the human base: above/below it, or around the corner. */
export function partnerSpotsFor(spec: Pick<MapSpec, 'w' | 'h' | 'layout'>): [Tile, Tile] {
  const [human] = baseTilesFor(spec);
  if (spec.layout === 'side') return [{ tx: human.tx, ty: human.ty - 4 }, { tx: human.tx, ty: human.ty + 4 }];
  return [{ tx: human.tx + 4, ty: human.ty + 1 }, { tx: human.tx + 1, ty: human.ty + 4 }];
}

const PARTNER_GAP = 3;
const PARTNER_SEARCH = 3;

const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));

function clearAround(g: string[][], t: Tile): boolean {
  for (let y = t.ty - 1; y <= t.ty + 1; y++) {
    for (let x = t.tx - 1; x <= t.tx + 1; x++) if (!open(g[y]?.[x] ?? '#')) return false;
  }
  return true;
}

/**
 * Picks the co-op partner base tiles after the plateau is stamped, so the authored maps stay as they
 * were: the floor tile nearest each preferred spot whose 3x3 block is open floor, at least PARTNER_GAP
 * from every other base and nearer the human base than the enemy's. Falls back to clearing the spot.
 */
function placePartners(g: string[][], spec: MapSpec, human: Tile, enemy: Tile): [Tile, Tile] {
  const taken: Tile[] = [human, enemy];
  const out = partnerSpotsFor(spec).map((want) => {
    const cand: Tile[] = [];
    for (let ty = want.ty - PARTNER_SEARCH; ty <= want.ty + PARTNER_SEARCH; ty++) {
      for (let tx = want.tx - PARTNER_SEARCH; tx <= want.tx + PARTNER_SEARCH; tx++) {
        const t = { tx, ty };
        if (tx < RIM + 1 || ty < RIM + 1 || tx >= spec.w - RIM - 1 || ty >= spec.h - RIM - 1) continue;
        if (!clearAround(g, t) || taken.some((b) => cheb(b, t) < PARTNER_GAP)) continue;
        if (Math.hypot(tx - human.tx, ty - human.ty) >= Math.hypot(tx - enemy.tx, ty - enemy.ty)) continue;
        cand.push(t);
      }
    }
    const d = (t: Tile) => Math.hypot(t.tx - want.tx, t.ty - want.ty);
    cand.sort((a, b) => d(a) - d(b) || a.ty - b.ty || a.tx - b.tx);
    const pick = cand[0] ?? want;
    if (!cand[0]) {
      for (let y = want.ty - 1; y <= want.ty + 1; y++) for (let x = want.tx - 1; x <= want.tx + 1; x++) g[y][x] = '.';
    }
    taken.push(pick);
    return pick;
  });
  return [out[0], out[1]];
}

/**
 * Authored-style plateau: cliff rim, a style stamp, craters, symmetric about the centre, bases always
 * connected. baseTiles are indexed by player id: [human, enemy, co-op partner 2, co-op partner 3].
 */
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
  const partners = placePartners(c.g, spec, bases[0], bases[1]);
  ensureConnected(c.g, bases[0], bases[1]);
  for (const p of partners) ensureConnected(c.g, p, bases[1]);
  return {
    id: spec.id, name: spec.name, w: spec.w, h: spec.h, rows: c.g.map((r) => r.join('')),
    baseTiles: [bases[0], bases[1], partners[0], partners[1]], thoriumLevel: spec.thorium, rockCount: spec.rocks, palette: spec.palette,
  };
}
