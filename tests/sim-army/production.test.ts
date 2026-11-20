import { describe, expect, it } from 'vitest';
import type { SimEvent } from '@/types';
import { STORAGE_CAP } from '@/config/constants';
import { addStructure } from '@/sim/core';
import { pipCounts, spawnInterval, storedTotal, unitCounts } from '@/sim/army';
import { arena, run } from './helpers';

function tower(w: ReturnType<typeof arena>, level: number, output: 'scout' | 'tank' | null, tx = 4) {
  return addStructure(w, { kind: 'basicOps', owner: 0, tx, ty: 5, level, output, hp: 200 });
}

describe('production', () => {
  it('spawns at spawnSeconds / spawnMult[level]', () => {
    for (const level of [0, 3]) {
      const w = arena();
      const s = tower(w, level, 'tank');
      const expected = 10 / spawnInterval(w, s);
      run(w, 10);
      expect(Math.abs((w.players[0].stored.tank ?? 0) - expected)).toBeLessThanOrEqual(1.5);
    }
    const slow = arena();
    expect(spawnInterval(slow, tower(slow, 0, 'tank'))).toBeCloseTo(2, 6);
    const fast = arena();
    expect(spawnInterval(fast, tower(fast, 3, 'tank'))).toBeCloseTo(2 / 2.3, 6);
  });

  it('defaults a Basic Ops tower to scouts', () => {
    const w = arena();
    tower(w, 0, null);
    run(w, 3);
    expect(w.players[0].stored.scout).toBeGreaterThanOrEqual(3);
  });

  it('runs 8x faster in timed-battle overtime', () => {
    const normal = arena();
    tower(normal, 0, 'tank');
    run(normal, 10);
    const over = arena(24, 10, { timeLimitSec: 1 });
    over.tick = 120;
    over.timeSec = 2;
    const s = tower(over, 0, 'tank');
    expect(spawnInterval(over, s)).toBeCloseTo(2 / 8, 6);
    run(over, 10);
    expect(over.players[0].stored.tank).toBeGreaterThanOrEqual(39);
    expect(over.players[0].stored.tank).toBeGreaterThanOrEqual(7 * (normal.players[0].stored.tank ?? 0));
  });
});

describe('storage', () => {
  it('caps stored units at STORAGE_CAP and pauses production when full', () => {
    const w = arena();
    w.players[0].stored.scout = STORAGE_CAP - 5;
    w.players[0].stored.tank = 0;
    tower(w, 0, 'scout');
    tower(w, 0, 'scout', 6);
    const events: SimEvent[] = [];
    run(w, 8, events);
    expect(storedTotal(w.players[0])).toBe(STORAGE_CAP);
    expect(events.filter((e) => e.t === 'unitSpawned')).toHaveLength(5);
    w.players[0].stored.scout = STORAGE_CAP - 3;
    run(w, 0.1, events);
    expect(storedTotal(w.players[0])).toBeLessThanOrEqual(STORAGE_CAP);
    expect(storedTotal(w.players[0])).toBeGreaterThan(STORAGE_CAP - 3);
  });

  it('counts units and pips for the HUD', () => {
    const w = arena();
    w.players[0].stored.scout = 123;
    w.players[0].stored.tank = 7;
    const c = unitCounts(w, 0);
    expect(c.scout).toBe(123);
    expect(c.tank).toBe(7);
    expect(c.dragon).toBe(0);
    expect(pipCounts(123)).toEqual({ white: 3, blue: 2, red: 1 });
    expect(pipCounts(1000)).toEqual({ white: 0, blue: 0, red: 10 });
    expect(pipCounts(0)).toEqual({ white: 0, blue: 0, red: 0 });
  });
});
