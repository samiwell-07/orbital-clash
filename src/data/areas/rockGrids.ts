import type { MapDef, PaletteId } from '@/types';
import { MAX_COOP_PLAYERS } from '@/config/constants';

/** Original rock layouts, one per campaign area: grids/NN.txt is area NN ('X' rock, '.' floor). */
const FILES = import.meta.glob('./grids/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const ROCK_GRIDS: ReadonlyMap<number, readonly string[]> = new Map(
  Object.entries(FILES).map(([path, text]) => [
    Number(/(\d+)\.txt$/.exec(path)![1]),
    text.split(/\r?\n/).filter((r) => r.trim() !== '').map((r) => r.trim().replace(/X/g, '#')),
  ]),
);

interface Tile {
  tx: number;
  ty: number;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Largest r (up to 3) whose (2r+1)² square around the tile is all floor; -1 for a rock tile. */
function clearance(rows: readonly string[], tx: number, ty: number): number {
  let r = -1;
  for (let k = 0; k <= 3; k++) {
    for (let dy = -k; dy <= k; dy++) {
      for (let dx = -k; dx <= k; dx++) if (rows[ty + dy]?.[tx + dx] !== '.') return r;
    }
    r = k;
  }
  return r;
}

function walk(rows: readonly string[], from: Tile): Int32Array {
  const w = rows[0].length;
  const dist = new Int32Array(w * rows.length).fill(-1);
  const queue = [from];
  dist[from.ty * w + from.tx] = 0;
  for (let i = 0; i < queue.length; i++) {
    const { tx, ty } = queue[i];
    for (const [dx, dy] of DIRS) {
      const nx = tx + dx, ny = ty + dy;
      if (rows[ny]?.[nx] !== '.' || dist[ny * w + nx] >= 0) continue;
      dist[ny * w + nx] = dist[ty * w + tx] + 1;
      queue.push({ tx: nx, ty: ny });
    }
  }
  return dist;
}

const cheb = (a: Tile, b: Tile) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));

/**
 * Human and enemy pads are the two clear (3x3) tiles farthest apart on foot, preferring roomier pads;
 * the human takes the one nearer the top-left. Co-op partners get the clear pads nearest the human.
 */
export function placeBases(rows: readonly string[]): Tile[] {
  const w = rows[0].length;
  const pads: (Tile & { room: number })[] = [];
  rows.forEach((row, ty) => [...row].forEach((_, tx) => {
    const room = clearance(rows, tx, ty);
    if (room >= 1) pads.push({ tx, ty, room });
  }));
  if (pads.length < MAX_COOP_PLAYERS + 1) throw new Error('rock grid has too few clear 3x3 pads for the bases');
  const at = (d: Int32Array, t: Tile) => d[t.ty * w + t.tx];
  // Double sweep: the farthest pad from a corner, then the farthest pad from that one (room breaks near-ties).
  const farthest = (from: Tile) => {
    const d = walk(rows, from);
    return pads.reduce((best, p) => (at(d, p) + p.room > at(d, best) + best.room ? p : best));
  };
  const a = farthest(farthest(pads[0]));
  const b = farthest(a);
  const [human, enemy] = a.tx + a.ty <= b.tx + b.ty ? [a, b] : [b, a];
  const fromHuman = walk(rows, human);
  const partners: Tile[] = [];
  const order = [...pads].sort((p, q) => at(fromHuman, p) - at(fromHuman, q) || q.room - p.room || p.ty - q.ty || p.tx - q.tx);
  for (const p of order) {
    if (partners.length === MAX_COOP_PLAYERS - 1) break;
    if (at(fromHuman, p) < 0) continue;
    if ([human, enemy, ...partners].every((t) => cheb(t, p) >= 3)) partners.push(p);
  }
  if (partners.length < MAX_COOP_PLAYERS - 1) throw new Error('rock grid has no room for the co-op partner pads');
  return [human, enemy, ...partners].map(({ tx, ty }) => ({ tx, ty }));
}

export interface RockGridMeta {
  id: string;
  name: string;
  palette: PaletteId;
  thorium: 1 | 2 | 3;
  rocks: number;
}

/** The authored map for campaign area `area` (1-based), or null when no rock grid exists for it. */
export function rockGridMap(area: number, meta: RockGridMeta): MapDef | null {
  const rows = ROCK_GRIDS.get(area);
  if (!rows) return null;
  if (rows.some((r) => r.length !== rows.length || /[^.#]/.test(r))) throw new Error(`grids/${area}: must be a square of 'X' and '.'`);
  return {
    id: meta.id, name: meta.name, palette: meta.palette, w: rows.length, h: rows.length, rows,
    baseTiles: placeBases(rows), thoriumLevel: meta.thorium, rockCount: meta.rocks,
  };
}
