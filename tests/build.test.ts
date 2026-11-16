import { describe, expect, it } from 'vitest';
import type { Team, World } from '../src/types';
import { ROWS } from '../src/core/config';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { towerStats } from '../src/data/towers';
import { createHarvester, createLandedRock, createRock } from '../src/entities/ThoriumRock';
import { createUnit } from '../src/entities/Unit';
import { cellCenter, getCell, getSpawnCells, pixelToCell, setTowerAt } from '../src/systems/Grid';
import { hasPath } from '../src/systems/Pathfinding';
import { canBuild, getTowerAt, tryBuild, trySell, tryUpgrade, wouldBlockPaths } from '../src/systems/BuildSystem';

function makeWorld(): World {
  const world = createWorld('versus', VERSUS_LEVEL, 123);
  for (const cell of world.grid.cells) if (cell.type === 'rock') cell.type = 'empty';
  world.players[0].money = 10000;
  world.players[1].money = 10000;
  return world;
}

describe('canBuild', () => {
  it('accepts an open cell', () => {
    expect(canBuild(makeWorld(), 0, 'laser', 10, 3)).toEqual({ ok: true, reason: '' });
  });

  it('rejects bounds, rock, base margin and occupied cells', () => {
    const world = makeWorld();
    expect(canBuild(world, 0, 'laser', -1, 3).reason).toBe('OUT OF BOUNDS');
    getCell(world.grid, 10, 3)!.type = 'rock';
    expect(canBuild(world, 0, 'laser', 10, 3).reason).toBe('BLOCKED TERRAIN');
    expect(canBuild(world, 0, 'laser', 0, 8).reason).toBe('TOO CLOSE TO BASE');
    expect(canBuild(world, 0, 'laser', 2, 6).reason).toBe('TOO CLOSE TO BASE');
    expect(canBuild(world, 0, 'laser', 3, 6).ok).toBe(true);
    expect(tryBuild(world, 1, 'laser', 12, 3)).toBe(true);
    expect(canBuild(world, 0, 'laser', 12, 3).reason).toBe('OCCUPIED');
  });

  it('rejects landed and falling thorium', () => {
    const world = makeWorld();
    const c = cellCenter(10, 3);
    const falling = createRock(world, c.x + 5, c.y - 5);
    world.rocks.push(falling);
    expect(canBuild(world, 0, 'laser', 10, 3).reason).toBe('THORIUM HERE');
    falling.state = 'landed';
    falling.x = cellCenter(11, 3).x;
    falling.y = c.y;
    expect(canBuild(world, 0, 'laser', 10, 3).ok).toBe(true);
    expect(canBuild(world, 0, 'laser', 11, 3).reason).toBe('THORIUM HERE');
    for (const state of ['carried', 'magnet'] as const) {
      falling.state = state;
      expect(canBuild(world, 0, 'laser', 11, 3).ok).toBe(true);
    }
  });

  it('rejects cells under or ahead of a unit', () => {
    const world = makeWorld();
    const c = cellCenter(10, 3);
    world.units.push(createUnit(world, 0, 'scout', c.x, c.y, 11, 3, 0));
    expect(canBuild(world, 1, 'laser', 10, 3).reason).toBe('UNIT IN THE WAY');
    expect(canBuild(world, 1, 'laser', 11, 3).reason).toBe('UNIT IN THE WAY');
  });

  it('ignores air units overhead', () => {
    const world = makeWorld();
    const c = cellCenter(10, 3);
    world.units.push(createUnit(world, 0, 'bomber', c.x, c.y, 11, 3, 0));
    expect(canBuild(world, 1, 'laser', 10, 3).ok).toBe(true);
    expect(canBuild(world, 1, 'laser', 11, 3).ok).toBe(true);
  });

  it('rejects when money is short', () => {
    const world = makeWorld();
    world.players[0].money = towerStats('cannon', 0).cost - 1;
    expect(canBuild(world, 0, 'cannon', 10, 3).reason).toBe('NOT ENOUGH THORIUM');
    expect(tryBuild(world, 0, 'cannon', 10, 3)).toBe(false);
    expect(world.events.some((e) => e.type === 'notEnoughMoney')).toBe(true);
    expect(world.players[0].cursor.failFlash).toBe(0.4);
  });
});

describe('wouldBlockPaths', () => {
  it('detects the last gap in a wall', () => {
    const world = makeWorld();
    for (let r = 0; r < ROWS; r++) if (r !== 4) setTowerAt(world.grid, 16, r, 1000 + r);
    expect(wouldBlockPaths(world, 15, 9)).toBe(false);
    expect(wouldBlockPaths(world, 16, 4)).toBe(true);
    const check = canBuild(world, 0, 'laser', 16, 4);
    expect(check.reason).toBe('WOULD BLOCK PATH');
    expect(tryBuild(world, 0, 'laser', 16, 4)).toBe(false);
    expect(world.events.some((e) => e.type === 'buildFail' && e.reason === 'WOULD BLOCK PATH')).toBe(true);
  });

  it('detects a unit that would be sealed in', () => {
    const world = makeWorld();
    // Box a unit at (10,3) in except for (10,4).
    setTowerAt(world.grid, 9, 3, 900);
    setTowerAt(world.grid, 11, 3, 901);
    setTowerAt(world.grid, 10, 2, 902);
    const c = cellCenter(10, 3);
    world.units.push(createUnit(world, 0, 'scout', c.x, c.y, 10, 3, 0));
    expect(wouldBlockPaths(world, 10, 4)).toBe(true);
    expect(wouldBlockPaths(world, 10, 5)).toBe(false);
  });

  it('ignores air units when checking for sealed-in units', () => {
    const world = makeWorld();
    setTowerAt(world.grid, 9, 3, 900);
    setTowerAt(world.grid, 11, 3, 901);
    setTowerAt(world.grid, 10, 2, 902);
    const c = cellCenter(10, 3);
    world.units.push(createUnit(world, 0, 'bomber', c.x, c.y, 10, 3, 0));
    expect(wouldBlockPaths(world, 10, 4)).toBe(false);
  });

  it('agrees with the A*-per-start definition on walled maps', () => {
    // Reference: one A* from every spawn cell and every live unit cell.
    const reference = (world: World, col: number, row: number): boolean => {
      const extra = new Set([row * world.grid.cols + col]);
      for (const team of [0, 1] as Team[]) {
        const goal: Team = team === 0 ? 1 : 0;
        for (const s of getSpawnCells(team)) if (!hasPath(world.grid, s, goal, extra)) return true;
      }
      for (const u of world.units) {
        if (!u.alive || u.air) continue;
        const c = pixelToCell(u.x, u.y);
        if (c.col < 0 || c.row < 0 || c.col >= world.grid.cols || c.row >= world.grid.rows) continue;
        if (!hasPath(world.grid, c, u.team === 0 ? 1 : 0, extra)) return true;
      }
      return false;
    };
    const scenarios: ((w: World) => void)[] = [
      // Wall with one gap.
      (w) => {
        for (let r = 0; r < ROWS; r++) if (r !== 4) setTowerAt(w.grid, 16, r, 1000 + r);
      },
      // Two staggered walls (a maze) plus units on both sides, one sealed in a pocket, one on a base cell.
      (w) => {
        for (let r = 0; r < ROWS - 1; r++) setTowerAt(w.grid, 10, r, 1000 + r);
        for (let r = 1; r < ROWS; r++) setTowerAt(w.grid, 20, r, 1100 + r);
        setTowerAt(w.grid, 5, 1, 1200);
        setTowerAt(w.grid, 6, 0, 1201);
        for (const [team, col, row] of [[0, 14, 5], [1, 7, 12], [0, 25, 16], [1, 0, 8], [0, 5, 0]] as [Team, number, number][]) {
          const c = cellCenter(col, row);
          w.units.push(createUnit(w, team, 'scout', c.x, c.y, col, row, 0));
        }
      },
      // A ring of towers, and a unit standing on a tower cell in a pocket open only at (22,10).
      (w) => {
        for (const [c, r] of [[12, 2], [13, 3], [12, 4], [11, 3]]) setTowerAt(w.grid, c, r, 1300 + c * 20 + r);
        for (const [c, r] of [[22, 9], [23, 9], [22, 8], [21, 9]]) setTowerAt(w.grid, c, r, 1400 + c * 20 + r);
        const c = cellCenter(22, 9);
        w.units.push(createUnit(w, 1, 'tank', c.x, c.y, 22, 9, 0));
      },
    ];
    for (const setup of scenarios) {
      const world = makeWorld();
      setup(world);
      let blocked = 0;
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < world.grid.cols; col++) {
          const expected = reference(world, col, row);
          if (expected) blocked++;
          expect(wouldBlockPaths(world, col, row), `cell ${col},${row}`).toBe(expected);
        }
      }
      expect(blocked).toBeGreaterThan(0);
    }
  });
});

describe('tryBuild / tryUpgrade / trySell', () => {
  it('builds, deducts money and bumps grid.version', () => {
    const world = makeWorld();
    const v = world.grid.version;
    expect(tryBuild(world, 0, 'laser', 10, 3)).toBe(true);
    expect(world.players[0].money).toBe(10000 - towerStats('laser', 0).cost);
    expect(world.grid.version).toBe(v + 1);
    expect(getTowerAt(world, 10, 3)?.kind).toBe('laser');
    expect(world.events.at(-1)?.type).toBe('build');
  });

  it('upgrades to level 3 only with maxLevel3 research', () => {
    const world = makeWorld();
    tryBuild(world, 0, 'laser', 10, 3);
    expect(tryUpgrade(world, 1, 10, 3)).toBe(false);
    expect(tryUpgrade(world, 0, 10, 3)).toBe(true);
    const money = world.players[0].money;
    world.players[0].cursor.failFlash = 0;
    expect(tryUpgrade(world, 0, 10, 3)).toBe(false);
    expect(world.events.at(-1)).toMatchObject({ type: 'buildFail', reason: 'NEED LV3 RESEARCH' });
    expect(world.players[0].cursor.failFlash).toBe(0.4);
    expect(world.players[0].money).toBe(money);
    expect(getTowerAt(world, 10, 3)!.level).toBe(1);
    world.players[0].researched.maxLevel3 = true;
    expect(tryUpgrade(world, 0, 10, 3)).toBe(true);
    expect(tryUpgrade(world, 0, 10, 3)).toBe(false);
    const t = getTowerAt(world, 10, 3)!;
    expect(t.level).toBe(2);
    expect(t.totalSpent).toBe(towerStats('laser', 0).cost + towerStats('laser', 1).cost + towerStats('laser', 2).cost);
  });

  it('sells for 75% and frees the cell', () => {
    const world = makeWorld();
    tryBuild(world, 0, 'cannon', 10, 3);
    tryUpgrade(world, 0, 10, 3);
    const before = world.players[0].money;
    expect(trySell(world, 1, 10, 3)).toBe(false);
    expect(trySell(world, 0, 10, 3)).toBe(true);
    expect(world.players[0].money - before).toBe(Math.floor((towerStats('cannon', 0).cost + towerStats('cannon', 1).cost) * 0.75));
    expect(getCell(world.grid, 10, 3)!.towerId).toBeNull();
    expect(world.towers.length).toBe(0);
    expect(canBuild(world, 0, 'laser', 10, 3).ok).toBe(true);
  });

  it('selling a refinery releases its rocks', () => {
    const world = makeWorld();
    tryBuild(world, 0, 'refinery', 10, 3);
    const tower = getTowerAt(world, 10, 3)!;
    const pulled = createRock(world, 100, 100);
    pulled.state = 'magnet';
    pulled.magnetTowerId = tower.id;
    const refining = createRock(world, 100, 100);
    refining.state = 'refining';
    refining.magnetTowerId = tower.id;
    tower.refineQueue.push(refining.id);
    const other = createRock(world, 200, 200);
    other.state = 'landed';
    world.rocks.push(pulled, refining, other);
    expect(trySell(world, 0, 10, 3)).toBe(true);
    for (const r of [pulled, refining]) {
      expect(r.state).toBe('landed');
      expect(r.magnetTowerId).toBeNull();
      expect(r.x).toBe(tower.x);
      expect(r.y).toBe(tower.y);
    }
    expect(other.x).toBe(other.startX);
    expect(tower.refineQueue.length).toBe(0);
  });

  it('selling a refinery kills its harvesters and drops their cargo', () => {
    const world = makeWorld();
    tryBuild(world, 0, 'refinery', 10, 3);
    tryBuild(world, 0, 'refinery', 14, 3);
    const tower = getTowerAt(world, 10, 3)!;
    const keep = getTowerAt(world, 14, 3)!;
    const drone = createHarvester(world, 0, tower.id, 300, 220);
    const otherDrone = createHarvester(world, 0, keep.id, 500, 220);
    const cargo = createRock(world, 300, 220);
    cargo.state = 'carried';
    cargo.harvesterId = drone.id;
    cargo.reservedBy = drone.id;
    drone.cargo.push(cargo.id);
    drone.state = 'returning';
    const reserved = createLandedRock(world, 400, 400);
    reserved.reservedBy = drone.id;
    const othersReserved = createLandedRock(world, 450, 400);
    othersReserved.reservedBy = otherDrone.id;
    world.harvesters.push(drone, otherDrone);
    world.rocks.push(cargo, reserved, othersReserved);
    expect(trySell(world, 0, 10, 3)).toBe(true);
    expect(drone.alive).toBe(false);
    expect(drone.cargo.length).toBe(0);
    expect(otherDrone.alive).toBe(true);
    expect(cargo).toMatchObject({ state: 'landed', harvesterId: null, reservedBy: null, x: 300, y: 220 });
    expect(reserved.reservedBy).toBeNull();
    expect(othersReserved.reservedBy).toBe(otherDrone.id);
  });
});
