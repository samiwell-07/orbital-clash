import { describe, expect, it } from 'vitest';
import type { Team, TowerKind, UnitKind, World } from '../src/types';
import { COLS, ROWS, TILE } from '../src/core/config';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { UNIT_DEFS } from '../src/data/units';
import { createTower } from '../src/entities/Tower';
import { createUnit } from '../src/entities/Unit';
import { getCell, getSpawnCells, isNearBase, setTowerAt } from '../src/systems/Grid';
import { updateFlowFields } from '../src/systems/FlowField';
import { updateMovement } from '../src/systems/MovementSystem';
import { updateCombat } from '../src/systems/CombatSystem';
import { updateEconomy } from '../src/systems/EconomySystem';
import { updateMeteors, seedInitialDeposits } from '../src/systems/MeteorSystem';
import { launchWave, queueUnit, updateWaves } from '../src/systems/WaveSystem';
import { updateEffects } from '../src/systems/ParticleSystem';

const DT = 1 / 60;
const TOWER_TARGET = 150;
const UNIT_TARGET = 300;
const STEPS = 300;

function spawnsConnected(w: World): boolean {
  updateFlowFields(w);
  for (const team of [0, 1] as Team[]) {
    for (const s of getSpawnCells(team)) if ((w.flow.dist[team][s.row * w.grid.cols + s.col] ?? -1) < 0) return false;
  }
  return true;
}

/** Sparse maze: walls on odd columns with periodic gaps first, then any other legal cell. */
function buildTowers(w: World): void {
  const kinds: TowerKind[] = ['laser', 'cannon', 'cryo', 'plasma', 'laser', 'plasma', 'refinery'];
  const candidates: [number, number][] = [];
  for (let c = 3; c < COLS - 3; c += 2) for (let r = 0; r < ROWS; r++) if (r % 4 !== 1) candidates.push([c, r]);
  for (let c = 3; c < COLS - 3; c++) for (let r = 0; r < ROWS; r++) if (c % 2 === 0 && r % 3 === 0) candidates.push([c, r]);
  let k = 0;
  for (const [col, row] of candidates) {
    if (w.towers.length >= TOWER_TARGET) break;
    const cell = getCell(w.grid, col, row);
    if (!cell || cell.type !== 'empty' || cell.towerId !== null || isNearBase(col, row)) continue;
    const team: Team = col < COLS / 2 ? 0 : 1;
    const tower = createTower(w, team, kinds[k++ % kinds.length]!, col, row);
    tower.level = (k % 3) as 0 | 1 | 2;
    setTowerAt(w.grid, col, row, tower.id);
    if (!spawnsConnected(w)) {
      setTowerAt(w.grid, col, row, null);
      continue;
    }
    w.towers.push(tower);
  }
}

function addUnits(w: World): void {
  const kinds: UnitKind[] = ['scout', 'scout', 'scout', 'shielded', 'tank', 'bomber'];
  const open: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 2; c < COLS - 2; c++) {
      if ((w.flow.dist[0][r * COLS + c] ?? -1) >= 0) open.push([c, r]);
    }
  }
  for (let i = 0; i < UNIT_TARGET; i++) {
    const team: Team = (i % 2) as Team;
    const [col, row] = open[Math.floor(w.rng() * open.length)]!;
    const u = createUnit(w, team, kinds[i % kinds.length]!, col * TILE + TILE / 2, row * TILE + TILE / 2, col, row, i);
    // Tough units so the swarm stays large for the whole run while towers keep firing.
    u.maxHp *= 40;
    u.hp = u.maxHp;
    w.units.push(u);
  }
}

describe('swarm performance', () => {
  it(`simulates ${UNIT_TARGET} units vs ${TOWER_TARGET} towers under budget`, () => {
    const w = createWorld('versus', VERSUS_LEVEL, 7);
    w.bases[0].hp = w.bases[1].hp = 1e9;
    buildTowers(w);
    updateFlowFields(w);
    seedInitialDeposits(w);
    addUnits(w);
    expect(w.towers.length).toBe(TOWER_TARGET);

    let total = 0;
    let unitSamples = 0;
    let particlesPeak = 0;
    for (let i = 0; i < STEPS; i++) {
      const t0 = performance.now();
      updateWaves(w, DT);
      updateMovement(w, DT);
      updateCombat(w, DT);
      updateEconomy(w, DT);
      updateMeteors(w, DT);
      updateEffects(w, DT);
      w.time += DT;
      w.events.length = 0;
      total += performance.now() - t0;
      unitSamples += w.units.length;
      particlesPeak = Math.max(particlesPeak, w.particles.filter((p) => p.active).length);
      for (const u of w.units) {
        expect(Number.isFinite(u.x) && Number.isFinite(u.y) && Number.isFinite(u.hp)).toBe(true);
      }
    }
    const avg = total / STEPS;
    console.log(
      `[swarm] ${w.towers.length} towers, avg ${(unitSamples / STEPS).toFixed(0)} units, ` +
        `avg step ${avg.toFixed(3)} ms, peak particles ${particlesPeak}, kills ${w.players[0].stats.kills + w.players[1].stats.kills}`,
    );
    expect(avg).toBeLessThan(4);
    expect(w.units.length).toBeGreaterThan(UNIT_TARGET / 2);
  });
});

describe('train movement', () => {
  it('a launched train follows the flow field around towers and damages the enemy base', () => {
    const w = createWorld('versus', VERSUS_LEVEL, 7);
    buildTowers(w);
    w.towers.length = 0; // keep the maze walls, but nothing shoots
    w.players[0].money = 1000;
    queueUnit(w, 0, 'scout');
    queueUnit(w, 0, 'bomber');
    launchWave(w, 0);
    const hp0 = w.bases[1].hp;
    const { scout, bomber } = UNIT_DEFS;
    const expected = hp0 - scout.packSize * scout.baseDamage - bomber.packSize * bomber.baseDamage;
    for (let i = 0; i < 60 * 120 && (w.units.length > 0 || w.pendingSpawns.length > 0); i++) {
      updateWaves(w, DT);
      updateMovement(w, DT);
      for (const u of w.units) {
        if (u.air) continue;
        const cell = getCell(w.grid, Math.floor(u.x / TILE), Math.floor(u.y / TILE));
        expect(cell?.towerId ?? null).toBeNull();
      }
    }
    expect(w.bases[1].hp).toBe(expected);
    expect(w.units).toHaveLength(0);
    expect(w.spatial.count).toBe(0);
  });
});