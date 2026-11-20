import type { Structure, StructureKind, Unit, UnitKind, World } from '@/types';
import { UNIT_DEFS, WEAPON_DEFS } from '@/data';
import { TICK_DT } from '@/config/constants';
import { addStructure, addUnit, rebuild, removeDeadUnits } from '@/sim/core';
import { weaponSystem } from '@/sim/combat/weaponSystem';
import { projectileSystem } from '@/sim/combat/projectiles';
import { openWorld } from '../sim-core/helpers';

export { openWorld };

/** Two enemy teams by default; `allied` puts player 1 on player 0's team. */
export function arena(allied = false, w = 12, h = 9): World {
  const world = openWorld(w, h);
  world.players[1].team = allied ? world.players[0].team : 1;
  return world;
}

export function putWeapon(w: World, kind: keyof typeof WEAPON_DEFS, owner: 0 | 1, tx: number, ty: number, level = 0): Structure {
  const hp = WEAPON_DEFS[kind].hp;
  return addStructure(w, { kind, owner, tx, ty, level, hp, maxHp: hp });
}

export function putStructure(w: World, kind: StructureKind, owner: 0 | 1, tx: number, ty: number, hp = 100): Structure {
  return addStructure(w, { kind, owner, tx, ty, hp, maxHp: hp });
}

export function putUnit(w: World, kind: UnitKind, owner: 0 | 1, x: number, y: number, hp?: number): Unit {
  const d = UNIT_DEFS[kind];
  return addUnit(w, { kind, owner, targetPlayer: owner === 0 ? 1 : 0, x, y, hp: hp ?? d.hp, maxHp: hp ?? d.hp, layer: d.layer });
}

/** Runs the combat + projectile stages (with the spatial rebuild and cleanup the pipeline provides). */
export function runCombat(w: World, ticks: number): void {
  const emit = (e: (typeof w.events)[number]) => w.events.push(e);
  for (let i = 0; i < ticks; i++) {
    rebuild(w);
    weaponSystem(w, TICK_DT, emit);
    projectileSystem(w, TICK_DT, emit);
    removeDeadUnits(w);
    w.tick++;
  }
}

export function emitter(w: World) {
  return (e: (typeof w.events)[number]) => {
    w.events.push(e);
  };
}
