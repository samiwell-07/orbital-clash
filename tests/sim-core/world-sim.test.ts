import { describe, expect, it } from 'vitest';
import type { Intent, SimEvent } from '@/types';
import { DIFFICULTY_MULT, OVERTIME_SPAWN_MULT, TICK_DT } from '@/config/constants';
import { createSim } from '@/sim/core';
import { registerIntentHandler } from '@/sim/core/intents';
import { registerSystem, unregisterSystem } from '@/sim/core/pipeline';
import { createWorld, BASE_START_THORIUM } from '@/sim/core/worldFactory';
import { generateDefaultMap } from '@/sim/core/defaultMap';
import { createGrid } from '@/sim/core/grid';
import { pathExists } from '@/sim/core/flow';
import { hitBase, overtimeMult } from '@/sim/core/victory';
import { opts } from './helpers';

describe('createWorld', () => {
  it('builds defaults for a 1v1 battle', () => {
    const w = createWorld(opts());
    expect(w.players).toHaveLength(4);
    expect(w.players[0].alive).toBe(true);
    expect(w.players[2].alive).toBe(false);
    expect(w.players[2].controller).toBe('none');
    expect(w.players[0].attack.targetPlayer).toBe(1);
    expect(w.players[1].attack.targetPlayer).toBe(0);
    expect(w.players[0].thorium).toBe(Math.round(BASE_START_THORIUM * DIFFICULTY_MULT.normal.thorium));
    expect(w.players[0].maxHits).toBe(10);
    expect(w.grid.w).toBe(w.grid.h);
    expect(w.units).toHaveLength(0);
    expect(w.nextId).toBe(1);
  });

  it('scales thorium and hits by strength and difficulty', () => {
    const w = createWorld(opts({ strength: [1, 0, 0.5, 0.5], difficulty: 'beginner' }));
    expect(w.players[0].thorium).toBeGreaterThan(w.players[1].thorium);
    expect(w.players[0].maxHits).toBe(15);
    expect(w.players[1].maxHits).toBe(5);
  });

  it('is deterministic: same options give the same rng and map', () => {
    const a = createWorld(opts());
    const b = createWorld(opts());
    expect(a.rng).toBe(b.rng);
    expect([...a.grid.terrain]).toEqual([...b.grid.terrain]);
  });

  it('default map is symmetric with connected bases', () => {
    const compact = generateDefaultMap('compact', 18, 20);
    for (const tile of compact.baseTiles) {
      if (!tile) continue;
      for (let dy = -2; dy <= 2; dy++) expect(compact.rows[tile.ty + dy].slice(tile.tx - 2, tile.tx + 3)).toBe('.....');
    }
    const m = generateDefaultMap('x');
    const g = createGrid(m);
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        expect(g.terrain[y * m.w + x] !== 0).toBe(g.terrain[y * m.w + (m.w - 1 - x)] !== 0);
      }
    }
    const w = createWorld(opts());
    const bt = m.baseTiles.map((b) => b!);
    for (const b of bt) expect(pathExists(w, bt[0], b)).toBe(true);
  });
});

describe('victory', () => {
  const twoPlayer = () => createSim(opts());

  it('destroys a base at maxHits and ends the match once', () => {
    const sim = twoPlayer();
    const w = sim.world;
    const emit = (e: SimEvent) => w.events.push(e);
    hitBase(w, 1, 0, emit, 9);
    sim.step([]);
    expect(w.players[1].alive).toBe(true);
    hitBase(w, 1, 0, emit);
    sim.step([]);
    const ev = sim.drainEvents();
    expect(w.players[1].alive).toBe(false);
    expect(w.over).toBe(true);
    expect(w.winnerTeam).toBe(0);
    expect(ev.filter((e) => e.t === 'baseDestroyed')).toEqual([{ t: 'baseDestroyed', target: 1, attacker: 0 }]);
    expect(ev.filter((e) => e.t === 'victory')).toEqual([{ t: 'victory', team: 0 }]);
    expect(ev.filter((e) => e.t === 'defeat')).toEqual([{ t: 'defeat', team: 1 }]);
    const tick = w.tick;
    sim.step([]);
    expect(w.tick).toBe(tick);
  });

  it('teams: a match continues while a teammate lives', () => {
    const sim = createSim(opts({}, [
      { id: 0, team: 0, controller: 'human' },
      { id: 1, team: 0, controller: 'human' },
      { id: 2, team: 1, controller: 'adaptive' },
    ]));
    const w = sim.world;
    w.players[2].hits = w.players[2].maxHits;
    sim.step([]);
    expect(w.over).toBe(true);
    expect(w.winnerTeam).toBe(0);
  });

  it('timed battle emits timeUp once and applies overtime multiplier', () => {
    const sim = createSim(opts({ timeLimitSec: 1 }));
    const w = sim.world;
    expect(overtimeMult(w)).toBe(1);
    const events: SimEvent[] = [];
    for (let i = 0; i < 90; i++) {
      sim.step([]);
      events.push(...sim.drainEvents());
    }
    expect(events.filter((e) => e.t === 'timeUp')).toHaveLength(1);
    expect(overtimeMult(w)).toBe(OVERTIME_SPAWN_MULT);
    expect(w.over).toBe(false);
  });
});

describe('createSim / pipeline', () => {
  it('advances tick and time, honours pause intent, drains events', () => {
    const sim = createSim(opts());
    sim.step([]);
    sim.step([]);
    expect(sim.world.tick).toBe(2);
    expect(sim.world.timeSec).toBeCloseTo(2 * TICK_DT, 9);
    sim.step([{ t: 'pause' }]);
    expect(sim.world.paused).toBe(true);
    sim.step([]);
    expect(sim.world.tick).toBe(2);
    sim.step([{ t: 'pause' }]);
    expect(sim.world.paused).toBe(false);
    expect(sim.world.tick).toBe(3);
    sim.step([]);
    expect(sim.world.tick).toBe(4);
    sim.world.events.push({ t: 'timeUp' });
    expect(sim.drainEvents()).toHaveLength(1);
    expect(sim.drainEvents()).toHaveLength(0);
  });

  it('runs registered systems in order and routes intents to handlers', () => {
    const order: string[] = [];
    registerSystem('test.late', 115, () => order.push('late'));
    registerSystem('test.early', 15, () => order.push('early'));
    const got: Intent[] = [];
    const off = registerIntentHandler((_w, i) => (i.t === 'grab' ? (got.push(i), true) : false));
    try {
      const sim = createSim(opts());
      sim.step([{ t: 'grab', player: 0 }, { t: 'drop', player: 0 }]);
      expect(order).toEqual(['early', 'late']);
      expect(got).toEqual([{ t: 'grab', player: 0 }]);
    } finally {
      off();
      unregisterSystem('test.late');
      unregisterSystem('test.early');
    }
  });
});
