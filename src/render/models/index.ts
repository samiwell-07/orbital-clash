import { Group } from 'three';
import type { RenderContext, RenderLayer, RenderLayerFactory } from '../layer';
import type { SimEvent, World } from '@/types';
import { disposeCachedGeometry } from '@/render/instancing/kit';
import { BaseSystem } from './base';
import { disposeMaterials } from './materials';
import { ProjectileSystem } from './projectiles';
import { RockSystem } from './rocks';
import { ShipSystem } from './ship';
import { StructureSystem } from './structures/system';
import { TargetIndex } from './types';
import type { FrameInfo, ModelSystem } from './types';
import { UnitSystem } from './units';

export { ROCK_RADIUS } from './rocks';
export { BASE_RADIUS } from './base';
export { upgradeMarks, platformVariant } from './structures/marks';

const MAX_DT = 0.1;

/**
 * Draws every dynamic world entity: structures, bases, ships, rocks, units and projectiles.
 * Reads the World only; never mutates it.
 */
export const createModelsLayer: RenderLayerFactory = (_ctx: RenderContext): RenderLayer => {
  const group = new Group();
  group.name = 'models';
  const targets = new TargetIndex();
  const systems: ModelSystem[] = [
    new StructureSystem(), new BaseSystem(), new RockSystem(), new UnitSystem(), new ProjectileSystem(), new ShipSystem(),
  ];
  for (const s of systems) group.add(s.group);
  const frame: FrameInfo = { world: null as unknown as World, alpha: 0, now: 0, dt: 1 / 60, events: [] as readonly SimEvent[], targets };
  let last = -1;

  return {
    name: 'models',
    group,
    load(world: World): void {
      for (const s of systems) s.load(world);
      last = -1;
    },
    update(world: World, alpha: number, events: readonly SimEvent[], nowSec: number): void {
      frame.world = world;
      frame.alpha = alpha;
      frame.events = events;
      frame.dt = last < 0 ? 1 / 60 : Math.min(MAX_DT, Math.max(1e-4, nowSec - last));
      frame.now = nowSec;
      last = nowSec;
      targets.beginFrame(world);
      for (const s of systems) s.update(frame);
    },
    dispose(): void {
      for (const s of systems) s.dispose();
      disposeMaterials();
      disposeCachedGeometry();
      group.removeFromParent();
    },
  };
};
