import type { Emit, Unit, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { FLOW_INF, ensureFlow, flowDist, isBlocked } from '@/sim/core';
import { registerUnitBehavior } from '@/sim/army/hooks';
import { contactAttack } from './contact';
import { CONTACT } from './tuning';

/**
 * Hammer: smashes every enemy structure it touches. When the maze fully walls off the enemy base
 * (no flow route) it takes over movement and walks straight at the base, smashing what blocks it.
 */
export function hammerBehavior(w: World, u: Unit, dt: number, emit: Emit): boolean {
  const spec = CONTACT.hammer;
  if (u.state === 'dead' || !spec) return false;
  const struck = contactAttack(w, u, dt, emit, spec);
  const target = w.players[u.targetPlayer];
  if (!target.baseBuilt) return false;
  if (flowDist(ensureFlow(w, u.targetPlayer), u.x, u.y) !== FLOW_INF) return false;

  const dx = target.baseTx + 0.5 - u.x;
  const dy = target.baseTy + 0.5 - u.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) return false;
  u.heading = Math.atan2(dy, dx);
  if (struck) return true;
  const step = Math.min(dist, UNIT_DEFS.hammer.speed * dt);
  const mx = (dx / dist) * step;
  const my = (dy / dist) * step;
  const g = w.grid;
  if (!isBlocked(g, Math.floor(u.x + mx), Math.floor(u.y + my))) {
    u.x += mx;
    u.y += my;
  } else if (!isBlocked(g, Math.floor(u.x + mx), Math.floor(u.y))) u.x += mx;
  else if (!isBlocked(g, Math.floor(u.x), Math.floor(u.y + my))) u.y += my;
  return true;
}

export function registerHammer(): void {
  registerUnitBehavior('hammer', hammerBehavior);
}
