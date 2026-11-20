import type { EntityId, Layer, PlayerId, Structure, TargetMask, Unit, WeaponDef, World } from '@/types';
import { nearest } from '@/sim/core';

export interface Target {
  id: EntityId;
  x: number;
  y: number;
  unit: Unit | null;
}

/** Different teams are hostile; allied players never damage each other. */
export function hostile(w: World, a: PlayerId, b: PlayerId): boolean {
  return w.players[a].team !== w.players[b].team;
}

export function canHit(mask: TargetMask, layer: Layer): boolean {
  return mask === 'both' || mask === layer;
}

const indexes = new WeakMap<World, Map<number, Unit>>();

/** id -> live unit lookup, rebuilt on every call (once per system run). */
export function unitIndex(w: World): Map<number, Unit> {
  let m = indexes.get(w);
  if (!m) {
    m = new Map();
    indexes.set(w, m);
  }
  m.clear();
  for (const u of w.units) if (u.state !== 'dead') m.set(u.id, u);
  return m;
}

export function structureCenter(s: Structure): { x: number; y: number } {
  return { x: s.tx + 0.5, y: s.ty + 0.5 };
}

function unitTarget(u: Unit): Target {
  return { id: u.id, x: u.x, y: u.y, unit: u };
}

/** Nearest enemy unit this weapon may hit. Weapons never target rocks. */
export function acquire(w: World, s: Structure, def: WeaponDef, level: number): Target | null {
  const { x, y } = structureCenter(s);
  const range = def.range[level];
  const u = nearest(w, x, y, range, (c) => c.state !== 'dead' && hostile(w, s.owner, c.owner) && canHit(def.targets, c.layer));
  return u ? unitTarget(u) : null;
}

/** Keeps the current unit target while it is alive, valid and in range. */
export function retain(w: World, s: Structure, def: WeaponDef, level: number, index: Map<number, Unit>): Target | null {
  if (s.targetId === 0) return null;
  const u = index.get(s.targetId);
  if (!u || u.state === 'dead' || !hostile(w, s.owner, u.owner) || !canHit(def.targets, u.layer)) return null;
  const { x, y } = structureCenter(s);
  const range = def.range[level];
  return (u.x - x) ** 2 + (u.y - y) ** 2 <= range * range ? unitTarget(u) : null;
}

export function weaponTarget(w: World, s: Structure, def: WeaponDef, level: number, index: Map<number, Unit>): Target | null {
  return retain(w, s, def, level, index) ?? acquire(w, s, def, level);
}
