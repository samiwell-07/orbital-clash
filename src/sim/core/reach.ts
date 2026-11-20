import type { Grid, PlayerId, World } from '@/types';
import { DIRS4, inBounds, isBlocked } from './grid';

/** Tiles reachable from (sx, sy) over unblocked tiles (4-connected). The start tile is always seeded. */
export function reachableFrom(grid: Grid, sx: number, sy: number, extraBlocked = -1): Uint8Array {
  const seen = new Uint8Array(grid.w * grid.h);
  if (!inBounds(grid, sx, sy)) return seen;
  const queue = new Int32Array(grid.w * grid.h);
  let head = 0;
  let tail = 0;
  const s = sy * grid.w + sx;
  seen[s] = 1;
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
      if (seen[ni] || ni === extraBlocked || isBlocked(grid, nx, ny)) continue;
      seen[ni] = 1;
      queue[tail++] = ni;
    }
  }
  return seen;
}

/** A tile is "connected" if it, or any orthogonal neighbour, was reached. */
function touches(grid: Grid, seen: Uint8Array, tx: number, ty: number): boolean {
  if (!inBounds(grid, tx, ty)) return false;
  if (seen[ty * grid.w + tx]) return true;
  for (const [dx, dy] of DIRS4) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (inBounds(grid, nx, ny) && seen[ny * grid.w + nx]) return true;
  }
  return false;
}

/** True if ground units can walk from one tile to the other (endpoints may themselves be blocked, e.g. a tower or base). */
export function pathExists(
  w: World,
  from: { tx: number; ty: number },
  to: { tx: number; ty: number },
): boolean {
  const seen = reachableFrom(w.grid, to.tx, to.ty);
  return touches(w.grid, seen, from.tx, from.ty);
}

function isSpawnTower(kind: string): boolean {
  return kind === 'basicOps' || kind === 'specialOps';
}

/**
 * Would occupying (tx, ty) cut any hostile spawn tower, stored-launch point (an enemy base)
 * or live ground unit heading for `target` off from the target's base?
 */
export function wouldBlockPath(w: World, tx: number, ty: number, target: PlayerId): boolean {
  const grid = w.grid;
  if (!inBounds(grid, tx, ty)) return true;
  if (isBlocked(grid, tx, ty)) return false;
  const tp = w.players[target];
  if (!tp || !tp.baseBuilt) return false;
  const seen = reachableFrom(grid, tp.baseTx, tp.baseTy, ty * grid.w + tx);
  const hostile = (owner: PlayerId) => w.players[owner].team !== tp.team;

  for (const s of w.structures.values()) {
    if (isSpawnTower(s.kind) && hostile(s.owner) && !touches(grid, seen, s.tx, s.ty)) return true;
  }
  for (const p of w.players) {
    if (p.id !== target && p.alive && p.baseBuilt && hostile(p.id) && !touches(grid, seen, p.baseTx, p.baseTy)) {
      return true;
    }
  }
  for (const u of w.units) {
    if (u.layer !== 'ground' || u.state === 'dead' || u.targetPlayer !== target) continue;
    if (!touches(grid, seen, Math.floor(u.x), Math.floor(u.y))) return true;
  }
  return false;
}
