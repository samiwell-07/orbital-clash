import type { Emit, Unit, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { hitBase } from '@/sim/core';
import { ARRIVE_RADIUS } from './constants';
import { getArrivalHook } from './hooks';

/** True when the unit stands in (or at the centre of) its target's base. */
export function atTargetBase(w: World, u: Unit): boolean {
  const p = w.players[u.targetPlayer];
  if (!p.baseBuilt) return false;
  const dx = p.baseTx + 0.5 - u.x;
  const dy = p.baseTy + 0.5 - u.y;
  return dx * dx + dy * dy <= ARRIVE_RADIUS * ARRIVE_RADIUS || (Math.floor(u.x) === p.baseTx && Math.floor(u.y) === p.baseTy);
}

/** Arrival: the kind's hook may take over; otherwise the unit hits the base and is consumed (no kill credit). */
export function arrive(w: World, u: Unit, emit: Emit): void {
  const hook = getArrivalHook(u.kind);
  if (hook && hook(w, u, emit)) return;
  const target = w.players[u.targetPlayer];
  const hits = UNIT_DEFS[u.kind].baseHits;
  if (hits > 0 && target.alive && target.team !== w.players[u.owner].team) {
    hitBase(w, u.targetPlayer, u.owner, emit, hits);
  }
  u.state = 'dead';
}

/** Kills a unit whose hp ran out outside combat (stats + event; killer unknown). */
export function killUnit(w: World, u: Unit, emit: Emit): void {
  u.state = 'dead';
  w.players[u.owner].stats.unitsLost++;
  emit({ t: 'unitDied', id: u.id, kind: u.kind, owner: u.owner, x: u.x, y: u.y, killer: -1 });
}
