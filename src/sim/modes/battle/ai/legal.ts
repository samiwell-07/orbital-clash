import type { PlayerId, World } from '@/types';
import { inBounds, isBlocked } from '@/sim/core/grid';
import { wouldBlockPath } from '@/sim/core/reach';

/**
 * The same placement rules a human obeys: free in-bounds tile, off the base's immediate ring, not
 * on top of own units, and never sealing any base or hostile spawn tower from a living base.
 * `pending` holds tiles already claimed by intents emitted in this batch.
 */
export function canPlace(w: World, me: PlayerId, tx: number, ty: number, pending: ReadonlySet<number>): boolean {
  const g = w.grid;
  if (!inBounds(g, tx, ty) || isBlocked(g, tx, ty) || pending.has(ty * g.w + tx)) return false;
  for (const p of w.players) {
    if (p.baseBuilt && Math.max(Math.abs(p.baseTx - tx), Math.abs(p.baseTy - ty)) <= 1) return false;
  }
  for (const u of w.units) {
    if (u.owner === me && u.state !== 'dead' && Math.floor(u.x) === tx && Math.floor(u.y) === ty) return false;
  }
  for (const p of w.players) if (p.alive && p.baseBuilt && wouldBlockPath(w, tx, ty, p.id)) return false;
  return true;
}

/** Free 5x5 floor area suitable for a base (Battle lets the player choose any free tile). */
export function baseSiteOk(w: World, tx: number, ty: number): boolean {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isBlocked(w.grid, tx + dx, ty + dy)) return false;
  return true;
}
