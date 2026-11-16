import { describe, expect, it } from 'vitest';
import type { Team, World } from '../src/types';
import { ROWS } from '../src/core/config';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { cellIndex, getCell, getSpawnCells, setTowerAt } from '../src/systems/Grid';
import { findPath } from '../src/systems/Pathfinding';
import { nextStep, updateFlowFields } from '../src/systems/FlowField';

function makeWorld(seed = 123): World {
  const world = createWorld('versus', VERSUS_LEVEL, seed);
  world.players[0].money = 10000;
  return world;
}

/** Follows nextStep from (col,row) to the target base; returns the visited cells (start excluded). */
function walk(world: World, team: Team, col: number, row: number): { col: number; row: number }[] {
  const out: { col: number; row: number }[] = [];
  let c = col;
  let r = row;
  for (let i = 0; i < 1000; i++) {
    const step = nextStep(world, team, c, r);
    if (!step) break;
    expect(Math.abs(step.col - c) + Math.abs(step.row - r)).toBe(1);
    c = step.col;
    r = step.row;
    out.push(step);
  }
  return out;
}

describe('flow field', () => {
  it('distances strictly decrease along nextStep chains, ending on the target base', () => {
    for (const seed of [1, 7, 42, 123]) {
      const world = makeWorld(seed);
      updateFlowFields(world);
      expect(world.flow.version).toBe(world.grid.version);
      for (const team of [0, 1] as Team[]) {
        const dist = world.flow.dist[team];
        for (const s of getSpawnCells(team)) {
          const start = dist[cellIndex(world.grid, s.col, s.row)]!;
          expect(start).toBeGreaterThan(0);
          // BFS distance equals the A* shortest path length.
          expect(start).toBe(findPath(world.grid, s, team === 0 ? 1 : 0)!.length - 1);
          let prev = start;
          const chain = walk(world, team, s.col, s.row);
          expect(chain.length).toBe(start);
          for (const p of chain) {
            const d = dist[cellIndex(world.grid, p.col, p.row)]!;
            expect(d).toBe(prev - 1);
            prev = d;
          }
          const last = chain[chain.length - 1]!;
          expect(getCell(world.grid, last.col, last.row)!.baseTeam).toBe(team === 0 ? 1 : 0);
          expect(nextStep(world, team, last.col, last.row)).toBeNull();
        }
      }
    }
  });

  it('marks blocked cells unreachable and steps off them toward the base', () => {
    const world = makeWorld();
    setTowerAt(world.grid, 12, 5, 999);
    updateFlowFields(world);
    const i = cellIndex(world.grid, 12, 5);
    expect(world.flow.dist[0][i]).toBe(-1);
    expect(world.flow.dist[0][cellIndex(world.grid, 0, 8)]).toBe(-1);
    const step = nextStep(world, 0, 12, 5)!;
    expect(step).not.toBeNull();
    expect(world.flow.dist[0][cellIndex(world.grid, step.col, step.row)]).toBeGreaterThanOrEqual(0);
  });

  it('re-routes after a tower is built', () => {
    const world = makeWorld();
    for (const cell of world.grid.cells) if (cell.type === 'rock') cell.type = 'empty';
    world.grid.version++;
    // Wall at col 14 with a single gap at row 0.
    for (let r = 1; r < ROWS; r++) setTowerAt(world.grid, 14, r, 1000 + r);
    updateFlowFields(world);
    expect(walk(world, 0, 10, 8).some((p) => p.col === 14 && p.row === 0)).toBe(true);
    // Open a gap at the bottom and close the top one: units now go through row ROWS-1.
    setTowerAt(world.grid, 14, ROWS - 1, null);
    setTowerAt(world.grid, 14, 0, 2000);
    updateFlowFields(world);
    const chain = walk(world, 0, 10, 8);
    expect(chain.some((p) => p.col === 14 && p.row === ROWS - 1)).toBe(true);
    expect(chain.some((p) => p.col === 14 && p.row === 0)).toBe(false);
  });

  it('is a no-op while the grid version is unchanged, reusing its buffers', () => {
    const world = makeWorld();
    updateFlowFields(world);
    const [a, b] = world.flow.dist;
    const sentinel = cellIndex(world.grid, 10, 3);
    a[sentinel] = 12345;
    updateFlowFields(world);
    expect(world.flow.dist[0]).toBe(a);
    expect(world.flow.dist[1]).toBe(b);
    expect(a[sentinel]).toBe(12345);
    world.grid.version++;
    updateFlowFields(world);
    expect(world.flow.dist[0]).toBe(a);
    expect(a[sentinel]).not.toBe(12345);
  });
});
