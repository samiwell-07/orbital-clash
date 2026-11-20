import type { FlowField, PlayerId, Vec2, World } from '@/types';
import { gridVersion, inBounds } from './grid';

export { pathExists, wouldBlockPath } from './reach';

export const FLOW_INF = 0xffff;
const ORTHO = 10;
const DIAG = 14;

const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, ORTHO], [0, 1, ORTHO], [-1, 0, ORTHO], [0, -1, ORTHO],
  [1, 1, DIAG], [-1, 1, DIAG], [-1, -1, DIAG], [1, -1, DIAG],
];

interface Meta {
  w: number;
  h: number;
  baseKey: number;
}
const metas = new WeakMap<FlowField, Meta>();

function baseKeyOf(w: World, player: PlayerId): number {
  const p = w.players[player];
  return p.baseBuilt ? p.baseTy * w.grid.w + p.baseTx : -1;
}

function heapPush(heap: number[], v: number): void {
  let i = heap.length;
  heap.push(v);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heap[p] <= v) break;
    heap[i] = heap[p];
    i = p;
  }
  heap[i] = v;
}

function heapPop(heap: number[]): number {
  const top = heap[0];
  const last = heap.pop() as number;
  if (heap.length > 0) {
    let i = 0;
    const n = heap.length;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && heap[c + 1] < heap[c]) c++;
      if (heap[c] >= last) break;
      heap[i] = heap[c];
      i = c;
    }
    heap[i] = last;
  }
  return top;
}

/**
 * Rebuild the distance field toward `player`'s base. Structures and terrain block;
 * diagonal steps never cut corners. Unreachable tiles hold FLOW_INF.
 */
export function rebuildFlow(w: World, player: PlayerId): FlowField {
  const grid = w.grid;
  let field = w.flows[player];
  if (!field || field.dist.length !== grid.w * grid.h) {
    field = { target: player, dist: new Uint16Array(grid.w * grid.h), version: -1 };
    w.flows[player] = field;
  }
  const dist = field.dist;
  dist.fill(FLOW_INF);
  const baseKey = baseKeyOf(w, player);
  if (baseKey >= 0) {
    const bw = grid.w;
    const heap: number[] = [];
    dist[baseKey] = 0;
    heapPush(heap, baseKey); // cost 0 in the high bits
    while (heap.length > 0) {
      const v = heapPop(heap);
      const cost = Math.floor(v / 65536);
      const i = v - cost * 65536;
      if (cost > dist[i]) continue;
      const x = i % bw;
      const y = (i - x) / bw;
      for (const [dx, dy, c] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(grid, nx, ny)) continue;
        const ni = ny * bw + nx;
        if (grid.terrain[ni] !== 0 || grid.occupant[ni] !== 0) continue;
        if (dx !== 0 && dy !== 0) {
          const a = y * bw + nx;
          const b = ny * bw + x;
          if (grid.terrain[a] !== 0 || grid.occupant[a] !== 0 || grid.terrain[b] !== 0 || grid.occupant[b] !== 0) {
            continue;
          }
        }
        const nd = cost + c;
        if (nd >= FLOW_INF || nd >= dist[ni]) continue;
        dist[ni] = nd;
        heapPush(heap, nd * 65536 + ni);
      }
    }
  }
  field.version = gridVersion(grid);
  metas.set(field, { w: grid.w, h: grid.h, baseKey });
  return field;
}

/** Cached field: rebuilt only when grid occupancy or the target's base changed. */
export function ensureFlow(w: World, player: PlayerId): FlowField {
  const f = w.flows[player];
  const m = f ? metas.get(f) : undefined;
  if (f && m && f.version === gridVersion(w.grid) && m.baseKey === baseKeyOf(w, player)) return f;
  return rebuildFlow(w, player);
}

/** Path cost (in 1/10 tile) from the tile under (x, y), or FLOW_INF when unreachable. */
export function flowDist(field: FlowField, x: number, y: number): number {
  const m = metas.get(field);
  if (!m) return FLOW_INF;
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return FLOW_INF;
  return field.dist[ty * m.w + tx];
}

/**
 * Unit vector from (x, y) toward the best lower-distance neighbour tile centre.
 * Zero vector at the base or when no route exists (units then attack structures).
 */
export function flowDir(field: FlowField, x: number, y: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = 0;
  out.y = 0;
  const m = metas.get(field);
  if (!m) return out;
  const tx = Math.min(m.w - 1, Math.max(0, Math.floor(x)));
  const ty = Math.min(m.h - 1, Math.max(0, Math.floor(y)));
  const dist = field.dist;
  const cur = dist[ty * m.w + tx];
  if (cur === 0) return out;
  let best = FLOW_INF;
  let bx = 0;
  let by = 0;
  for (const [dx, dy] of STEPS) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
    const d = dist[ny * m.w + nx];
    if (d >= best) continue;
    if (dx !== 0 && dy !== 0 && (dist[ty * m.w + nx] === FLOW_INF || dist[ny * m.w + tx] === FLOW_INF)) continue;
    best = d;
    bx = nx;
    by = ny;
  }
  if (best === FLOW_INF || (cur !== FLOW_INF && best >= cur)) return out;
  let vx = bx + 0.5 - x;
  let vy = by + 0.5 - y;
  let len = Math.hypot(vx, vy);
  if (len < 1e-6) {
    vx = bx - tx;
    vy = by - ty;
    len = Math.hypot(vx, vy);
  }
  out.x = vx / len;
  out.y = vy / len;
  return out;
}
