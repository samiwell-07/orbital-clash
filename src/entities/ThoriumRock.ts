import type { Harvester, Team, ThoriumRock, World } from '../types';
import { ROCK_VALUE } from '../core/config';
import { randRange } from '../core/Random';

/** Creates a falling rock that will land at (targetX, targetY) in map pixel space. */
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
    harvesterId: null,
    magnetTowerId: null,
    reservedBy: null,
    pulse: rng() * Math.PI * 2,
    size,
    alive: true,
  };
}

/** Creates an already-landed rock (initial deposits). */
export function createLandedRock(world: World, x: number, y: number): ThoriumRock {
  const rock = createRock(world, x, y);
  rock.x = x;
  rock.y = y;
  rock.startX = x;
  rock.startY = y;
  rock.state = 'landed';
  rock.fallTimer = rock.fallDuration;
  return rock;
}

export function createHarvester(world: World, team: Team, stationId: number, x: number, y: number): Harvester {
  return {
    id: world.nextId++,
    team,
    stationId,
    x,
    y,
    state: 'idle',
    targetRockId: null,
    cargo: [],
    angle: 0,
    alive: true,
  };
}
