import type * as THREE from 'three';
import type { World, SimEvent } from '@/types';

/**
 * A render layer owns a THREE.Group and keeps it in sync with the World.
 * The engine (render/engine) only knows this interface; models, fx and terrain each export one.
 * Positions: world (x, y) tiles map to three.js (x, 0, y); up is +Y.
 */
export interface RenderLayer {
  readonly name: string;
  readonly group: THREE.Group;
  /** Called when a new World is loaded: rebuild static content (terrain, palettes). */
  load(world: World): void;
  /** Called every rendered frame. alpha in [0,1) interpolates between fixed steps. */
  update(world: World, alpha: number, events: readonly SimEvent[], nowSec: number): void;
  dispose(): void;
}

/** Hooks the engine exposes to layers (lights, camera shake, bloom pulses). */
export interface RenderContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  shake(amount: number): void;
  flash(color: number, strength: number): void;
}

export type RenderLayerFactory = (ctx: RenderContext) => RenderLayer;
