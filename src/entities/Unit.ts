import type { Team, Unit, UnitKind, World } from '../types';
import { UNIT_DEFS } from '../data/units';

/** Creates (but does not add) a unit at pixel position (x, y). Path is empty until MovementSystem computes it. */
export function createUnit(world: World, team: Team, kind: UnitKind, x: number, y: number): Unit {
  const def = UNIT_DEFS[kind];
  const hpMult = world.players[team].unitHpMult;
  const maxHp = Math.round(def.maxHp * hpMult);
  const maxShield = Math.round(def.maxShield * hpMult);
  return {
    id: world.nextId++,
    team,
    kind,
    x,
    y,
    hp: maxHp,
    maxHp,
    shield: maxShield,
    maxShield,
    sinceDamage: 99,
    speed: def.speed,
    path: [],
    pathIndex: 0,
    pathVersion: -1,
    slowTimer: 0,
    slowFactor: 1,
    alive: true,
    angle: team === 0 ? 0 : Math.PI,
    hitFlash: 0,
    age: 0,
  };
}
