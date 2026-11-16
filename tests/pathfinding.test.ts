import { describe, expect, it } from 'vitest';
import type { World } from '../src/types';
import { BASE_COL, BASE_ROW, BASE_W, BASE_H, COLS, ROWS } from '../src/core/config';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { cellIndex, createGrid, getSpawnCells, setTowerAt } from '../src/systems/Grid';
import { findPath, hasPath } from '../src/systems/Pathfinding';

function clearRocks(world: World): void {
  for (const cell of world.grid.cells) if (cell.type === 'rock') cell.type = 'empty';
}

describe('grid', () => {
  it('is deterministic, mirrored and has rock outcrops', () => {
    const a = createGrid(123);
    const b = createGrid(123);
    expect(a.cells.map((c) => c.type)).toEqual(b.cells.map((c) => c.type));
    let rocks = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = a.cells[cellIndex(a, c, r)]!;
        if (cell.type === 'rock') rocks++;
        if (cell.type !== 'base') expect(a.cells[cellIndex(a, COLS - 1 - c, r)]!.type).toBe(cell.type);
      }
    }
    expect(rocks).toBeGreaterThan(0);
  });

  it('has 2-4 mirrored multi-cell craters away from the bases, leaving lots of floor', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = createGrid(seed);
      const sizes = new Map<number, number>();
      let empty = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cell = g.cells[cellIndex(g, c, r)]!;
          if (cell.type === 'empty') empty++;
          if (cell.type !== 'rock') {
            expect(cell.obstacleId).toBe(-1);
            continue;
          }
          expect(cell.obstacleId).toBeGreaterThanOrEqual(0);
          sizes.set(cell.obstacleId, (sizes.get(cell.obstacleId) ?? 0) + 1);
          // At least 3 columns clear of each base, and away from the bases' rows near them.
          expect(c).toBeGreaterThanOrEqual(BASE_COL[0] + BASE_W + 3);
          expect(c).toBeLessThan(BASE_COL[1] - 3);
          const nearBaseRows = r >= BASE_ROW - 2 && r <= BASE_ROW + BASE_H + 1;
          if (nearBaseRows) expect(c > BASE_W + 5 && c < COLS - BASE_W - 6).toBe(true);
        }
      }
      expect(sizes.size, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(sizes.size, `seed ${seed}`).toBeLessThanOrEqual(4);
      for (const n of sizes.values()) {
        expect(n).toBeGreaterThanOrEqual(4);
        expect(n).toBeLessThanOrEqual(9);
      }
      expect(empty).toBeGreaterThan(COLS * ROWS * 0.85);
      for (const s of getSpawnCells(0)) expect(hasPath(g, s, 1)).toBe(true);
      for (const s of getSpawnCells(1)) expect(hasPath(g, s, 0)).toBe(true);
    }
  });
});

describe('pathfinding', () => {
  it('finds a path from every spawn to the enemy base on a fresh grid', () => {
    for (const seed of [1, 2, 3, 123, 999]) {
      const world = createWorld('versus', VERSUS_LEVEL, seed);
      for (const s of getSpawnCells(0)) {
        const path = findPath(world.grid, s, 1);
        expect(path).not.toBeNull();
        expect(path![0]).toEqual(s);
        const last = path![path!.length - 1]!;
        expect(world.grid.cells[cellIndex(world.grid, last.col, last.row)]!.baseTeam).toBe(1);
      }
      for (const s of getSpawnCells(1)) expect(hasPath(world.grid, s, 0)).toBe(true);
    }
  });

  it('returns a shortest 4-directional path on an empty map', () => {
    const world = createWorld('versus', VERSUS_LEVEL, 123);
    clearRocks(world);
    const path = findPath(world.grid, { col: 2, row: 8 }, 1)!;
    // From col 2 to the first enemy base column in a straight line.
    expect(path.length).toBe(BASE_COL[1] - 2 + 1);
    for (let i = 1; i < path.length; i++) {
      const d = Math.abs(path[i]!.col - path[i - 1]!.col) + Math.abs(path[i]!.row - path[i - 1]!.row);
      expect(d).toBe(1);
    }
  });

  it('avoids towers', () => {
    const world = createWorld('versus', VERSUS_LEVEL, 123);
    clearRocks(world);
    for (let r = 5; r <= 12; r++) setTowerAt(world.grid, 14, r, 1000 + r);
    const path = findPath(world.grid, { col: 2, row: 8 }, 1)!;
    expect(path).not.toBeNull();
    for (const p of path) expect(world.grid.cells[cellIndex(world.grid, p.col, p.row)]!.towerId).toBeNull();
  });

  it('returns null when a column is fully walled', () => {
    const world = createWorld('versus', VERSUS_LEVEL, 123);
    for (let r = 0; r < ROWS; r++) setTowerAt(world.grid, 14, r, 1000 + r);
    expect(findPath(world.grid, { col: 2, row: 8 }, 1)).toBeNull();
    expect(hasPath(world.grid, { col: COLS - 3, row: 8 }, 0)).toBe(false);
  });

  it('respects extraBlocked', () => {
    const world = createWorld('versus', VERSUS_LEVEL, 123);
    clearRocks(world);
    for (let r = 1; r < ROWS; r++) setTowerAt(world.grid, 14, r, 1000 + r);
    expect(hasPath(world.grid, { col: 2, row: 8 }, 1)).toBe(true);
    expect(hasPath(world.grid, { col: 2, row: 8 }, 1, new Set([cellIndex(world.grid, 14, 0)]))).toBe(false);
  });

  it('is fast', () => {
    const world = createWorld('versus', VERSUS_LEVEL, 123);
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) findPath(world.grid, { col: 2, row: i % ROWS }, 1);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
