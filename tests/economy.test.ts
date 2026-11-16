import { describe, expect, it } from 'vitest';
import type { World } from '../src/types';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { UNIT_DEFS } from '../src/data/units';
import { TILE, WAVE_INCOME } from '../src/core/config';
import { createTower } from '../src/entities/Tower';
import { createUnit } from '../src/entities/Unit';
import { createRock } from '../src/entities/ThoriumRock';
import { setTowerAt } from '../src/systems/Grid';
import { queueUnit, updateWaves } from '../src/systems/WaveSystem';
import { updateEconomy } from '../src/systems/EconomySystem';
import { damageUnit } from '../src/systems/CombatSystem';

function newWorld(): World {
  return createWorld('versus', VERSUS_LEVEL, 123);
}

describe('waves', () => {
  it('queueUnit deducts money and rejects when broke', () => {
    const w = newWorld();
    w.players[0].money = 40;
    expect(queueUnit(w, 0, 'scout')).toBe(true);
    expect(w.players[0].money).toBe(40 - UNIT_DEFS.scout.cost);
    expect(w.players[0].queue).toEqual(['scout']);
    expect(w.events.some((e) => e.type === 'unitQueued')).toBe(true);

    expect(queueUnit(w, 0, 'tank')).toBe(false);
    expect(w.players[0].money).toBe(40 - UNIT_DEFS.scout.cost);
    expect(w.players[0].queue).toEqual(['scout']);
    expect(w.events.some((e) => e.type === 'notEnoughMoney' && e.team === 0)).toBe(true);
    expect(w.players[0].cursor.failFlash).toBeGreaterThan(0);
  });

  it('launching a wave moves queues into staggered spawns and pays income', () => {
    const w = newWorld();
    queueUnit(w, 0, 'scout');
    queueUnit(w, 0, 'scout');
    queueUnit(w, 1, 'tank');
    const money0 = w.players[0].money;
    const money1 = w.players[1].money;
    w.waveTimer = 0.001;
    updateWaves(w, 0.01);

    expect(w.waveNumber).toBe(1);
    expect(w.waveTimer).toBeCloseTo(VERSUS_LEVEL.waveInterval);
    expect(w.players[0].queue).toHaveLength(0);
    expect(w.players[1].queue).toHaveLength(0);
    expect(w.players[0].money).toBe(money0 + WAVE_INCOME);
    expect(w.players[1].money).toBe(money1 + WAVE_INCOME);
    const launched = w.events.find((e) => e.type === 'waveLaunched');
    expect(launched).toEqual({ type: 'waveLaunched', wave: 1, counts: [2, 1] });
    // First unit of each team spawns immediately, the rest are staggered.
    expect(w.units).toHaveLength(2);
    expect(w.pendingSpawns).toHaveLength(1);

    for (let i = 0; i < 60; i++) updateWaves(w, 1 / 60);
    expect(w.units).toHaveLength(3);
    expect(w.pendingSpawns).toHaveLength(0);
    expect(w.players[0].stats.unitsSent).toBe(2);
  });
});

describe('refinery', () => {
  it('magnet pulls a landed rock in and pays money', () => {
    const w = newWorld();
    const col = 15;
    const row = 3;
    const tower = createTower(w, 0, 'refinery', col, row);
    tower.buildAnim = 1;
    w.towers.push(tower);
    setTowerAt(w.grid, col, row, tower.id);

    const rock = createRock(w, tower.x + TILE * 1.5, tower.y);
    rock.state = 'landed';
    rock.x = rock.targetX;
    rock.y = rock.targetY;
    w.rocks.push(rock);

    const before = w.players[0].money;
    updateEconomy(w, 1 / 60);
    expect(rock.state).toBe('magnet');
    expect(rock.magnetTowerId).toBe(tower.id);

    for (let i = 0; i < 60 * 5 && w.rocks.length > 0; i++) updateEconomy(w, 1 / 60);

    expect(w.rocks).toHaveLength(0);
    expect(w.players[0].money).toBe(before + rock.value);
    expect(w.players[0].stats.rocksRefined).toBe(1);
    expect(w.players[1].money).toBe(VERSUS_LEVEL.aiStartMoney);
    expect(w.events.some((e) => e.type === 'rockRefined' && e.team === 0)).toBe(true);
  });

  it('snatches a rock carried by its own team but not by the enemy', () => {
    const w = newWorld();
    const tower = createTower(w, 0, 'refinery', 15, 3);
    w.towers.push(tower);
    setTowerAt(w.grid, 15, 3, tower.id);
    const rock = createRock(w, tower.x + TILE, tower.y);
    rock.x = rock.targetX;
    rock.y = rock.targetY;
    rock.state = 'carried';
    rock.carriedBy = 1;
    w.players[1].cursor.x = rock.x;
    w.players[1].cursor.y = rock.y;
    w.players[1].cursor.carryingRockId = rock.id;
    w.rocks.push(rock);

    updateEconomy(w, 1 / 60);
    expect(rock.state).toBe('carried');

    rock.carriedBy = 0;
    w.players[1].cursor.carryingRockId = null;
    w.players[0].cursor.x = rock.x;
    w.players[0].cursor.y = rock.y;
    w.players[0].cursor.carryingRockId = rock.id;
    updateEconomy(w, 1 / 60);
    expect(rock.state).toBe('magnet');
    expect(w.players[0].cursor.carryingRockId).toBeNull();
  });
});

describe('damageUnit', () => {
  it('lasers deal reduced damage to shields and overflow converts back to hp', () => {
    const w = newWorld();
    const u = createUnit(w, 1, 'shielded', 400, 300);
    w.units.push(u);
    const mult = UNIT_DEFS.shielded.shieldLaserMult; // 0.5
    const shield = u.shield; // 90

    damageUnit(w, u, 20, 'laser', 0);
    expect(u.shield).toBeCloseTo(shield - 20 * mult);
    expect(u.hp).toBe(u.maxHp);
    expect(u.sinceDamage).toBe(0);

    // Remaining shield 80 absorbs 160 laser damage; 40 overflows to hp.
    damageUnit(w, u, 200, 'laser', 0);
    expect(u.shield).toBe(0);
    expect(u.hp).toBeCloseTo(u.maxHp - 40);
    expect(u.alive).toBe(true);
  });

  it('non-laser damage hits shields at full strength', () => {
    const w = newWorld();
    const u = createUnit(w, 1, 'shielded', 400, 300);
    damageUnit(w, u, 30, 'cannon', 0);
    expect(u.shield).toBe(u.maxShield - 30);
  });

  it('a kill pays the bounty to the attacker', () => {
    const w = newWorld();
    const u = createUnit(w, 1, 'scout', 400, 300);
    w.units.push(u);
    const before = w.players[0].money;
    damageUnit(w, u, 1000, 'cannon', 0);
    expect(u.alive).toBe(false);
    expect(w.players[0].money).toBe(before + UNIT_DEFS.scout.bounty);
    expect(w.players[0].stats.kills).toBe(1);
    expect(w.events.some((e) => e.type === 'unitKilled' && e.killerTeam === 0)).toBe(true);

    damageUnit(w, u, 1000, 'cannon', 0);
    expect(w.players[0].money).toBe(before + UNIT_DEFS.scout.bounty);
  });
});
