import * as THREE from 'three';
import type { PaletteId, SimEvent, World } from '@/types';
import type { RenderContext, RenderLayer } from '../layer';
import { buildDust, type Dust } from './ambient';
import { buildBackdrop, type Backdrop } from './backdrop';
import { type CanvasFactory, defaultCanvasFactory } from './canvas';
import { buildCraterGlow, type CraterSet } from './craters';
import { Bin } from './dispose';
import { buildFloorGeometry, createFloorMaterial } from './floor';
import { buildGridLines } from './grid';
import { buildCursorMarkers, type TerrainCursor } from './cursors';
import { getPalette, resolvePaletteId, type Palette } from './palettes';
import { buildRocks, type RockSet } from './rocks';
import { buildSkirt } from './skirt';
import { createFloorTextures, type FloorTextures } from './textures';

export interface TerrainLayer extends RenderLayer {
  readonly paletteId: PaletteId;
  /** Force a palette for the next load() (the world itself only carries the comet id). */
  setPalette(id: PaletteId | null): void;
  /** Tile highlights (+ dashed range ring) for the players' ship cursors. */
  setCursors(cursors: readonly TerrainCursor[]): void;
  setGridVisible(visible: boolean): void;
}

export interface TerrainOptions {
  canvasFactory?: CanvasFactory;
  gridOpacity?: number;
}

export function createTerrainLayer(ctx: RenderContext, options: TerrainOptions = {}): TerrainLayer {
  const group = new THREE.Group();
  group.name = 'terrain';
  const factory = options.canvasFactory ?? defaultCanvasFactory;
  const staticBin = new Bin();
  const cursorBin = new Bin();
  const textureCache = new Map<PaletteId, FloorTextures>();
  const cursors = buildCursorMarkers(cursorBin);
  const content = new THREE.Group();
  group.add(content, cursors.group);

  let forced: PaletteId | null = null;
  let current: PaletteId = 'kreios';
  let palette: Palette = getPalette(current);
  let floorMat: THREE.MeshStandardMaterial | null = null;
  let rocks: RockSet | null = null;
  let craters: CraterSet | null = null;
  let dust: Dust | null = null;
  let backdrop: Backdrop | null = null;
  let grid: THREE.LineSegments | null = null;
  let gridVisible = true;
  let pending: readonly TerrainCursor[] = [];

  function clear(): void {
    content.clear();
    staticBin.disposeAll();
    floorMat = null;
    rocks = craters = dust = backdrop = grid = null;
  }

  function load(world: World): void {
    clear();
    const g = world.grid;
    current = forced ?? resolvePaletteId(world);
    palette = getPalette(current);
    let tex = textureCache.get(current);
    if (!tex) {
      tex = createFloorTextures(palette, ctx.renderer.capabilities.getMaxAnisotropy(), factory);
      textureCache.set(current, tex);
    }
    const geo = staticBin.add(buildFloorGeometry(g, tex.spec));
    floorMat = staticBin.add(createFloorMaterial(palette, tex));
    const floor = new THREE.Mesh(geo, floorMat);
    floor.name = 'floor';
    floor.receiveShadow = true;
    content.add(floor);
    rocks = buildRocks(g, palette, staticBin);
    craters = buildCraterGlow(g, palette, staticBin);
    grid = buildGridLines(g, geo, palette, staticBin, options.gridOpacity);
    grid.visible = gridVisible;
    dust = buildDust(g.w, g.h, palette, staticBin);
    backdrop = buildBackdrop(palette, g.w / 2, g.h / 2, staticBin);
    content.add(rocks.group, craters.group, grid, dust.points, backdrop.group, buildSkirt(g.w, g.h, palette, staticBin));
    ctx.scene.background = new THREE.Color(palette.space.a);
    cursors.set(pending);
  }

  const size = new THREE.Vector2();
  function update(_world: World, _alpha: number, _events: readonly SimEvent[], nowSec: number): void {
    ctx.renderer.getDrawingBufferSize(size);
    if (floorMat) floorMat.emissiveIntensity = palette.inlay.intensity * (0.9 + 0.1 * Math.sin(nowSec * 1.4));
    rocks?.update(nowSec);
    craters?.update(nowSec);
    dust?.update(nowSec, size.y);
    backdrop?.update(nowSec, size.y);
    cursors.update(nowSec);
  }

  return {
    name: 'terrain',
    group,
    get paletteId() {
      return current;
    },
    load,
    update,
    setPalette(id) {
      forced = id;
    },
    setCursors(list) {
      pending = list;
      cursors.set(list);
    },
    setGridVisible(v) {
      gridVisible = v;
      if (grid) grid.visible = v;
    },
    dispose() {
      clear();
      cursorBin.disposeAll();
      for (const t of textureCache.values()) t.dispose();
      textureCache.clear();
      group.clear();
    },
  };
}
