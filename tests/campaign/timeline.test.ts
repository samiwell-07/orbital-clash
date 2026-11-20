import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Difficulty, Mission, ScriptAction, SimEvent } from '@/types';
import { STAGE_ORDER, addStructure, createSim, createWorld, registerSystem, removeStructure, structureAt } from '@/sim/core';
import { productionSystem } from '@/sim/army/production';
import {
  applyMissionSetup, compile, isMissionErrored, missionErrors, setReleaseHandler, startCampaign, timelineSystem,
} from '@/sim/modes/campaign';
import { executeAction } from '@/sim/modes/campaign/actions';
import { ALL_MISSIONS, EXPANSION_MISSIONS, getMission } from '@/data/areas';
import { registerSeed } from '@/data/areas/seeds';
import { canBuild } from '@/sim/build';

registerSystem('test.production', STAGE_ORDER.production, productionSystem);

let launches: string[] = [];
beforeEach(() => {
  launches = [];
  setReleaseHandler((w, owner, kind, count) => {
    launches.push(`${w.tick}:${owner}:${kind}:${count}`);
  });
});
afterEach(() => setReleaseHandler(null));

const find = (id: string): Mission => [...ALL_MISSIONS, ...EXPANSION_MISSIONS].find((m) => m.id === id) as Mission;

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
      ['gaia-r', 'expert'], ['kronos-7', 'expert'],
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
    // 'all' also launches whatever the preplaced towers produced meanwhile.
    expect(launches.filter((l) => l.includes(':scout:'))).toHaveLength(2);
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

describe('taught tech', () => {
  const techEvents = (ev: SimEvent[]) => ev.filter((e) => e.t === 'techUnlocked');

  it('Rock Fall gives Player 0 Lasers at tick 0, buildable right away, with one player notice', () => {
    const sim = make(getMission('kreios', 1)!);
    const w = sim.world;
    expect(w.players[0].tech.laser).toBe(true);
    let tile: { tx: number; ty: number } | null = null;
    for (let r = 1; r < 8 && !tile; r++) {
      for (let dy = -r; dy <= r && !tile; dy++) {
        for (let dx = -r; dx <= r && !tile; dx++) {
          const tx = w.players[0].baseTx + dx, ty = w.players[0].baseTy + dy;
          if (canBuild(w, 0, 'turret', tx, ty).ok) tile = { tx, ty };
        }
      }
    }
    expect(tile).not.toBeNull();
    expect(canBuild(w, 0, 'laser', tile!.tx, tile!.ty).ok).toBe(true);
    sim.step([]);
    expect(techEvents(sim.drainEvents())).toEqual([{ t: 'techUnlocked', owner: 0, key: 'laser' }]);
    sim.step([]);
    expect(techEvents(sim.drainEvents())).toEqual([]);
  });

  it('First Impact gives Player 0 Tanks at the start', () => {
    expect(make(getMission('kreios', 0)!).world.players[0].tech.tank).toBe(true);
  });

  it('every co-op human and the enemy get the taught tech', () => {
    const w = make(getMission('kreios', 1)!, 'normal', 7, 2).world;
    expect([0, 1, 2].map((id) => w.players[id].tech.laser)).toEqual([true, true, true]);
  });

  it('extra alien tech goes to the enemy only', () => {
    const sim = make(getMission('kreios', 3)!);
    sim.step([]);
    const ev = techEvents(sim.drainEvents());
    expect(ev).toContainEqual({ t: 'techUnlocked', owner: 1, key: 'pulsar' });
    expect(ev.filter((e) => e.t === 'techUnlocked' && e.owner === 0)).toEqual([]);
    expect(sim.world.players[0].tech.pulsar).toBeFalsy();
  });
});

describe('enemy bursts', () => {
  const enemyKinds = new Set(['build', 'upgrade', 'upgradeAll', 'rebuildAll', 'setOutputAll', 'release', 'grantThorium']);
  const burstKinds = new Set(['upgradeAll', 'rebuildAll']);

  function setup(id = 'kreios-2') {
    const w = createWorld(startCampaign({ mission: find(id), difficulty: 'normal' }));
    expect(applyMissionSetup(w, () => undefined)).toEqual([]);
    const events: SimEvent[] = [];
    const exec = (a: ScriptAction) => executeAction(w, 1, a, { dry: false }, (e) => events.push(e));
    const mine = (kind?: string) => [...w.structures.values()].filter((s) => s.owner === 1 && (!kind || s.kind === kind));
    return { w, events, exec, mine };
  }

  it.each(['kreios-1', 'hathor-6', 'helios-r', 'gaia-1', 'kronos-r'])('%s starts fully geared and stays quiet for 30 s', (id) => {
    const m = find(id);
    const sim = make(m);
    const first = run(sim, 1 / 60);
    const enemyPre = m.preplaced.filter((p) => p.owner === 1);
    expect(first.filter((e) => e.t === 'structureBuilt' && e.owner === 1)).toHaveLength(enemyPre.length);
    expect([...sim.world.structures.values()].filter((s) => s.owner === 1)).toHaveLength(enemyPre.length);
    const quiet = run(sim, 29.9);
    expect(quiet.filter((e) => e.t === 'structureBuilt' || e.t === 'structureUpgraded' || (e.t === 'thorium' && e.owner === 1))).toEqual([]);
    expect(launches).toEqual([]);
    expect(m.timeline.filter((e) => enemyKinds.has(e.action.a) && e.atSec < 30)).toEqual([]);
  });

  it('every area acts in bursts from 40 s on, 60-90 s apart', () => {
    for (const m of [...ALL_MISSIONS, ...EXPANSION_MISSIONS]) {
      const times = [...new Set(m.timeline.filter((e) => burstKinds.has(e.action.a)).map((e) => e.atSec))];
      expect(times.length, m.id).toBeGreaterThanOrEqual(2);
      expect(times[0], m.id).toBeGreaterThanOrEqual(40);
      expect(times[0], m.id).toBeLessThanOrEqual(60);
      for (let i = 1; i < times.length; i++) {
        expect(times[i] - times[i - 1], m.id).toBeGreaterThanOrEqual(60);
        expect(times[i] - times[i - 1], m.id).toBeLessThanOrEqual(90);
      }
    }
  });

  it('upgradeAll upgrades every laser at once, self-funded, and is a no-op when none qualify', () => {
    const { w, events, exec, mine } = setup();
    const lasers = mine('laser');
    const turrets = mine('turret').map((s) => s.level);
    expect(lasers.length).toBeGreaterThanOrEqual(2);
    expect(exec({ a: 'upgradeAll', kind: 'laser', text: 'up!' })).toBeNull();
    expect(lasers.map((s) => s.level)).toEqual(lasers.map(() => 1));
    expect(mine('turret').map((s) => s.level)).toEqual(turrets);
    expect(events.filter((e) => e.t === 'structureUpgraded')).toHaveLength(lasers.length);
    expect(events.find((e) => e.t === 'thorium')).toEqual({ t: 'thorium', owner: 1, amount: 80 * lasers.length });
    expect(events.filter((e) => e.t === 'message')).toHaveLength(1);
    expect(w.players[1].thorium).toBe(0);
    expect(lasers[0].maxHp).toBeGreaterThan(100);

    expect(exec({ a: 'upgradeAll', kind: 'laser', max: 1 })).toBeNull();
    expect(lasers.map((s) => s.level)).toEqual([2, ...lasers.slice(1).map(() => 1)]);
    expect(exec({ a: 'upgradeAll', kind: 'laser', max: 1 })).toBeNull();
    expect(lasers[1].level).toBe(2);

    events.length = 0;
    for (const s of lasers) s.level = 3;
    expect(exec({ a: 'upgradeAll', kind: 'laser', text: 'up!' })).toBeNull();
    expect(exec({ a: 'upgradeAll', kind: 'bomber' })).toBeNull();
    expect(exec({ a: 'upgradeAll', kind: 'turret', cap: 0 })).toBeNull();
    expect(events).toEqual([]);
    expect(exec({ a: 'upgradeAll', kind: 'warp' as never })).toContain('unknown');
  });

  it('rebuildAll restores destroyed originals at their level and skips occupied tiles', () => {
    const { w, events, exec, mine } = setup();
    const [a, b] = mine('laser');
    const towers = mine('basicOps').filter((s) => s.level > 0);
    const tower = towers[0];
    removeStructure(w, a.id);
    removeStructure(w, b.id);
    removeStructure(w, tower.id);
    addStructure(w, { kind: 'turret', owner: 0, tx: b.tx, ty: b.ty, hp: 120 });
    expect(exec({ a: 'rebuildAll', text: 'rebuilt' })).toBeNull();
    expect(structureAt(w, a.tx, a.ty)).toMatchObject({ kind: 'laser', owner: 1, level: 0 });
    expect(structureAt(w, b.tx, b.ty)).toMatchObject({ kind: 'turret', owner: 0 });
    expect(structureAt(w, tower.tx, tower.ty)).toMatchObject({ kind: 'basicOps', owner: 1, level: tower.level, output: tower.output });
    expect(events.filter((e) => e.t === 'structureBuilt')).toHaveLength(2);
    expect(events.filter((e) => e.t === 'message')).toHaveLength(1);
    events.length = 0;
    expect(exec({ a: 'rebuildAll', text: 'rebuilt' })).toBeNull();
    expect(events).toEqual([]);
  });

  it('dry-run compile accepts burst actions', () => {
    const m = custom('t-burst', [
      [40, { a: 'upgradeAll', kind: 'weapons', max: 2 }], [41, { a: 'upgradeAll', kind: 'towers' }],
      [42, { a: 'rebuildAll' }], [43, { a: 'setOutputAll', kind: 'basicOps', output: 'scout' }],
    ]);
    expect(compile(m).errors).toEqual([]);
  });
});
