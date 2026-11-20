import type { Grid, MapDef } from '@/types';

export interface Tile {
  tx: number;
  ty: number;
}

const versions = new WeakMap<Grid, number>();

/** Counter bumped whenever occupancy changes; flow fields compare against it. */
export function gridVersion(grid: Grid): number {
  return versions.get(grid) ?? 0;
}

export function bumpGrid(grid: Grid): void {
  versions.set(grid, gridVersion(grid) + 1);
}

export function createGrid(map: Pick<MapDef, 'w' | 'h' | 'rows'>): Grid {
  const { w, h } = map;
  const terrain = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = map.rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const c = row[x];
      terrain[y * w + x] = c === undefined || c === '#' ? 1 : c === 'o' ? 2 : 0;
    }
  }
  return { w, h, terrain, occupant: new Int32Array(w * h) };
}

export function inBounds(grid: Grid, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < grid.w && ty < grid.h;
}

export function tileIndex(grid: Grid, tx: number, ty: number): number {
  return ty * grid.w + tx;
}

export function tileOf(x: number, y: number): Tile {
  return { tx: Math.floor(x), ty: Math.floor(y) };
}

/** Terrain only: cliff, rock or crater (or out of bounds). */
export function isTerrainBlocked(grid: Grid, tx: number, ty: number): boolean {
  return !inBounds(grid, tx, ty) || grid.terrain[ty * grid.w + tx] !== 0;
}

/** Blocked for ground movement and building: terrain or a structure. */
export function isBlocked(grid: Grid, tx: number, ty: number): boolean {
  if (!inBounds(grid, tx, ty)) return true;
  const i = ty * grid.w + tx;
  return grid.terrain[i] !== 0 || grid.occupant[i] !== 0;
}

export function occupy(grid: Grid, tx: number, ty: number, structureId: number): void {
  if (!inBounds(grid, tx, ty)) return;
  grid.occupant[ty * grid.w + tx] = structureId;
  bumpGrid(grid);
}

export function vacate(grid: Grid, tx: number, ty: number, structureId?: number): void {
  if (!inBounds(grid, tx, ty)) return;
  const i = ty * grid.w + tx;
  if (structureId !== undefined && grid.occupant[i] !== structureId) return;
  grid.occupant[i] = 0;
  bumpGrid(grid);
}

export function occupantAt(grid: Grid, tx: number, ty: number): number {
  return inBounds(grid, tx, ty) ? grid.occupant[ty * grid.w + tx] : 0;
}

export const DIRS4: readonly (readonly [number, number])[] = [
  [1, 0], [0, 1], [-1, 0], [0, -1],
];
export const DIRS8: readonly (readonly [number, number])[] = [
  [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1],
];

export function neighbors4(grid: Grid, tx: number, ty: number): Tile[] {
  const out: Tile[] = [];
  for (const [dx, dy] of DIRS4) if (inBounds(grid, tx + dx, ty + dy)) out.push({ tx: tx + dx, ty: ty + dy });
  return out;
}

export function neighbors8(grid: Grid, tx: number, ty: number): Tile[] {
  const out: Tile[] = [];
  for (const [dx, dy] of DIRS8) if (inBounds(grid, tx + dx, ty + dy)) out.push({ tx: tx + dx, ty: ty + dy });
  return out;
}
