import type { Intent, NewGameOptions, Pipeline, SimApi, SimEvent } from '@/types';
import { TICK_DT } from '@/config/constants';
import { createWorld } from './worldFactory';
import { createPipeline, registryVersion } from './pipeline';
import { queueIntents } from './intents';

export * from './rng';
export * from './loop';
export * from './grid';
export * from './flow';
export * from './spatial';
export * from './entities';
export * from './defaultMap';
export * from './worldFactory';
export * from './victory';
export * from './pipeline';
export * from './intents';

/**
 * Builds a simulation. Systems registered via registerSystem (at any time before a step) are
 * picked up automatically; `extra` systems are appended for this sim only.
 */
export function createSim(opts: NewGameOptions, extra: Pipeline = []): SimApi {
  const world = createWorld(opts);
  let pipeline = createPipeline(extra);
  let seen = registryVersion();
  const emit = (e: SimEvent) => {
    world.events.push(e);
  };

  return {
    world,
    step(intents: readonly Intent[]): void {
      const rest: Intent[] = [];
      for (const it of intents) {
        if (it.t === 'pause') world.paused = !world.paused;
        else rest.push(it);
      }
      if (world.paused || world.over) return;
      if (seen !== registryVersion()) {
        pipeline = createPipeline(extra);
        seen = registryVersion();
      }
      queueIntents(world, rest);
      for (const sys of pipeline) sys.run(world, TICK_DT, emit);
      world.tick++;
      world.timeSec = world.tick * TICK_DT;
    },
    drainEvents(): SimEvent[] {
      const out = world.events;
      world.events = [];
      return out;
    },
  };
}
