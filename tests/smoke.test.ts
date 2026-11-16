import { describe, expect, it } from 'vitest';
import type { Team, UnitKind, World } from '../src/types';
import { COLS, ROWS, SIM_DT } from '../src/core/config';
import { createWorld } from '../src/core/World';
import { VERSUS_LEVEL } from '../src/data/levels';
import { TOWER_KINDS } from '../src/data/towers';
import { UNIT_KINDS } from '../src/data/units';
import { tryBuild } from '../src/systems/BuildSystem';
import { seedInitialDeposits, updateMeteors } from '../src/systems/MeteorSystem';
import { launchWave, queueUnit, updateWaves } from '../src/systems/WaveSystem';
import { updateMovement } from '../src/systems/MovementSystem';
import { updateCombat } from '../src/systems/CombatSystem';
import { updateEconomy } from '../src/systems/EconomySystem';
import { updateEffects } from '../src/systems/ParticleSystem';

/** Deterministic scripted player: builds a tower, buys a pack, launches, on a fixed rhythm. */
function scriptedStep(world: World, team: Team, step: number): void {
  world.players[team].money += 5;
  if (step % 30 === 0) {
    const n = step / 30;
    const kind = TOWER_KINDS[n % TOWER_KINDS.length] ?? 'laser';
    const col = team === 0 ? 4 + (n % 4) : COLS - 5 - (n % 4);
    const row = 2 + ((n * 5) % (ROWS - 4));
    tryBuild(world, team, kind, col, row);
  }
  if (step % 20 === 0) {
    const kind: UnitKind = UNIT_KINDS[(step / 20) % UNIT_KINDS.length] ?? 'scout';
    queueUnit(world, team, kind);
  }
  if (step % 120 === 60) launchWave(world, team);
}

describe('smoke: full simulation', () => {
  it('runs 600 steps of all systems with two scripted players', () => {
    const world = createWorld('versus', VERSUS_LEVEL, 12345);
    seedInitialDeposits(world);
    expect(world.rocks.length).toBeGreaterThan(0);

    let maxUnits = 0;
    for (let step = 0; step < 600; step++) {
      scriptedStep(world, 0, step);
      scriptedStep(world, 1, step);
      updateMeteors(world, SIM_DT);
      updateWaves(world, SIM_DT);
      updateMovement(world, SIM_DT);
      updateCombat(world, SIM_DT);
      updateEconomy(world, SIM_DT);
      updateEffects(world, SIM_DT);
      world.time += SIM_DT;
      world.events.length = 0;
      maxUnits = Math.max(maxUnits, world.units.length);
    }

    expect(world.time).toBeCloseTo(600 * SIM_DT, 5);
    expect(world.towers.length).toBeGreaterThan(0);
    expect(world.players[0].stats.launches).toBeGreaterThan(0);
    expect(world.players[1].stats.launches).toBeGreaterThan(0);
    expect(maxUnits).toBeGreaterThan(0);
    for (const base of world.bases) {
      expect(Number.isFinite(base.hp)).toBe(true);
      expect(base.hp).toBeGreaterThanOrEqual(0);
      expect(base.hp).toBeLessThanOrEqual(base.maxHp);
    }
    for (const u of world.units) {
      expect(Number.isFinite(u.x) && Number.isFinite(u.y)).toBe(true);
    }
  });
});
