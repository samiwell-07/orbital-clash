import type { Pipeline, System } from '@/types';
import { applyIntentsSystem } from './intents';
import { rebuild } from './spatial';
import { removeDeadUnits } from './entities';
import { victorySystem } from './victory';

/** Stage order from docs/ARCHITECTURE.md. Spacing leaves room for extra systems. */
export const STAGE_ORDER = {
  timeline: 10,
  applyIntents: 20,
  build: 30,
  rocks: 40,
  economy: 50,
  production: 60,
  launch: 70,
  movement: 80,
  combat: 90,
  projectiles: 100,
  cleanup: 110,
  victory: 120,
} as const;

interface Entry {
  name: string;
  order: number;
  run: System;
  seq: number;
}

const registry = new Map<string, Entry>();
let seq = 0;
let version = 0;

/** Register (or replace, by name) a system at a given order; ties keep registration order. */
export function registerSystem(name: string, order: number, run: System): void {
  registry.set(name, { name, order, run, seq: seq++ });
  version++;
}

export function unregisterSystem(name: string): void {
  if (registry.delete(name)) version++;
}

export function registryVersion(): number {
  return version;
}

/** Sort entries by order (stable) into a Pipeline. */
export function composePipeline(entries: readonly { name: string; order: number; run: System; seq?: number }[]): Pipeline {
  return [...entries]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.order - b.e.order || (a.e.seq ?? a.i) - (b.e.seq ?? b.i))
    .map(({ e }) => ({ name: e.name, run: e.run }));
}

/**
 * All registered systems in order, plus `extra` systems. An extra whose name is a stage name runs
 * at that stage's order; other extras run just before 'cleanup'.
 */
export function createPipeline(extra: Pipeline = []): Pipeline {
  const entries: { name: string; order: number; run: System; seq: number }[] = [...registry.values()];
  for (const x of extra) {
    const stage = (STAGE_ORDER as Record<string, number>)[x.name];
    entries.push({ name: x.name, order: stage ?? STAGE_ORDER.cleanup - 1, run: x.run, seq: seq++ });
  }
  return composePipeline(entries);
}

const cleanupSystem: System = (w) => {
  removeDeadUnits(w);
};

const spatialSystem: System = (w) => {
  rebuild(w);
};

registerSystem('applyIntents', STAGE_ORDER.applyIntents, applyIntentsSystem);
registerSystem('spatial.pre-movement', STAGE_ORDER.movement - 5, spatialSystem);
registerSystem('spatial.pre-combat', STAGE_ORDER.combat - 5, spatialSystem);
registerSystem('cleanup', STAGE_ORDER.cleanup, cleanupSystem);
registerSystem('victory', STAGE_ORDER.victory, victorySystem);
