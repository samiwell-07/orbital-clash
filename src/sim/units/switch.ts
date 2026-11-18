import type { Emit, Structure, Unit, World } from '@/types';
import { WEAPONS } from '@/types';
import { consumeUnit } from '@/sim/combat/damage';
import { registerUnitBehavior } from '@/sim/army/hooks';
import { nearestHostileStructure } from './contact';
import { CONTACT, SWITCH_STUN, SWITCH_USES } from './tuning';

const SWITCHABLE: readonly string[] = [...WEAPONS, 'basicOps', 'specialOps'];

/** Not yet stunned (or the stun is nearly over). */
function switchable(s: Structure): boolean {
  return SWITCHABLE.includes(s.kind) && s.cooldown < SWITCH_STUN - 1;
}

/**
 * Switch: touching an enemy weapon or spawn tower switches it off for SWITCH_STUN seconds
 * (Structure.cooldown is the stun timer) and drops its aim. `aux` counts uses; the unit is
 * consumed after SWITCH_USES.
 */
export function switchBehavior(w: World, u: Unit, _dt: number, emit: Emit): boolean {
  if (u.state === 'dead' || !CONTACT.switch) return false;
  const s = nearestHostileStructure(w, u, CONTACT.switch.reach, switchable);
  if (!s) return false;
  s.cooldown = SWITCH_STUN;
  s.targetId = 0;
  emit({ t: 'structureHit', id: s.id, x: s.tx + 0.5, y: s.ty + 0.5 });
  emit({ t: 'explosion', x: s.tx + 0.5, y: s.ty + 0.5, radius: 0.6, big: false });
  u.aux += 1;
  if (u.aux >= SWITCH_USES) {
    consumeUnit(u, emit);
    return true;
  }
  return false;
}

export function registerSwitch(): void {
  registerUnitBehavior('switch', switchBehavior);
}
