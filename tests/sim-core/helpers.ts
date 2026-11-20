import type { NewGameOptions, PlayerSlot } from '@/types';
import { createWorld } from '@/sim/core/worldFactory';

export function opts(over: Partial<NewGameOptions['settings']> = {}, slots?: PlayerSlot[], mapId = 'test'): NewGameOptions {
  return {
    settings: {
      mode: 'battle', profile: 'base', difficulty: 'normal', maxHits: 10, thoriumRate: 1,
      timeLimitSec: 0, strength: [0.5, 0.5, 0.5, 0.5], mission: null, comet: null, seed: 1234,
      ...over,
    },
    slots: slots ?? [
      { id: 0, team: 0, controller: 'human' },
      { id: 1, team: 1, controller: 'adaptive' },
    ],
    mapId,
  };
}

export function makeWorld(over: Partial<NewGameOptions['settings']> = {}, slots?: PlayerSlot[]) {
  return createWorld(opts(over, slots));
}

/** Open (all floor) w x h arena for deterministic path tests. */
export function openWorld(w = 12, h = 9) {
  const world = makeWorld();
  world.grid.w = w;
  world.grid.h = h;
  world.grid.terrain = new Uint8Array(w * h);
  world.grid.occupant = new Int32Array(w * h);
  world.flows = [null, null, null, null];
  for (const p of world.players) p.baseBuilt = false;
  return world;
}
