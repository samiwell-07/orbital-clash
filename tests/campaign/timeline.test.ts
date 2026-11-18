import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Difficulty, Mission, ScriptAction, SimEvent } from '@/types';
import { STAGE_ORDER, createSim, registerSystem } from '@/sim/core';
import { productionSystem } from '@/sim/army/production';
import {
  compile, isMissionErrored, missionErrors, setReleaseHandler, startCampaign, timelineSystem,
} from '@/sim/modes/campaign';
import { ALL_MISSIONS, getMission } from '@/data/areas';
import { registerSeed } from '@/data/areas/seeds';

registerSystem('test.production', STAGE_ORDER.production, productionSystem);

let launches: string[] = [];
beforeEach(() => {
  launches = [];
  setReleaseHandler((w, owner, kind, count) => {
    launches.push(`${w.tick}:${owner}:${kind}:${count}`);
  });
});
afterEach(() => setReleaseHandler(null));

const find = (id: string): Mission => ALL_MISSIONS.find((m) => m.id === id) as Mission;

function make(mission: Mission, difficulty: Difficulty = 'normal', seed = 7, humans = 1) {
  return createSim(startCampaign({ mission, difficulty, seed, humanPlayers: humans }));
}

function custom(id: string, timeline: [number, ScriptAction][], base = find('kreios-1')): Mission {
  registerSeed(id, { scout: 100 });
  return { ...base, id, timeline: timeline.map(([atSec, action]) => ({ atSec, player: 1, action })) };
}

function run(sim: ReturnType<typeof make>, seconds: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.step([]);
    out.push(...sim.drainEvents());
  }
  return out;
}

describe('compile', () => {
  const bad = (timeline: [number, ScriptAction][]) => compile(custom('t-bad', timeline)).errors.join('\n');

  it('rejects invalid times, tiles, tech, funds and prerequisites with explicit errors', () => {
    expect(bad([[-1, { a: 'message', text: 'x' }]])).toContain('invalid time');
    expect(bad([[Number.NaN, { a: 'message', text: 'x' }]])).toContain('invalid time');
    expect(bad([[1, { a: 'build', kind: 'turret', tx: 999, ty: 2 }]])).toContain('out of bounds');
    expect(bad([[1, { a: 'build', kind: 'turret', tx: 0, ty: 0 }]])).toContain('rock');
    expect(bad([[1, { a: 'build', kind: 'turret', tx: 12, ty: 10 }]])).toContain('costs 50 thorium');
    expect(bad([[1, { a: 'grantThorium', amount: 500 }], [2, { a: 'build', kind: 'laser', tx: 12, ty: 10 }]])).toContain('needs tech laser');
    expect(bad([[1, { a: 'unlock', key: 'warp' }]])).toContain('unknown tech');
    expect(bad([[1, { a: 'upgrade', tx: 12, ty: 10 }]])).toContain('no structure');
    expect(bad([[1, { a: 'release', kind: 'scout', count: 5000 }]])).toContain('only');
    expect(bad([[1, { a: 'release', kind: 'tank', count: 1 }]])).toContain('wants 1 but only 0');
  });

  it('is clean for a funded, valid script and converts seconds to ticks once', () => {
    const m = custom('t-ok', [
      [2.5, { a: 'grantThorium', amount: 50 }], [2.5, { a: 'build', kind: 'turret', tx: 12, ty: 10 }],
      [1, { a: 'message', text: 'hi' }],
    ]);
    const r = compile(m);
    expect(r.errors).toEqual([]);
    expect(r.events.map((e) => e.tick)).toEqual([60, 150, 150]);
    expect(r.events.map((e) => e.index)).toEqual([2, 0, 1]);
  });

  it('scales release counts by enemy strength', () => {
    const m = custom('t-scale', [[1, { a: 'release', kind: 'scout', count: 10 }]]);
    expect(compile(m, 'beginner').events[0].action).toMatchObject({ count: 6 });
    expect(compile(m, 'expert').events[0].action).toMatchObject({ count: 14 });
  });
});

describe('timeline runner', () => {
  it('fires every due event exactly once, in declared order, across one big jump', () => {
    const base = find('kreios-1');
    const m = custom('t-jump', [
      [5, { a: 'message', text: 'b' }], [1, { a: 'message', text: 'a' }],
      [5, { a: 'grantThorium', amount: 50 }], [5, { a: 'build', kind: 'turret', tx: 12, ty: 10 }],
      [9, { a: 'release', kind: 'scout', count: 4 }], [3, { a: 'release', kind: 'scout', count: 2 }],
      [9000, { a: 'message', text: 'late' }],
    ]);
    const sim = make(m);
    const emitted: SimEvent[] = [];
    sim.world.tick = 60 * 100;
    timelineSystem(sim.world, 1 / 60, (e) => emitted.push(e));
    timelineSystem(sim.world, 1 / 60, (e) => emitted.push(e));
    const kinds = emitted.map((e) => (e.t === 'message' ? e.text : e.t));
    expect(kinds.slice(-4)).toEqual(['a', 'b', 'thorium', 'structureBuilt']);
    expect(sim.world.timelineCursor).toBe(6);
    expect(launches.map((l) => l.split(':').slice(2).join(':'))).toEqual(['scout:2', 'scout:4']);
    expect(emitted.filter((e) => e.t === 'structureBuilt')).toHaveLength(base.preplaced.length + 1);
  });

  it('is deterministic for the same seed over 10 s, for several missions', () => {
    for (const id of ['kreios-1', 'hathor-4', 'aether-6', 'helios-7', 'kreios-r']) {
      const a = run(make(find(id), 'normal', 99), 10);
      const b = run(make(find(id), 'normal', 99), 10);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.some((e) => e.t === 'message')).toBe(true);
      expect(a.some((e) => e.t === 'structureBuilt')).toBe(true);
      expect(a.some((e) => e.t === 'missionError')).toBe(false);
    }
  });

  it('runs whole timelines against real production without mission errors', () => {
    const cases: [string, Difficulty][] = [
      ['kreios-1', 'expert'], ['kreios-7', 'expert'], ['hathor-4', 'expert'], ['hathor-r', 'expert'], ['aether-6', 'expert'],
      ['aether-r', 'expert'], ['helios-7', 'expert'], ['helios-r', 'expert'], ['kreios-1', 'beginner'], ['helios-7', 'beginner'],
    ];
    for (const [id, d] of cases) {
      const m = find(id);
      const sim = make(m, d);
      const ev = run(sim, Math.max(...m.timeline.map((e) => e.atSec)) + 1);
      expect(ev.filter((e) => e.t === 'missionError'), id + ' ' + d).toEqual([]);
      expect(sim.world.timelineCursor).toBe(m.timeline.length);
    }
  });
  it('pause freezes the timeline and restart begins from scratch', () => {
    const sim = make(find('kreios-1'));
    run(sim, 7);
    const cursor = sim.world.timelineCursor;
    const tick = sim.world.tick;
    expect(cursor).toBeGreaterThan(0);
    sim.step([{ t: 'pause' }]);
    for (let i = 0; i < 600; i++) sim.step([]);
    expect(sim.world.tick).toBe(tick);
    expect(sim.world.timelineCursor).toBe(cursor);
    sim.step([{ t: 'pause' }]);
    expect(sim.world.tick).toBe(tick + 1);
    const again = make(find('kreios-1'));
    expect(again.world.timelineCursor).toBe(0);
    expect(JSON.stringify(run(again, 7))).toBe(JSON.stringify(run(make(find('kreios-1')), 7)));
    expect(again.world.timelineCursor).toBe(cursor);
  });

  it('the enemy never spends or builds on its own between scripted events', () => {
    const m = find('kreios-3');
    const dueTicks = new Set(compile(m).events.map((e) => e.tick));
    const sim = make(m);
    const w = sim.world;
    let structures = w.structures.size;
    const violations: string[] = [];
    for (let i = 0; i < 60 * 330; i++) {
      sim.step([]);
      sim.drainEvents();
      const t = w.tick - 1;
      if (!dueTicks.has(t) && (w.structures.size !== structures || w.players[1].thorium !== 0)) violations.push('tick ' + t);
      structures = w.structures.size;
    }
    expect(violations).toEqual([]);
    expect(w.units).toHaveLength(0);
    expect(launches.length).toBeGreaterThan(0);
  });

  it('release drains stored units into the handler', () => {
    const m = custom('t-rel', [[0.5, { a: 'release', kind: 'scout', count: 10 }], [1, { a: 'release', kind: 'all', count: 'all' }]]);
    const sim = make(m);
    run(sim, 2);
    expect(launches[0]).toMatch(/:1:scout:10$/);
    expect(launches).toHaveLength(2);
    expect(sim.world.players[1].stored.scout ?? 0).toBeLessThanOrEqual(2);
  });

  it('surfaces a missing release handler as a mission error and stops the timeline', () => {
    setReleaseHandler(null);
    const m = custom('t-nohandler', [[0.5, { a: 'release', kind: 'scout', count: 1 }], [1, { a: 'message', text: 'never' }]]);
    const sim = make(m);
    const ev = run(sim, 2);
    expect(ev.filter((e) => e.t === 'missionError')).toHaveLength(1);
    expect(ev.some((e) => e.t === 'message')).toBe(false);
    expect(isMissionErrored(sim.world)).toBe(true);
    expect(missionErrors(sim.world)[0]).toContain('no release handler');
  });

  it('a broken mission reports its compile errors at tick 0 and does not fire events', () => {
    const m = custom('t-broken', [[1, { a: 'build', kind: 'laser', tx: 12, ty: 10 }], [2, { a: 'message', text: 'x' }]]);
    const sim = make(m);
    const ev = run(sim, 3);
    expect(ev.filter((e) => e.t === 'missionError').length).toBeGreaterThan(0);
    expect(ev.filter((e) => e.t === 'structureBuilt')).toHaveLength(m.preplaced.length);
    expect(sim.world.timelineCursor).toBe(0);
  });
});

describe('area data sanity', () => {
  it('kreios 1 starts with a basic enemy and teaches tank', () => {
    const m = getMission('kreios', 0)!;
    expect(m.teaches).toBe('tank');
    expect(m.unlocked).toEqual([]);
  });
});
