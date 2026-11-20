import type { Intent, NewGameOptions, SimEvent } from '@/types';
import { createSim } from '@/sim/core';
import { registerBuildSystems } from '@/sim/build';
import { registerEconomySystems } from '@/sim/economy';

export function gameOpts(over: Partial<NewGameOptions['settings']> = {}): NewGameOptions {
  return {
    settings: {
      mode: 'battle', profile: 'base', difficulty: 'normal', maxHits: 10, thoriumRate: 1,
      timeLimitSec: 0, strength: [0.5, 0.5, 0.5, 0.5], mission: null, comet: null, seed: 4242,
      ...over,
    },
    slots: [
      { id: 0, team: 0, controller: 'human' },
      { id: 1, team: 1, controller: 'adaptive' },
    ],
    mapId: 'test',
  };
}

/** Sim with build + economy registered; steps return the events produced in that call. */
export function makeSim(over: Partial<NewGameOptions['settings']> = {}) {
  registerBuildSystems();
  registerEconomySystems();
  const sim = createSim(gameOpts(over));
  const w = sim.world;
  return {
    sim,
    w,
    step(intents: Intent[] = [], ticks = 1): SimEvent[] {
      const out: SimEvent[] = [];
      for (let i = 0; i < ticks; i++) {
        sim.step(i === 0 ? intents : []);
        out.push(...sim.drainEvents());
      }
      return out;
    },
  };
}

/** Replaces the map with a 1-tile-wide corridor (y = 1) of `len` tiles; p1 base at the left end, p0 at the right. */
export function corridor(w: ReturnType<typeof makeSim>['w'], len = 8): void {
  w.grid.w = len;
  w.grid.h = 3;
  w.grid.terrain = new Uint8Array(len * 3).fill(1);
  for (let x = 0; x < len; x++) w.grid.terrain[len + x] = 0;
  w.grid.occupant = new Int32Array(len * 3);
  w.flows = [null, null, null, null];
  w.players[1].baseTx = 0;
  w.players[1].baseTy = 1;
  w.players[0].baseTx = len - 1;
  w.players[0].baseTy = 1;
}
