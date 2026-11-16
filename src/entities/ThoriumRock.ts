import type { ThoriumRock, World } from '../types';
import { ROCK_VALUE } from '../core/config';
import { randRange } from '../core/Random';

/** Creates a falling rock that will land at (targetX, targetY) in pixel space. */
export function createRock(world: World, targetX: number, targetY: number): ThoriumRock {
  const rng = world.rng;
  const fallDuration = randRange(rng, 0.9, 1.6);
  const startX = targetX + randRange(rng, -260, 260);
  const startY = targetY - randRange(rng, 500, 800);
  const size = randRange(rng, 0.8, 1.25);
  return {
    id: world.nextId++,
    x: startX,
    y: startY,
    targetX,
    targetY,
    startX,
    startY,
    state: 'falling',
    value: Math.round(ROCK_VALUE * size),
    fallTimer: 0,
    fallDuration,
    carriedBy: null,
    magnetTowerId: null,
    pulse: rng() * Math.PI * 2,
    size,
    alive: true,
  };
}
