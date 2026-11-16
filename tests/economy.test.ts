import { describe, expect, it } from 'vitest';
import type { World } from '../src/types';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { RESEARCH_DEFS, UNIT_DEFS } from '../src/data/units';
import { MAX_QUEUE, PASSIVE_INCOME, PASSIVE_RESEARCH, RESEARCH_PER_REFINE, SPAWN_STAGGER, TILE } from '../src/core/config';
import { createTower } from '../src/entities/Tower';
import { createUnit } from '../src/entities/Unit';
import { createLandedRock, createRock } from '../src/entities/ThoriumRock';
import { setTowerAt } from '../src/systems/Grid';
import { launchWave, queueUnit, updateWaves } from '../src/systems/WaveSystem';
import { tryResearch, updateEconomy } from '../src/systems/EconomySystem';
import { damageUnit } from '../src/systems/CombatSystem';

const DT = 1 / 60;

function newWorld(): World {
  const w = createWorld('versus', VERSUS_LEVEL, 123);
  for (const cell of w.grid.cells) if (cell.type === 'rock') cell.type = 'empty';
  return w;
}

function addRefinery(w: World, col: number, row: number) {
  const tower = createTower(w, 0, 'refinery', col, row);
  tower.buildAnim = 1;
  w.towers.push(tower);
  setTowerAt(w.grid, col, row, tower.id);
  return tower;
}

describe('wave buffer', () => {
  it('queueUnit buys one pack, and rejects when broke or full', () => {
    const w = newWorld();
    const scout = UNIT_DEFS.scout;
    w.players[0].money = scout.packCost + 10;
    expect(queueUnit(w, 0, 'scout')).toBe(true);
    expect(w.players[0].money).toBe(10);
    expect(w.players[0].queue).toHaveLength(scout.packSize);
    expect(w.events).toContainEqual({ type: 'unitQueued', team: 0, kind: 'scout', count: scout.packSize });

    expect(queueUnit(w, 0, 'tank')).toBe(false);
    expect(w.players[0].queue).toHaveLength(scout.packSize);
    expect(w.events.some((e) => e.type === 'notEnoughMoney' && e.team === 0)).toBe(true);

    w.players[0].money = 100000;
    w.players[0].queue = new Array(MAX_QUEUE - scout.packSize + 1).fill('tank');
    expect(queueUnit(w, 0, 'scout')).toBe(false);
    expect(w.events.some((e) => e.type === 'buildFail' && e.reason === 'QUEUE FULL')).toBe(true);
  });

  it('launchWave turns the buffer into one single-file train on one spawn cell', () => {
    const w = newWorld();
    w.players[0].money = 1000;
    expect(launchWave(w, 0)).toBe(false);
    queueUnit(w, 0, 'scout');
    queueUnit(w, 0, 'tank');
    const n = UNIT_DEFS.scout.packSize + UNIT_DEFS.tank.packSize;

    expect(launchWave(w, 0)).toBe(true);
    expect(w.players[0].queue).toHaveLength(0);
    expect(w.waveNumber).toBe(1);
    expect(w.players[0].stats.launches).toBe(1);
    expect(w.events).toContainEqual({ type: 'waveLaunched', team: 0, count: n });
    expect(w.pendingSpawns.map((p) => p.trainIndex)).toEqual([...Array(n).keys()]);
    expect(w.pendingSpawns[1]!.delay).toBeCloseTo(SPAWN_STAGGER);

    for (let i = 0; i < 120; i++) updateWaves(w, DT);
    expect(w.pendingSpawns).toHaveLength(0);
    expect(w.units).toHaveLength(n);
    expect(w.players[0].stats.unitsSent).toBe(n);
    const spawnCols = w.players[0].spawnCells.map((c) => c.col * TILE + TILE / 2);
    expect(spawnCols).toContain(w.units[0]!.x);
    // Every unit sits exactly on the same spawn cell center (no jitter), kinds in buffer order.
    for (const u of w.units) {
      expect(u.x).toBe(w.units[0]!.x);
      expect(u.y).toBe(w.units[0]!.y);
    }
    expect(w.units.map((u) => u.kind)).toEqual(w.units.map((_, i) => (i < UNIT_DEFS.scout.packSize ? 'scout' : 'tank')));
  });
});

describe('passive income and research', () => {
  it('pays PASSIVE_INCOME money and PASSIVE_RESEARCH energy per second without texts', () => {
    const w = newWorld();
    const m0 = w.players[0].money;
    for (let i = 0; i < 60; i++) updateEconomy(w, DT);
    expect(w.players[0].money).toBe(m0 + PASSIVE_INCOME);
    expect(w.players[0].research).toBeCloseTo(PASSIVE_RESEARCH, 5);
    expect(w.texts).toHaveLength(0);
  });

  it('tryResearch spends energy once and gates', () => {
    const w = newWorld();
    expect(tryResearch(w, 0, 'swarmSpeed')).toBe(false);
    expect(w.events.some((e) => e.type === 'buildFail' && e.reason === 'NEED RESEARCH ENERGY')).toBe(true);

    const slow = createUnit(w, 0, 'scout', 0, 0, 0, 0, 0);
    w.players[0].research = RESEARCH_DEFS.swarmSpeed.cost + 5;
    expect(tryResearch(w, 0, 'swarmSpeed')).toBe(true);
    expect(w.players[0].research).toBe(5);
    expect(w.players[0].researched.swarmSpeed).toBe(true);
    expect(w.events).toContainEqual({ type: 'research', team: 0, kind: 'swarmSpeed' });
    expect(createUnit(w, 0, 'scout', 0, 0, 0, 0, 0).speed).toBeGreaterThan(slow.speed);

    w.players[0].research = 10000;
    expect(tryResearch(w, 0, 'swarmSpeed')).toBe(false);
    expect(w.events.some((e) => e.type === 'buildFail' && e.reason === 'ALREADY RESEARCHED')).toBe(true);
    expect(w.players[0].research).toBe(10000);
  });
});

describe('harvest station', () => {
  it('a harvester mines a distant rock and refines it into money + research', () => {
    const w = newWorld();
    w.players[0].incomeMult = 0;
    const tower = addRefinery(w, 12, 3);
    const rock = createLandedRock(w, tower.x + TILE * 5, tower.y + TILE * 2);
    w.rocks.push(rock);
    const value = rock.value;
    const money0 = w.players[0].money;

    updateEconomy(w, DT);
    expect(w.harvesters).toHaveLength(1);
    const h = w.harvesters[0]!;
    expect(h.stationId).toBe(tower.id);
    expect(h.state).toBe('toRock');
    expect(rock.reservedBy).toBe(h.id);

    let steps = 1;
    let sawCarried = false;
    for (; steps < 60 * 10 && w.players[0].stats.rocksRefined === 0; steps++) {
      updateEconomy(w, DT);
      if (rock.state === 'carried' && rock.harvesterId === h.id) sawCarried = true;
      expect(rock.state).not.toBe('magnet');
    }
    expect(sawCarried).toBe(true);
    expect(w.players[0].stats.rocksRefined).toBe(1);
    expect(w.players[0].money).toBe(money0 + value);
    expect(w.players[0].research).toBeCloseTo(PASSIVE_RESEARCH * steps * DT + RESEARCH_PER_REFINE * value, 4);
    expect(w.events.some((e) => e.type === 'rockRefined' && e.team === 0 && e.value === value)).toBe(true);
    expect(w.rocks).toHaveLength(0);
    expect(h.state).toBe('idle');
    expect(h.cargo).toHaveLength(0);
  });

  it('selling the station releases the cargo as a landed rock', () => {
    const w = newWorld();
    const tower = addRefinery(w, 12, 3);
    const rock = createLandedRock(w, tower.x + TILE * 5, tower.y);
    w.rocks.push(rock);
    for (let i = 0; i < 300 && rock.state !== 'carried'; i++) updateEconomy(w, DT);
    expect(rock.state).toBe('carried');
    w.towers = [];
    setTowerAt(w.grid, 12, 3, null);
    updateEconomy(w, DT);
    expect(w.harvesters).toHaveLength(0);
    expect(rock.state).toBe('landed');
    expect(rock.harvesterId).toBeNull();
  });

  it('magnet pulls an unreserved landed rock, but not a reserved one', () => {
    const w = newWorld();
    w.players[0].incomeMult = 0;
    const tower = addRefinery(w, 15, 3);
    updateEconomy(w, DT);
    const h = w.harvesters[0]!;
    const reserved = createLandedRock(w, tower.x, tower.y + TILE * 1.5);
    reserved.reservedBy = h.id;
    h.targetRockId = reserved.id;
    h.state = 'toRock';
    const rock = createLandedRock(w, tower.x + TILE * 1.8, tower.y);
    w.rocks.push(reserved, rock);
    const before = w.players[0].money;
    updateEconomy(w, DT);
    expect(rock.state).toBe('magnet');
    expect(rock.magnetTowerId).toBe(tower.id);
    expect(reserved.state).toBe('landed');

    for (let i = 0; i < 60 * 5 && rock.alive; i++) updateEconomy(w, DT);
    expect(rock.alive).toBe(false);
    expect(w.players[0].money).toBeGreaterThanOrEqual(before + rock.value);
  });

  it('snatches a rock carried by its own ship but not by the enemy ship', () => {
    const w = newWorld();
    const tower = addRefinery(w, 15, 3);
    const rock = createRock(w, tower.x + TILE, tower.y);
    rock.x = rock.targetX;
    rock.y = rock.targetY;
    rock.state = 'carried';
    rock.carriedBy = 1;
    w.players[1].cursor.x = rock.x;
    w.players[1].cursor.y = rock.y;
    w.players[1].cursor.carryingRockId = rock.id;
    w.rocks.push(rock);

    updateEconomy(w, DT);
    expect(rock.state).toBe('carried');

    rock.carriedBy = 0;
    w.players[1].cursor.carryingRockId = null;
    w.players[0].cursor.x = rock.x;
    w.players[0].cursor.y = rock.y;
    w.players[0].cursor.carryingRockId = rock.id;
    updateEconomy(w, DT);
    expect(rock.state).toBe('magnet');
    expect(w.players[0].cursor.carryingRockId).toBeNull();
  });
});

describe('damageUnit', () => {
  it('lasers and plasma deal reduced damage to shields; overflow converts back to hp', () => {
    const w = newWorld();
    const u = createUnit(w, 1, 'shielded', 400, 300, 10, 7, 0);
    w.units.push(u);
    const mult = UNIT_DEFS.shielded.shieldLaserMult;
    const shield = u.shield;

    damageUnit(w, u, 20, 'laser', 0);
    expect(u.shield).toBeCloseTo(shield - 20 * mult);
    damageUnit(w, u, 20, 'plasma', 0);
    expect(u.shield).toBeCloseTo(shield - 40 * mult);
    expect(u.hp).toBe(u.maxHp);

    const left = u.shield;
    damageUnit(w, u, left / mult + 10, 'laser', 0);
    expect(u.shield).toBe(0);
    expect(u.hp).toBeCloseTo(u.maxHp - 10);
  });

  it('a kill pays the bounty once', () => {
    const w = newWorld();
    const u = createUnit(w, 1, 'scout', 400, 300, 10, 7, 0);
    w.units.push(u);
    const before = w.players[0].money;
    damageUnit(w, u, 1000, 'cannon', 0);
    damageUnit(w, u, 1000, 'cannon', 0);
    expect(u.alive).toBe(false);
    expect(w.players[0].money).toBe(before + UNIT_DEFS.scout.bounty);
    expect(w.players[0].stats.kills).toBe(1);
    expect(w.events.filter((e) => e.type === 'unitKilled')).toHaveLength(1);
  });
});
