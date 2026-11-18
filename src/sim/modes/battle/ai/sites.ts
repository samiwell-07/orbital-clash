import type { Player, World } from '@/types';
import { rand } from '@/sim/core/rng';
import { structureAt } from '@/sim/core/entities';
import { inBounds } from '@/sim/core/grid';
import { ROUTE_BAND } from './tuning';
import type { BrainCtx } from './ctx';
import { baseSiteOk, canPlace } from './legal';
import { enemiesOf } from './threat';
import { detourGain, routeToBase, walkDistances, type RouteTile } from './route';

export interface Site {
  tx: number;
  ty: number;
}

const isWeapon = (k: string | undefined): boolean => k === 'turret' || k === 'laser' || k === 'pulsar' || k === 'bomber';

/** Route of the nearest enemy (by path length) toward my base, or [] when none is reachable. */
export function mainRoute(w: World, me: Player): RouteTile[] {
  let best: RouteTile[] = [];
  for (const e of enemiesOf(w, me.id)) {
    const r = routeToBase(w, me.id, e);
    if (r.length > 0 && (best.length === 0 || r.length < best.length)) best = r;
  }
  return best;
}

/** Weapons extending an existing line score higher: that is how the AI builds walls and mazes. */
function lineBonus(w: World, me: number, tx: number, ty: number): number {
  let bonus = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const a = structureAt(w, tx + dx, ty + dy);
    if (!a || a.owner !== me || !isWeapon(a.kind)) continue;
    bonus += 2.5;
    const b = structureAt(w, tx + 2 * dx, ty + 2 * dy);
    if (b && b.owner === me && isWeapon(b.kind)) bonus += 1.5;
  }
  return bonus;
}

/** Best legal tile for a weapon along the enemy approach, near my base; null when nothing fits. */
export function weaponSite(c: BrainCtx, route: readonly RouteTile[], radius: number): Site | null {
  const { w, me, p } = c;
  const band = route.filter((r) => r.steps >= ROUTE_BAND.from && r.steps <= ROUTE_BAND.to);
  const src = band.length > 0 ? band : route.filter((r) => r.steps >= 2).slice(-8);
  const cands = new Map<number, { tx: number; ty: number; score: number; onRoute: boolean }>();
  const consider = (tx: number, ty: number, score: number, onRoute: boolean): void => {
    if (!inBounds(w.grid, tx, ty)) return;
    const key = ty * w.grid.w + tx;
    const total = score + lineBonus(w, me, tx, ty) + rand(w) * 0.4;
    const old = cands.get(key);
    if (!old || old.score < total) cands.set(key, { tx, ty, score: total, onRoute });
  };
  const lat = ROUTE_BAND.lateral;
  for (const r of src) {
    const prox = -Math.abs(r.steps - 9) / 6;
    for (let dy = -lat; dy <= lat; dy++) {
      for (let dx = -lat; dx <= lat; dx++) consider(r.tx + dx, r.ty + dy, 3 - Math.abs(dx) - Math.abs(dy) + prox, dx === 0 && dy === 0);
    }
  }
  if (src.length === 0) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d >= 3 && d <= 5) consider(p.baseTx + dx, p.baseTy + dy, -d * 0.2, false);
      }
    }
  }
  const ranked = [...cands.values()].sort((a, b) => b.score - a.score || a.ty - b.ty || a.tx - b.tx).slice(0, 12);
  const enemy = enemiesOf(w, me)[0];
  const before = enemy ? walkDistances(w.grid, p.baseTx, p.baseTy) : undefined;
  let best: Site | null = null;
  let bestScore = -Infinity;
  for (const r of ranked) {
    if (Math.max(Math.abs(r.tx - p.baseTx), Math.abs(r.ty - p.baseTy)) > radius + 8) continue;
    if (!canPlace(w, me, r.tx, r.ty, c.pending)) continue;
    const gain = r.onRoute && enemy ? Math.min(detourGain(w, p, enemy, r.tx, r.ty, before), 12) : 0;
    const total = r.score + gain * 1.5;
    if (total > bestScore) {
      bestScore = total;
      best = { tx: r.tx, ty: r.ty };
    }
  }
  return best;
}

/** Anti-air goes on the straight line from the nearest enemy base to mine, a few tiles out (air ignores the maze). */
export function airSite(c: BrainCtx): Site | null {
  const { w, me, p } = c;
  const e = enemiesOf(w, me)[0];
  if (!e) return null;
  const len = Math.hypot(e.baseTx - p.baseTx, e.baseTy - p.baseTy) || 1;
  const ux = (e.baseTx - p.baseTx) / len;
  const uy = (e.baseTy - p.baseTy) / len;
  for (let d = 3; d <= 8; d++) {
    for (const side of [0, 1, -1, 2, -2]) {
      const tx = Math.round(p.baseTx + ux * d - uy * side);
      const ty = Math.round(p.baseTy + uy * d + ux * side);
      if (canPlace(w, me, tx, ty, c.pending)) return { tx, ty };
    }
  }
  return null;
}

/** Spawn towers sit close to the base but off the enemy lane, with a little jitter so bases look different. */
export function towerSite(c: BrainCtx, route: readonly RouteTile[]): Site | null {
  const { w, me, p, tun } = c;
  const onRoute = new Set(route.map((r) => r.ty * w.grid.w + r.tx));
  const cands: { tx: number; ty: number; score: number }[] = [];
  for (let dy = -tun.towerRadius; dy <= tun.towerRadius; dy++) {
    for (let dx = -tun.towerRadius; dx <= tun.towerRadius; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < 2) continue;
      const tx = p.baseTx + dx;
      const ty = p.baseTy + dy;
      if (!inBounds(w.grid, tx, ty) || w.grid.terrain[ty * w.grid.w + tx] !== 0) continue;
      const lane = onRoute.has(ty * w.grid.w + tx) ? 3 : 0;
      cands.push({ tx, ty, score: -Math.abs(d - 3) - lane + rand(w) * 0.8 });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.ty - b.ty || a.tx - b.tx);
  for (const k of cands.slice(0, 14)) if (canPlace(w, me, k.tx, k.ty, c.pending)) return { tx: k.tx, ty: k.ty };
  return null;
}

/** Free-placement battles: far from every other base, on a clear 5x5, with jitter. */
export function pickBaseTile(w: World, me: number): Site | null {
  let best: Site | null = null;
  let bestScore = -Infinity;
  for (let ty = 3; ty < w.grid.h - 3; ty++) {
    for (let tx = 3; tx < w.grid.w - 3; tx++) {
      if (!baseSiteOk(w, tx, ty)) continue;
      let far = 40;
      for (const o of w.players) if (o.id !== me && o.baseBuilt) far = Math.min(far, Math.hypot(o.baseTx - tx, o.baseTy - ty));
      const edge = Math.min(tx, ty, w.grid.w - 1 - tx, w.grid.h - 1 - ty);
      const score = far + Math.min(edge, 6) * 0.5 + rand(w) * 2;
      if (score > bestScore) {
        bestScore = score;
        best = { tx, ty };
      }
    }
  }
  return best;
}
