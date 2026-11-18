import type { RenderLayerFactory } from '../layer';
import { createTerrainLayer } from '../terrain';
import { createRenderer, type RendererWithView } from './createRenderer';

export { createRenderer } from './createRenderer';
export type { RendererWithView } from './createRenderer';
export { WebGLUnsupportedError } from './errors';
export { worldToScreen, screenToWorld } from './project';
export type { RendererView, ScreenPoint } from './project';
export { QUALITY_PRESETS, QualityScaler } from './quality';
export type { QualityLevel, QualityPreset, QualityState } from './quality';
export { CAMERA_DEFAULTS, computeFitDistance, cameraPose } from './camera';
export { ShakeState, SHAKE } from './shake';
export { createTerrainLayer } from '../terrain';
export type { TerrainLayer, TerrainCursor } from '../terrain';

/** Renderer with the terrain layer registered first, followed by the given layers (models, instancing, fx...). */
export function createGameRenderer(otherLayers: readonly RenderLayerFactory[] = []): RendererWithView {
  return createRenderer([createTerrainLayer, ...otherLayers]);
}
