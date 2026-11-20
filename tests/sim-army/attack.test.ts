import { describe, expect, it } from 'vitest';
import type { Intent, SimEvent } from '@/types';
import { TICK_DT } from '@/config/constants';
import { createPipeline, createSim, registryVersion } from '@/sim/core';
import { launchBatch, registerArmySystems } from '@/sim/army';
import { arena, opts, run, tick } from './helpers';

const select = (kind: 'scout' | null): Intent => ({ t: 'attackSelect', player: 0, kind });

describe('attack menu', () => {
  it('releases only while selected; null stops an unlocked attack', () => {
    const w = arena(40, 6);
    w.players[0].stored.scout = 100;
    tick(w, [], [select('scout')]);
    run(w, 0.5);
    const launched = w.units.length;
    expect(launched).toBeGreaterThan(3);
    tick(w, [], [select(null)]);
    const stopped = w.units.length;
    run(w, 0.5);
    expect(w.units.length).toBe(stopped);
    expect(w.players[0].attack.selected).toBeNull();
    expect(w.players[0].stored.scout).toBe(100 - stopped);
  });

  it('a locked attack keeps releasing until unlocked', () => {
    const w = arena(40, 6);
    w.players[0].stored.scout = 100;
    const events: SimEvent[] = [];
    tick(w, events, [select('scout'), { t: 'attackLock', player: 0, locked: true }]);
    tick(w, events, [select(null)]);
    expect(w.players[0].attack.selected).toBe('scout');
    run(w, 1);
    const n = w.units.length;
    expect(n).toBeGreaterThan(5);
    tick(w, events, [{ t: 'attackLock', player: 0, locked: false }]);
    expect(w.players[0].attack.selected).toBeNull();
    run(w, 0.5);
    expect(w.units.length).toBe(n);
    expect(events.filter((e) => e.t === 'attackLocked').map((e) => (e.t === 'attackLocked' ? e.locked : null))).toEqual([true, false]);
  });

  it('cycleTarget visits living enemy-team players only', () => {
    const slots = [
      { id: 0 as const, team: 0, controller: 'human' as const },
      { id: 1 as const, team: 1, controller: 'adaptive' as const },
      { id: 2 as const, team: 0, controller: 'human' as const },
      { id: 3 as const, team: 2, controller: 'adaptive' as const },
    ];
    const w = arena(24, 10, {}, slots);
    const cycle = (player: 0 | 1 | 2 | 3): number => {
      tick(w, [], [{ t: 'cycleTarget', player }]);
      return w.players[player].attack.targetPlayer;
    };
    expect(w.players[0].attack.targetPlayer).toBe(1);
    expect([cycle(0), cycle(0), cycle(0)]).toEqual([3, 1, 3]);
    expect([cycle(1), cycle(1), cycle(1), cycle(1)]).toEqual([2, 3, 0, 2]);
    w.players[3].alive = false;
    expect([cycle(0), cycle(0)]).toEqual([1, 1]);
  });

  it('launchBatch queues a whole wave that leaves single-file', () => {
    const w = arena(40, 6);
    w.players[0].stored.tank = 5;
    expect(launchBatch(w, 0, 'tank', 50)).toBe(5);
    expect(w.players[0].stored.tank).toBe(0);
    run(w, 1);
    const xs = w.units.map((u) => u.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeLessThanOrEqual(xs[i - 1] + 1e-9);
    expect(xs[0]).toBeGreaterThan(xs[4]);
  });
});

describe('registration', () => {
  it('registerArmySystems is idempotent and drives a full sim', () => {
    registerArmySystems();
    const v = registryVersion();
    registerArmySystems();
    expect(registryVersion()).toBe(v);
    const names = createPipeline().map((s) => s.name);
    for (const n of ['army.production', 'army.launch', 'army.march']) {
      expect(names.filter((x) => x === n)).toHaveLength(1);
    }
    expect(names.indexOf('army.production')).toBeLessThan(names.indexOf('army.launch'));
    expect(names.indexOf('army.launch')).toBeLessThan(names.indexOf('army.march'));

    const sim = createSim(opts());
    const p = sim.world.players[0];
    sim.world.players[0].stored.scout = 20;
    sim.step([{ t: 'attackSelect', player: 0, kind: 'scout' }]);
    for (let i = 0; i < 90; i++) sim.step([]);
    expect(sim.world.units.length).toBeGreaterThan(5);
    expect(p.stored.scout ?? 0).toBeLessThan(20);
    expect(sim.drainEvents().some((e) => e.t === 'unitLaunched')).toBe(true);
    expect(sim.world.timeSec).toBeCloseTo(91 * TICK_DT, 6);
  });
});
