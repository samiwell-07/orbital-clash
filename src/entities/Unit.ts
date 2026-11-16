import type { Team, Unit, UnitKind, World } from '../types';
import { SWARM_SPEED_MULT } from '../core/config';
import { UNIT_DEFS } from '../data/units';

/** Creates (but does not add) a unit at pixel position (x, y). nextCol/nextRow start at the spawn cell. */
export function createUnit(
  world: World,
  team: Team,
  kind: UnitKind,
  x: number,
  y: number,
  col: number,
  row: number,
  trainIndex: number,
): Unit {
  const def = UNIT_DEFS[kind];
  const player = world.players[team];
  const hpMult = player.unitHpMult;
  const maxHp = Math.round(def.maxHp * hpMult);
  const maxShield = Math.round(def.maxShield * hpMult);
  return {
    id: world.nextId++,
    team,
    kind,
    air: def.air,
    x,
    y,
    hp: maxHp,
    maxHp,
    shield: maxShield,
    maxShield,
    sinceDamage: 99,
    speed: def.speed * (player.researched.swarmSpeed ? SWARM_SPEED_MULT : 1),
    nextCol: col,
    nextRow: row,
    slowTimer: 0,
    slowFactor: 1,
    alive: true,
    angle: team === 0 ? 0 : Math.PI,
    hitFlash: 0,
    age: 0,
    trainIndex,
  };
}
