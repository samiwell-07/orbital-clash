import type { Emit, Structure, World } from '@/types';
import { WEAPON_DEFS } from '@/data';
import { addProjectile } from '@/sim/core';
import { BULLET_SPEED, SHOT_SLACK } from '../tuning';
import { structureCenter, type Target } from '../targeting';

export function fire(w: World, s: Structure, target: Target, level: number, emit: Emit): void {
  const def = WEAPON_DEFS.turret;
  const { x, y } = structureCenter(s);
  const dx = target.x - x;
  const dy = target.y - y;
  const dist = Math.hypot(dx, dy) || 1;
  addProjectile(w, {
    owner: s.owner, kind: 'bullet', x, y,
    vx: (dx / dist) * BULLET_SPEED, vy: (dy / dist) * BULLET_SPEED,
    damage: def.damage[level], splash: def.splash, targetId: target.id, targetShip: target.ship,
    life: dist / BULLET_SPEED + SHOT_SLACK, layerMask: def.targets,
  });
  emit({ t: 'shot', from: s.id, kind: s.kind, x, y, tx: target.x, ty: target.y });
}
