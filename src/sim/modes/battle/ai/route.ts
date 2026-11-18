import type { Grid, Player, PlayerId, World } from '@/types';
import { DIRS4, DIRS8, inBounds } from '@/sim/core/grid';
import { FLOW_INF, ensureFlow } from '@/sim/core/flow';

export interface RouteTile {
  tx: number;
  ty: number;
  /** Path steps from the defended base (0 at the base). */
  steps: number;
}

/** Walks the target's flow field from `from`'s base to the target base: the lane enemies actually use. */
export function routeToBase(w: World, target: PlayerId, from: Player): RouteTile[] {
  const field = ensureFlow(w, target);
  const g = w.grid;
  let tx = from.baseTx;
  let ty = from.baseTy;
  if (field.dist[ty * g.w + tx] >= FLOW_INF) return [];
  const tiles: { tx: number; ty: number }[] = [{ tx, ty }];
  for (let guard = 0; guard < g.w * g.h; guard++) {
    const cur = field.dist[ty * g.w + tx];
    if (cur === 0) break;
    let best = cur;
    let bx = tx;
    let by = ty;
    for (const [dx, dy] of DIRS8) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(g, nx, ny)) continue;
      const d = field.dist[ny * g.w + nx];
      if (d < best) {
        best = d;
        bx = nx;
        by = ny;
      }
    }
    if (best === cur) break;
    tx = bx;
    ty = by;
    tiles.push({ tx, ty });
  }
  return tiles.map((t, i) => ({ ...t, steps: tiles.length - 1 - i }));
}

/** 4-connected walking distance from (sx, sy) over unblocked tiles, optionally treating one extra index as blocked. */
export function walkDistances(grid: Grid, sx: number, sy: number, extraBlocked = -1): Int16Array {
  const dist = new Int16Array(grid.w * grid.h).fill(-1);
  const queue = new Int32Array(grid.w * grid.h);
  let head = 0;
  let tail = 0;
  const s = sy * grid.w + sx;
  dist[s] = 0;
  queue[tail++] = s;
  while (head < tail) {
    const i = queue[head++];
    const x = i % grid.w;
    const y = (i - x) / grid.w;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;
      const ni = ny * grid.w + nx;
      if (dist[ni] !== -1 || ni === extraBlocked || grid.terrain[ni] !== 0 || grid.occupant[ni] !== 0) continue;
      dist[ni] = dist[i] + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

function nearestReach(g: Grid, d: Int16Array, from: Player): number {
  let best = -1;
  for (const [dx, dy] of [[0, 0], ...DIRS4]) {
    const x = from.baseTx + dx;
    const y = from.baseTy + dy;
    if (!inBounds(g, x, y)) continue;
    const v = d[y * g.w + x];
    if (v >= 0 && (best < 0 || v < best)) best = v;
  }
  return best;
}

/** Extra walking distance enemies must cover if (tx, ty) became a wall; 0 when it changes nothing. */
export function detourGain(w: World, me: Player, from: Player, tx: number, ty: number, before?: Int16Array): number {
  const g = w.grid;
  const b = nearestReach(g, before ?? walkDistances(g, me.baseTx, me.baseTy), from);
  const a = nearestReach(g, walkDistances(g, me.baseTx, me.baseTy, ty * g.w + tx), from);
  return b < 0 || a < 0 ? 0 : Math.max(0, a - b);
}
