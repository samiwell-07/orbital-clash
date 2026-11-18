import type { Emit, Intent, NewGameOptions, PlayerSlot, SimEvent, World } from '@/types';
import { TICK_DT } from '@/config/constants';
import {
  applyIntentsSystem, createWorld, queueIntents, registerIntentHandler, removeDeadUnits,
} from '@/sim/core';
import { launchSystem } from '@/sim/army/launch';
import { marchSystem } from '@/sim/army/march';
import { productionSystem } from '@/sim/army/production';
import { handleAttackIntent } from '@/sim/army/attackIntents';

registerIntentHandler(handleAttackIntent);

export function opts(over: Partial<NewGameOptions['settings']> = {}, slots?: PlayerSlot[]): NewGameOptions {
  return {
    settings: {
      mode: 'battle', profile: 'base', difficulty: 'normal', maxHits: 10, thoriumRate: 1,
      timeLimitSec: 0, strength: [0.5, 0.5, 0.5, 0.5], mission: null, comet: null, seed: 7,
      ...over,
    },
    slots: slots ?? [
      { id: 0, team: 0, controller: 'human' },
      { id: 1, team: 1, controller: 'adaptive' },
    ],
    mapId: 'army-test',
  };
}

/** Open floor arena; player 0's base on the left, player 1's on the right (and 2/3 if present). */
export function arena(w = 24, h = 10, over: Partial<NewGameOptions['settings']> = {}, slots?: PlayerSlot[]): World {
  const world = createWorld(opts(over, slots));
  world.grid.w = w;
  world.grid.h = h;
  world.grid.terrain = new Uint8Array(w * h);
  world.grid.occupant = new Int32Array(w * h);
  world.flows = [null, null, null, null];
  const spots = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
  world.players.forEach((p, i) => {
    p.baseTx = spots[i][0];
    p.baseTy = spots[i][1];
    p.baseBuilt = p.alive;
  });
  return world;
}

export function wallTerrain(w: World, tx: number, ty: number): void {
  w.grid.terrain[ty * w.grid.w + tx] = 1;
}

/** One full tick of the army systems (production, launch, movement) plus cleanup. */
export function tick(w: World, events: SimEvent[] = [], intents: Intent[] = []): void {
  const emit: Emit = (e) => events.push(e);
  queueIntents(w, intents);
  applyIntentsSystem(w, TICK_DT, emit);
  productionSystem(w, TICK_DT, emit);
  launchSystem(w, TICK_DT, emit);
  marchSystem(w, TICK_DT, emit);
  removeDeadUnits(w);
  w.tick++;
  w.timeSec = w.tick * TICK_DT;
}

export function run(w: World, seconds: number, events: SimEvent[] = []): void {
  const n = Math.round(seconds / TICK_DT);
  for (let i = 0; i < n; i++) tick(w, events);
}
