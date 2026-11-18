import { registerUnitBehavior } from '@/sim/army/hooks';
import { contactAttack } from './contact';
import { CONTACT } from './tuning';
import type { Emit, Unit, World } from '@/types';

/** Snake: armoured ground ribbon that chews on structures it touches while marching. */
export function snakeBehavior(w: World, u: Unit, dt: number, emit: Emit): boolean {
  if (u.state !== 'dead' && CONTACT.snake) contactAttack(w, u, dt, emit, CONTACT.snake);
  return false;
}

/** Dragon: flying breath attack, splash on the structures below it. */
export function dragonBehavior(w: World, u: Unit, dt: number, emit: Emit): boolean {
  if (u.state !== 'dead' && CONTACT.dragon) contactAttack(w, u, dt, emit, CONTACT.dragon);
  return false;
}

export function registerSnake(): void {
  registerUnitBehavior('snake', snakeBehavior);
}
export function registerDragon(): void {
  registerUnitBehavior('dragon', dragonBehavior);
}
