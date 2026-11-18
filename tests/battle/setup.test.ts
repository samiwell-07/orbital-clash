import { describe, expect, it } from 'vitest';
import { createWorld } from '@/sim/core/worldFactory';
import { isOvertime, overtimeMult } from '@/sim/core/victory';
import { findMap } from '@/sim/core/defaultMap';
import type { World } from '@/types';
import {
  BattleSetupError, battleBonusSystem, battleClock, battleInitSystem, scaleHits, scaleThorium, startBattle,
  validateBattleSetup, type BattleSetup,
} from '@/sim/modes/battle';
import { battleWorld } from './harness';

const MAP = 'battle-kreios-crater';
const duel: BattleSetup = {
  mapId: MAP,
  players: [
    { id: 0, team: 0, controller: 'human' },
    { id: 1, team: 1, controller: 'adaptive' },
  ],
};

describe('setup validation', () => {
  it('accepts a plain duel and produces battle options', () => {
    const o = startBattle({ ...duel, maxHits: 40, thoriumRate: 1.5, timeLimitSec: 300, difficulty: 'expert', seed: 9 });
    expect(o.settings).toMatchObject({ mode: 'battle', maxHits: 40, thoriumRate: 1.5, timeLimitSec: 300, difficulty: 'expert', seed: 9, mission: null, comet: 'kreios' });
    expect(o.slots).toEqual([
      { id: 0, team: 0, controller: 'human' },
      { id: 1, team: 1, controller: 'adaptive' },
    ]);
    expect(o.mapId).toBe(MAP);
  });

  it('refuses fewer than 2 players, a single team and bad numbers with explicit errors', () => {
    expect(validateBattleSetup({ ...duel, players: [duel.players[0]] }).join()).toMatch(/at least 2 players/);
    const allied = { ...duel, players: duel.players.map((p) => ({ ...p, team: 3 })) };
    expect(validateBattleSetup(allied).join()).toMatch(/at least 2 teams/);
    expect(validateBattleSetup({ ...duel, maxHits: 0 }).join()).toMatch(/maxHits/);
    expect(validateBattleSetup({ ...duel, maxHits: 101 }).join()).toMatch(/maxHits/);
    expect(validateBattleSetup({ ...duel, thoriumRate: 0.4 }).join()).toMatch(/thoriumRate/);
    expect(validateBattleSetup({ ...duel, thoriumRate: 2.1 }).join()).toMatch(/thoriumRate/);
    expect(validateBattleSetup({ ...duel, timeLimitSec: -1 }).join()).toMatch(/timeLimitSec/);
    expect(validateBattleSetup({ ...duel, mapId: 'nope' }).join()).toMatch(/unknown battle map/);
    expect(validateBattleSetup({ ...duel, players: [duel.players[0], { ...duel.players[0] }] }).join()).toMatch(/duplicate player id/);
    expect(() => startBattle({ ...duel, maxHits: 500 })).toThrow(BattleSetupError);
  });

  it('respects the number of start slots of the map', () => {
    const three = { mapId: 'battle-aether-drift', players: [0, 1, 2].map((i) => ({ id: i as 0, team: i, controller: 'adaptive' as const })) };
    expect(validateBattleSetup(three).join()).toMatch(/only 2 start slots/);
  });

  it('allows team games: 2v2, 3v1 and 2v1', () => {
    const mk = (teams: number[]): BattleSetup => ({
      mapId: MAP,
      players: teams.map((team, i) => ({ id: i as 0, team, controller: 'adaptive' as const })),
    });
    for (const teams of [[0, 0, 1, 1], [0, 0, 0, 1], [0, 0, 1]]) expect(validateBattleSetup(mk(teams))).toEqual([]);
    const w = createWorld(startBattle(mk([0, 0, 1, 1])));
    expect(w.players.map((p) => p.team)).toEqual([0, 0, 1, 1]);
    expect(w.players[0].attack.targetPlayer).toBe(2);
  });

  it('free base option strips preset start tiles so players use buildBase', () => {
    const o = startBattle({ ...duel, freeBase: true });
    expect(o.mapId).toBe(MAP + ':free');
    expect(findMap(o.mapId!)?.baseTiles.every((t) => t === null)).toBe(true);
    const w = createWorld(o);
    expect(w.players[0].baseBuilt).toBe(false);
    const preset = createWorld(startBattle(duel));
    expect(preset.players[0].baseBuilt).toBe(true);
  });
});

describe('strength scaling', () => {
  it('50 % of 100 hits / 1000 thorium is 50 / 500', () => {
    expect(scaleHits(100, 0.5)).toBe(50);
    expect(scaleThorium(1000, 0.5)).toBe(500);
    expect(scaleHits(100, 1)).toBe(100);
    expect(scaleHits(10, 0)).toBe(1);
  });

  it('applies per player at tick 0 and only once', () => {
    const { w } = battleWorld({
      maxHits: 100,
      players: [
        { id: 0, team: 0, controller: 'adaptive', strength: 0.5 },
        { id: 1, team: 1, controller: 'adaptive', strength: 1 },
      ],
    });
    expect([w.players[0].maxHits, w.players[0].thorium]).toEqual([50, 500]);
    expect([w.players[1].maxHits, w.players[1].thorium]).toEqual([100, 1000]);
    expect(w.players[0].tech.laser).toBe(true);
    w.players[0].thorium = 5;
    battleInitSystem(w, 0, () => {});
    expect(w.players[0].thorium).toBe(5);
  });
});

describe('timed battle', () => {
  it('flags overtime at 8x spawning when the clock reaches 0', () => {
    const { w } = battleWorld({ timeLimitSec: 120 });
    w.timeSec = 119;
    expect(isOvertime(w)).toBe(false);
    expect(battleClock(w)).toMatchObject({ overtime: false, spawnMult: 1 });
    w.timeSec = 120;
    expect(isOvertime(w)).toBe(true);
    expect(overtimeMult(w)).toBe(8);
    expect(battleClock(w)).toMatchObject({ overtime: true, spawnMult: 8, timeLeftSec: 0 });
  });

  it('never goes into overtime when untimed', () => {
    const { w } = battleWorld({ timeLimitSec: 0 });
    w.timeSec = 99999;
    expect(battleClock(w)).toEqual({ timeLeftSec: null, overtime: false, spawnMult: 1 });
  });
});

describe('base-kill bonus', () => {
  const kill = (w: World, attacker: 0 | 1 | 2 | 3, target: 0 | 1 | 2 | 3): void => {
    w.events.push({ t: 'baseDestroyed', target, attacker });
    battleBonusSystem(w, 0, (e) => w.events.push(e));
  };

  it('pays the attacker once per destroyed base', () => {
    const { w } = battleWorld();
    const before = w.players[0].thorium;
    kill(w, 0, 1);
    kill(w, 0, 1);
    expect(w.players[0].thorium).toBe(before + 250);
    expect(w.players[0].stats.thoriumEarned).toBe(250);
  });

  it('pays nothing for allies or unknown killers', () => {
    const { w } = battleWorld({
      players: [
        { id: 0, team: 0, controller: 'adaptive' },
        { id: 1, team: 0, controller: 'adaptive' },
        { id: 2, team: 1, controller: 'adaptive' },
      ],
    });
    const before = w.players[0].thorium;
    kill(w, 0, 1);
    w.events.push({ t: 'baseDestroyed', target: 2, attacker: -1 });
    battleBonusSystem(w, 0, () => {});
    expect(w.players[0].thorium).toBe(before);
  });
});
