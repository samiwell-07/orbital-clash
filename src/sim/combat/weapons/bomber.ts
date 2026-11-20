import type { Emit, Structure, World } from '@/types';
import { WEAPON_DEFS } from '@/data';
import { addProjectile } from '@/sim/core';
import { BOMB_SPEED, SHOT_SLACK } from '../tuning';
import { structureCenter, type Target } from '../targeting';

/** Anti-air flak: homing bomb with splash that only damages air units. */
export function fire(w: World, s: Structure, target: Target, level: number, emit: Emit): void {
  const def = WEAPON_DEFS.bomber;
  const { x, y } = structureCenter(s);
  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.hypot(dx, dy) || 1;
  addProjectile(w, {
    owner: s.owner, kind: 'bomb', x, y, z: 0.5,
    vx: (dx / dist) * BOMB_SPEED, vy: (dy / dist) * BOMB_SPEED,
    damage: def.damage[level], splash: def.splash, targetId: target.id, targetShip: target.ship,
    life: dist / BOMB_SPEED + SHOT_SLACK, layerMask: def.targets,
  });
  emit({ t: 'shot', from: s.id, kind: s.kind, x, y, tx: target.x, ty: target.y });
}
