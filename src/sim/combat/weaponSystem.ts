import type { Emit, Structure, System, World } from '@/types';
import { WEAPON_DEFS } from '@/data';
import { unitIndex, weaponTarget, type Target } from './targeting';
import { fire as fireTurret } from './weapons/turret';
import { fire as fireLaser } from './weapons/laser';
import { fire as firePulsar } from './weapons/pulsar';
import { fire as fireBomber } from './weapons/bomber';

type Fire = (w: World, s: Structure, target: Target, level: number, emit: Emit) => void;

const FIRE: Readonly<Record<string, Fire>> = {
  turret: fireTurret,
  laser: fireLaser,
  pulsar: firePulsar,
  bomber: fireBomber,
};

/**
 * Cooldowns, target retention and firing. Structure.cooldown doubles as the stun timer: a Switch
 * pushes it up and the weapon stays silent until it runs out.
 */
export const weaponSystem: System = (w, dt, emit) => {
  const index = unitIndex(w);
  for (const s of w.structures.values()) {
    const fire = FIRE[s.kind];
    if (!fire) continue;
    const def = WEAPON_DEFS[s.kind as keyof typeof WEAPON_DEFS];
    s.cooldown = Math.max(-dt, s.cooldown - dt);
    if (s.cooldown > 0) continue;
    const level = Math.min(s.level, def.maxLevel);
    const target = weaponTarget(w, s, def, level, index);
    if (!target) {
      s.targetId = 0;
      continue;
    }
    s.targetId = target.id;
    fire(w, s, target, level, emit);
    s.cooldown = def.cooldown[level] + Math.max(s.cooldown, -dt);
  }
};
