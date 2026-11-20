import type * as THREE from 'three';
import type { PaletteId, SimEvent, World } from '@/types';
import type { RenderContext, RenderLayer, RenderLayerFactory } from '../layer';

type PaletteAware = RenderLayer & { setPalette(id: PaletteId | null): void };

const hasSetPalette = (l: RenderLayer): l is PaletteAware => typeof (l as Partial<PaletteAware>).setPalette === 'function';

export interface LayerStack {
  readonly layers: readonly RenderLayer[];
  get<T extends RenderLayer = RenderLayer>(name: string): T | undefined;
  /** Forces a palette on layers that support it (the terrain), then loads every layer. */
  load(world: World, palette: PaletteId | null): void;
  update(world: World, alpha: number, events: readonly SimEvent[], nowSec: number): void;
  dispose(): void;
}

/** Owns layer lifecycle: terrain updates first, then the rest in registration order; one failing layer never kills the frame. */
export function createLayerStack(ctx: RenderContext, scene: THREE.Scene, factories: readonly RenderLayerFactory[]): LayerStack {
  const created = factories.map((f) => f(ctx));
  const layers = [...created.filter((l) => l.name === 'terrain'), ...created.filter((l) => l.name !== 'terrain')];
  for (const l of layers) scene.add(l.group);
  const failed = new Set<string>();

  const guard = (l: RenderLayer, what: string, fn: () => void): void => {
    if (failed.has(l.name + what)) return;
    try {
      fn();
    } catch (err) {
      failed.add(l.name + what);
      console.error(`[render] layer "${l.name}" ${what} failed`, err);
    }
  };

  return {
    layers,
    get<T extends RenderLayer>(name: string) {
      return layers.find((l) => l.name === name) as T | undefined;
    },
    load(world, palette) {
      failed.clear();
      for (const l of layers) {
        if (hasSetPalette(l)) l.setPalette(palette);
        guard(l, 'load', () => l.load(world));
      }
    },
    update(world, alpha, events, nowSec) {
      for (const l of layers) guard(l, 'update', () => l.update(world, alpha, events, nowSec));
    },
    dispose() {
      for (const l of layers) {
        scene.remove(l.group);
        guard(l, 'dispose', () => l.dispose());
      }
    },
  };
}
