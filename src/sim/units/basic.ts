import type { Emit, Unit, UnitKind, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { consumeUnit, splashStructures } from '@/sim/combat/damage';
import { registerUnitBehavior } from '@/sim/army/hooks';
import { contactAttack, nearestHostileStructure } from './contact';
import { CONTACT, TORPEDO_FUSE, TORPEDO_SPLASH } from './tuning';

/**
 * Behaviour hooks return true only when they fully handled the unit this tick (the army skips its
 * default movement); returning false lets normal marching continue after any side effects.
 */
function contactBehavior(kind: UnitKind): (w: World, u: Unit, dt: number, emit: Emit) => boolean {
  const spec = CONTACT[kind];
  return (w, u, dt, emit) => {
    if (u.state !== 'dead' && spec) contactAttack(w, u, dt, emit, spec);
    return false;
  };
}

export const scoutBehavior = contactBehavior('scout');
export const tankBehavior = contactBehavior('tank');
export const droneBehavior = contactBehavior('drone');

/** Torpedo: explodes on the first enemy structure it touches and is consumed. */
export function torpedoBehavior(w: World, u: Unit, _dt: number, emit: Emit): boolean {
  if (u.state === 'dead') return false;
  if (!nearestHostileStructure(w, u, TORPEDO_FUSE)) return false;
  splashStructures(w, u.x, u.y, TORPEDO_SPLASH, UNIT_DEFS.torpedo.structureDamage, u.owner, emit);
  emit({ t: 'explosion', x: u.x, y: u.y, radius: TORPEDO_SPLASH, big: true });
  consumeUnit(u, emit);
  return true;
}

export function registerScout(): void {
  registerUnitBehavior('scout', scoutBehavior);
}
export function registerTank(): void {
  registerUnitBehavior('tank', tankBehavior);
}
export function registerDrone(): void {
  registerUnitBehavior('drone', droneBehavior);
}
export function registerTorpedo(): void {
  registerUnitBehavior('torpedo', torpedoBehavior);
}
