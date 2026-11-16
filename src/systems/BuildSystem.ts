import type { Team, Tower, TowerKind, World } from '../types';
import { SELL_REFUND, TILE, otherTeam } from '../core/config';
import { towerStats, upgradeCost } from '../data/towers';
import { createTower } from '../entities/Tower';
import { cellIndex, getCell, getSpawnCells, inBounds, isNearBase, pixelToCell, setTowerAt } from './Grid';
import { floodFromGoal, floodReaches } from './Pathfinding';

export interface BuildCheck {
  ok: boolean;
  reason: string;
}

const NO_MONEY = 'NOT ENOUGH THORIUM';

function fail(reason: string): BuildCheck {
  return { ok: false, reason };
}

function inCell(x: number, y: number, col: number, row: number): boolean {
  return Math.floor(x / TILE) === col && Math.floor(y / TILE) === row;
}

export function getTowerAt(world: World, col: number, row: number): Tower | null {
  const cell = getCell(world.grid, col, row);
  if (!cell || cell.towerId === null) return null;
  const id = cell.towerId;
  for (const t of world.towers) if (t.id === id) return t;
  return null;
}

/** Validates terrain, rocks, units, base margin and money (everything except path-blocking). */
export function canBuildBasic(world: World, team: Team, kind: TowerKind, col: number, row: number): BuildCheck {
  const grid = world.grid;
  if (!inBounds(grid, col, row)) return fail('OUT OF BOUNDS');
  const cell = getCell(grid, col, row)!;
  if (cell.type === 'rock') return fail('BLOCKED TERRAIN');
  if (cell.type === 'base' || isNearBase(col, row)) return fail('TOO CLOSE TO BASE');
  if (cell.towerId !== null) return fail('OCCUPIED');
  for (const rock of world.rocks) {
    if (!rock.alive) continue;
    if (rock.state === 'landed' && inCell(rock.x, rock.y, col, row)) return fail('THORIUM HERE');
    if (rock.state === 'falling' && inCell(rock.targetX, rock.targetY, col, row)) return fail('THORIUM HERE');
  }
  for (const u of world.units) {
    if (!u.alive) continue;
    if (inCell(u.x, u.y, col, row)) return fail('UNIT IN THE WAY');
    const next = u.path[u.pathIndex];
    if (next && next.col === col && next.row === row) return fail('UNIT IN THE WAY');
  }
  if (world.players[team].money < towerStats(kind, 0).cost) return fail(NO_MONEY);
  return { ok: true, reason: '' };
}

/** Validates terrain, rocks, units, base margin, money and path-blocking. */
export function canBuild(world: World, team: Team, kind: TowerKind, col: number, row: number): BuildCheck {
  const basic = canBuildBasic(world, team, kind, col, row);
  if (!basic.ok) return basic;
  if (wouldBlockPaths(world, col, row)) return fail('WOULD BLOCK PATH');
  return basic;
}

const extraCell = new Set<number>();

/**
 * True if placing a tower at (col,row) would cut every route for any spawn or live unit.
 * One flood fill per goal base; equivalent to running A* from every spawn / unit cell.
 */
export function wouldBlockPaths(world: World, col: number, row: number): boolean {
  const grid = world.grid;
  if (!inBounds(grid, col, row)) return false;
  extraCell.clear();
  extraCell.add(cellIndex(grid, col, row));
  for (let t = 0; t < 2; t++) {
    const team = t as Team;
    const reach = floodFromGoal(grid, otherTeam(team), extraCell);
    for (const s of getSpawnCells(team)) {
      if (inBounds(grid, s.col, s.row) && !floodReaches(grid, reach, s)) return true;
    }
    for (const u of world.units) {
      if (!u.alive || u.team !== team) continue;
      const c = pixelToCell(u.x, u.y);
      if (inBounds(grid, c.col, c.row) && !floodReaches(grid, reach, c)) return true;
    }
  }
  return false;
}

function reject(world: World, team: Team, reason: string, col: number, row: number): void {
  world.players[team].cursor.failFlash = 0.4;
  if (reason === NO_MONEY) world.events.push({ type: 'notEnoughMoney', team });
  else world.events.push({ type: 'buildFail', team, reason, col, row });
}

export function tryBuild(world: World, team: Team, kind: TowerKind, col: number, row: number): boolean {
  const check = canBuild(world, team, kind, col, row);
  if (!check.ok) {
    reject(world, team, check.reason, col, row);
    return false;
  }
  world.players[team].money -= towerStats(kind, 0).cost;
  const tower = createTower(world, team, kind, col, row);
  world.towers.push(tower);
  setTowerAt(world.grid, col, row, tower.id);
  world.events.push({ type: 'build', team, kind, x: tower.x, y: tower.y });
  return true;
}

export function tryUpgrade(world: World, team: Team, col: number, row: number): boolean {
  const tower = getTowerAt(world, col, row);
  if (!tower) {
    reject(world, team, 'NO TOWER', col, row);
    return false;
  }
  if (tower.team !== team) {
    reject(world, team, 'NOT YOUR TOWER', col, row);
    return false;
  }
  const cost = upgradeCost(tower.kind, tower.level);
  if (cost === null) {
    reject(world, team, 'MAX LEVEL', col, row);
    return false;
  }
  const player = world.players[team];
  if (player.money < cost) {
    reject(world, team, NO_MONEY, col, row);
    return false;
  }
  player.money -= cost;
  tower.level = (tower.level + 1) as 1 | 2;
  tower.totalSpent += cost;
  world.events.push({ type: 'upgrade', team, kind: tower.kind, level: tower.level, x: tower.x, y: tower.y });
  return true;
}

export function trySell(world: World, team: Team, col: number, row: number): boolean {
  const tower = getTowerAt(world, col, row);
  if (!tower) {
    reject(world, team, 'NO TOWER', col, row);
    return false;
  }
  if (tower.team !== team) {
    reject(world, team, 'NOT YOUR TOWER', col, row);
    return false;
  }
  const refund = Math.floor(tower.totalSpent * SELL_REFUND);
  world.players[team].money += refund;
  setTowerAt(world.grid, col, row, null);
  world.towers = world.towers.filter((t) => t !== tower);
  if (tower.kind === 'refinery') {
    for (const rock of world.rocks) {
      if (!rock.alive || rock.magnetTowerId !== tower.id) continue;
      rock.state = 'landed';
      rock.magnetTowerId = null;
      rock.carriedBy = null;
      rock.x = tower.x;
      rock.y = tower.y;
      rock.targetX = tower.x;
      rock.targetY = tower.y;
    }
    tower.refineQueue.length = 0;
    tower.refineProgress = 0;
  }
  world.events.push({ type: 'sell', team, refund, x: tower.x, y: tower.y });
  return true;
}
