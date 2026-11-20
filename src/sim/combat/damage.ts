import type { Emit, PlayerId, Structure, TargetMask, Unit, World } from '@/types';
import { queryRadius, removeStructure } from '@/sim/core';
import { SHIP_DAMAGE_MULT } from '@/config/constants';
import { damageShip, shipTargetable } from '@/sim/economy/shipHealth';
import { canHit, hostile, SHIP_LAYER } from './targeting';

export type DeathHook = (w: World, unit: Unit, emit: Emit) => void;
const deathHooks: DeathHook[] = [];

/** Called once when a unit is killed by damage (e.g. Carrier drops its cargo). Idempotent per function. */
export function registerDeathHook(fn: DeathHook): void {
  if (!deathHooks.includes(fn)) deathHooks.push(fn);
}

/** Marks a unit dead without crediting a kill (consumed on impact, stolen, unloaded). */
export function consumeUnit(u: Unit, emit: Emit): void {
  if (u.state === 'dead') return;
  u.state = 'dead';
  emit({ t: 'unitDied', id: u.id, kind: u.kind, owner: u.owner, x: u.x, y: u.y, killer: -1 });
}

/** Returns true if this hit killed the unit. Credits the killer's stats. */
export function damageUnit(w: World, u: Unit, amount: number, killer: PlayerId | -1, emit: Emit): boolean {
  if (u.state === 'dead' || amount <= 0) return false;
  u.hp -= amount;
  if (u.hp > 0) return false;
  u.hp = 0;
  u.state = 'dead';
  w.players[u.owner].stats.unitsLost++;
  if (killer !== -1) w.players[killer].stats.kills++;
  emit({ t: 'unitDied', id: u.id, kind: u.kind, owner: u.owner, x: u.x, y: u.y, killer });
  for (const hook of deathHooks) hook(w, u, emit);
  return true;
}

/** Returns true if the structure was destroyed; its tile is vacated and the grid version bumped. */
export function damageStructure(w: World, s: Structure, amount: number, _attacker: PlayerId | -1, emit: Emit): boolean {
  if (w.structures.get(s.id) !== s || amount <= 0) return false;
  s.hp -= amount;
  const x = s.tx + 0.5;
  const y = s.ty + 0.5;
  if (s.hp > 0) {
    emit({ t: 'structureHit', id: s.id, x, y });
    return false;
  }
  s.hp = 0;
  removeStructure(w, s.id);
  emit({ t: 'structureDestroyed', id: s.id, kind: s.kind, owner: s.owner, x, y });
  emit({ t: 'explosion', x, y, radius: 1, big: true });
  return true;
}

const victims: Unit[] = [];

/** Damages every enemy unit of the owner inside the radius (layer filtered). Never hurts allies. */
export function splashUnits(
  w: World, x: number, y: number, radius: number, amount: number,
  owner: PlayerId, mask: TargetMask, emit: Emit,
): number {
  victims.length = 0;
  queryRadius(w, x, y, radius, (u) => {
    if (u.state !== 'dead' && hostile(w, owner, u.owner) && canHit(mask, u.layer)) victims.push(u);
  });
  const n = victims.length;
  for (let i = 0; i < n; i++) damageUnit(w, victims[i], amount, owner, emit);
  victims.length = 0;
  return n;
}

/** Damages hostile structures whose tile lies within the radius of the point. */
export function splashStructures(w: World, x: number, y: number, radius: number, amount: number, owner: PlayerId, emit: Emit): number {
  const hit: Structure[] = [];
  const g = w.grid;
  for (let ty = Math.max(0, Math.floor(y - radius)); ty <= Math.min(g.h - 1, Math.floor(y + radius)); ty++) {
    for (let tx = Math.max(0, Math.floor(x - radius)); tx <= Math.min(g.w - 1, Math.floor(x + radius)); tx++) {
      const id = g.occupant[ty * g.w + tx];
      if (id === 0) continue;
      const dx = Math.max(tx - x, 0, x - (tx + 1));
      const dy = Math.max(ty - y, 0, y - (ty + 1));
      const s = w.structures.get(id);
      if (s && dx * dx + dy * dy <= radius * radius && hostile(w, owner, s.owner)) hit.push(s);
    }
  }
  for (const s of hit) damageStructure(w, s, amount, owner, emit);
  return hit.length;
}

/**
 * Weapon splash on ships: every live hostile ship within the radius takes `amount` scaled by SHIP_DAMAGE_MULT
 * (ships count as air for the mask). Never hurts allies. Returns how many ships were hit.
 */
export function splashShips(
  w: World, x: number, y: number, radius: number, amount: number, owner: PlayerId, mask: TargetMask, emit: Emit,
): number {
  if (!canHit(mask, SHIP_LAYER)) return 0;
  let n = 0;
  for (const p of w.players) {
    if (!shipTargetable(p) || !hostile(w, owner, p.id)) continue;
    if ((p.ship.x - x) ** 2 + (p.ship.y - y) ** 2 > radius * radius) continue;
    damageShip(w, p.id, amount * SHIP_DAMAGE_MULT, owner, emit);
    n++;
  }
  return n;
}