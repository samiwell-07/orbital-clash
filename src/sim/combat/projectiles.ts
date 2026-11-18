import type { Emit, Projectile, System, Unit, World } from '@/types';
import { hitBase } from '@/sim/core';
import { UNIT_DEFS } from '@/data';
import { damageUnit, splashStructures, splashUnits } from './damage';
import { hitRock } from './rocks';
import { findRock, hostile, unitIndex } from './targeting';
import {
  IMPACT_FUSE, MISSILE_BASE_HITS, ROCK_RADIUS_BASE, ROCK_RADIUS_PER_SIZE, SHOT_FUSE, TORPEDO_BASE_HITS,
} from './tuning';

interface Loc {
  x: number;
  y: number;
  radius: number;
  unit: Unit | null;
}
const loc: Loc = { x: 0, y: 0, radius: 0, unit: null };

/** Where a shot's target currently is, or null when it is gone. */
function locate(w: World, p: Projectile, index: Map<number, Unit>): Loc | null {
  if (p.targetId === 0) return null;
  const u = index.get(p.targetId);
  if (u && u.state !== 'dead') {
    loc.x = u.x; loc.y = u.y; loc.radius = UNIT_DEFS[u.kind].radius; loc.unit = u;
    return loc;
  }
  const s = w.structures.get(p.targetId);
  if (s) {
    loc.x = s.tx + 0.5; loc.y = s.ty + 0.5; loc.radius = 0.5; loc.unit = null;
    return loc;
  }
  const r = findRock(w, p.targetId);
  if (r && r.state === 'drifting') {
    loc.x = r.x; loc.y = r.y; loc.radius = ROCK_RADIUS_BASE + r.size * ROCK_RADIUS_PER_SIZE; loc.unit = null;
    return loc;
  }
  return null;
}

function aim(p: Projectile, tx: number, ty: number): void {
  const speed = Math.hypot(p.vx, p.vy);
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6 || speed === 0) return;
  p.vx = (dx / d) * speed;
  p.vy = (dy / d) * speed;
}

function strikeRock(w: World, p: Projectile, emit: Emit): void {
  const r = p.targetId ? findRock(w, p.targetId) : undefined;
  if (r) hitRock(w, r, p.owner, emit);
}

function stepBullet(w: World, p: Projectile, emit: Emit, t: Loc | null): boolean {
  if (t && Math.hypot(t.x - p.x, t.y - p.y) <= t.radius + 0.15) {
    if (t.unit) damageUnit(w, t.unit, p.damage, p.owner, emit);
    else strikeRock(w, p, emit);
    return false;
  }
  return p.life > 0;
}

function detonateSplash(w: World, p: Projectile, emit: Emit): void {
  const radius = p.splash > 0 ? p.splash : 0.5;
  splashUnits(w, p.x, p.y, radius, p.damage, p.owner, p.layerMask, emit);
  emit({ t: 'explosion', x: p.x, y: p.y, radius, big: false });
  const r = p.targetId ? findRock(w, p.targetId) : undefined;
  if (r && r.state === 'drifting' && Math.hypot(r.x - p.x, r.y - p.y) <= radius + ROCK_RADIUS_BASE + r.size * ROCK_RADIUS_PER_SIZE) {
    hitRock(w, r, p.owner, emit);
  }
}

function stepSplash(w: World, p: Projectile, emit: Emit, t: Loc | null): boolean {
  const near = t !== null && Math.hypot(t.x - p.x, t.y - p.y) <= SHOT_FUSE + t.radius * 0.5;
  if (!near && p.life > 0) return true;
  detonateSplash(w, p, emit);
  return false;
}

function structureInFuse(w: World, p: Projectile): boolean {
  const g = w.grid;
  for (let ty = Math.max(0, Math.floor(p.y - IMPACT_FUSE)); ty <= Math.min(g.h - 1, Math.floor(p.y + IMPACT_FUSE)); ty++) {
    for (let tx = Math.max(0, Math.floor(p.x - IMPACT_FUSE)); tx <= Math.min(g.w - 1, Math.floor(p.x + IMPACT_FUSE)); tx++) {
      const id = g.occupant[ty * g.w + tx];
      const s = id === 0 ? undefined : w.structures.get(id);
      if (!s || !hostile(w, p.owner, s.owner)) continue;
      const dx = Math.max(tx - p.x, 0, p.x - (tx + 1));
      const dy = Math.max(ty - p.y, 0, p.y - (ty + 1));
      if (dx * dx + dy * dy <= IMPACT_FUSE * IMPACT_FUSE) return true;
    }
  }
  return false;
}

function baseInFuse(w: World, p: Projectile): number {
  for (const pl of w.players) {
    if (!pl.alive || !pl.baseBuilt || !hostile(w, p.owner, pl.id)) continue;
    if (Math.hypot(pl.baseTx + 0.5 - p.x, pl.baseTy + 0.5 - p.y) <= IMPACT_FUSE) return pl.id;
  }
  return -1;
}

/** Missiles/torpedo shells: detonate on the first hostile structure or base they touch (or at end of life). */
function stepImpact(w: World, p: Projectile, emit: Emit): boolean {
  const base = baseInFuse(w, p);
  if (base === -1 && p.life > 0 && !structureInFuse(w, p)) return true;
  if (base !== -1) hitBase(w, base as 0 | 1 | 2 | 3, p.owner, emit, p.kind === 'missile' ? MISSILE_BASE_HITS : TORPEDO_BASE_HITS);
  const radius = p.splash > 0 ? p.splash : 1;
  splashStructures(w, p.x, p.y, radius, p.damage, p.owner, emit);
  splashUnits(w, p.x, p.y, radius, p.damage, p.owner, 'both', emit);
  emit({ t: 'explosion', x: p.x, y: p.y, radius, big: true });
  return false;
}

function step(w: World, p: Projectile, dt: number, emit: Emit, index: Map<number, Unit>): boolean {
  const t = locate(w, p, index);
  if (t) aim(p, t.x, t.y);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.life -= dt;
  const tl = t && p.kind !== 'missile' && p.kind !== 'torpedo' ? t : null;
  if (p.kind === 'bullet') return stepBullet(w, p, emit, tl);
  if (p.kind === 'pulse' || p.kind === 'bomb') return stepSplash(w, p, emit, tl);
  return stepImpact(w, p, emit);
}

export const projectileSystem: System = (w, dt, emit) => {
  const index = unitIndex(w);
  const list = w.projectiles;
  let j = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (step(w, p, dt, emit, index)) list[j++] = p;
  }
  list.length = j;
};
