import { describe, expect, it } from 'vitest';
import { RECYCLE_FULL } from '@/config/constants';
import { addStructure, addUnit } from '@/sim/core';
import { canBuild, unlockedOutputs } from '@/sim/build';
import { corridor, makeSim } from './helpers';

const build = (kind: 'turret' | 'laser' | 'basicOps' | 'specialOps' | 'missileSilo', tx: number, ty: number) =>
  ({ t: 'build', player: 0, kind, tx, ty }) as const;

describe('build rules', () => {
  it('places a structure, charges thorium and animates construction', () => {
    const { w, step } = makeSim();
    const before = w.players[0].thorium;
    const ev = step([build('turret', 10, 10)]);
    expect(ev.some((e) => e.t === 'structureBuilt' && e.kind === 'turret')).toBe(true);
    expect(w.players[0].thorium).toBe(before - 50);
    const s = [...w.structures.values()][0];
    expect(s.buildProgress).toBeLessThan(1);
    step([], 40);
    expect(s.buildProgress).toBe(1);
  });

  it('refuses without enough thorium', () => {
    const { w, step } = makeSim();
    w.players[0].thorium = 10;
    const ev = step([build('turret', 10, 10)]);
    expect(ev).toContainEqual({ t: 'denied', owner: 0, reason: 'not enough thorium' });
    expect(w.structures.size).toBe(0);
    expect(w.players[0].thorium).toBe(10);
  });

  it('gates tech and bionic-only structures', () => {
    const { w, step } = makeSim();
    expect(canBuild(w, 0, 'laser', 10, 10)).toEqual({ ok: false, reason: 'not unlocked' });
    w.players[0].tech.laser = true;
    expect(canBuild(w, 0, 'laser', 10, 10).ok).toBe(true);
    expect(canBuild(w, 0, 'missileSilo', 10, 10).ok).toBe(false);
    step();
    const bionic = makeSim({ profile: 'bionic' });
    expect(canBuild(bionic.w, 0, 'missileSilo', 10, 10).ok).toBe(true);
  });

  it('rejects blocked terrain, occupied tiles and bases', () => {
    const { w, step } = makeSim();
    expect(canBuild(w, 0, 'turret', 0, 0).reason).toBe('terrain blocked');
    expect(canBuild(w, 0, 'turret', w.players[0].baseTx, w.players[0].baseTy).reason).toBe('tile occupied');
    step([build('turret', 10, 10)]);
    expect(canBuild(w, 0, 'turret', 10, 10).reason).toBe('tile occupied');
  });

  it('refuses a placement that fully blocks the route', () => {
    const { w, step } = makeSim();
    corridor(w);
    addStructure(w, { kind: 'basicOps', owner: 0, tx: 6, ty: 1, hp: 10 });
    const ev = step([build('turret', 3, 1)]);
    expect(ev).toContainEqual({ t: 'denied', owner: 0, reason: 'would block the path' });
    expect(w.structures.size).toBe(1);
  });

  it('needs a base first, then buildBase places it and builds the flow field', () => {
    const { w, step } = makeSim();
    w.players[0].baseBuilt = false;
    expect(canBuild(w, 0, 'turret', 10, 10).reason).toBe('build your base first');
    const ev = step([{ t: 'buildBase', player: 0, tx: 8, ty: 8 }]);
    expect(ev).toContainEqual({ t: 'baseBuilt', owner: 0, tx: 8, ty: 8 });
    expect(w.players[0].baseBuilt).toBe(true);
    expect(w.flows[0]?.dist[8 * w.grid.w + 8]).toBe(0);
    const again = step([{ t: 'buildBase', player: 0, tx: 9, ty: 9 }]);
    expect(again.some((e) => e.t === 'denied')).toBe(true);
  });

  it('destroys friendly units (only) under a new structure', () => {
    const { w, step } = makeSim();
    const mine = addUnit(w, { kind: 'scout', owner: 0, x: 10.5, y: 10.5, hp: 5 });
    const flying = addUnit(w, { kind: 'drone', owner: 0, x: 10.5, y: 10.5, hp: 5, layer: 'air' });
    const foe = addUnit(w, { kind: 'scout', owner: 1, x: 10.5, y: 10.5, hp: 5 });
    step([build('turret', 10, 10)]);
    expect(w.units.map((u) => u.id)).not.toContain(mine.id);
    expect(w.units.map((u) => u.id)).toEqual(expect.arrayContaining([flying.id, foe.id]));
  });
});

describe('upgrade / recycle / repair', () => {
  it('upgrades through every level with costs, hp growth and a level cap', () => {
    const { w, step } = makeSim();
    step([build('turret', 10, 10)]);
    const s = [...w.structures.values()][0];
    const hp0 = s.maxHp;
    const cash = w.players[0].thorium;
    const up = { t: 'upgrade', player: 0, tx: 10, ty: 10 } as const;
    const ev = step([up]);
    expect(ev).toContainEqual({ t: 'structureUpgraded', id: s.id, level: 1 });
    expect(w.players[0].thorium).toBe(cash - 40);
    expect(s.maxHp).toBeGreaterThan(hp0);
    step([up]);
    step([up]);
    expect(s.level).toBe(3);
    expect(w.players[0].thorium).toBe(cash - 40 - 70 - 110);
    expect(step([up]).some((e) => e.t === 'denied')).toBe(true);
    expect(s.level).toBe(3);
  });

  it('refuses upgrades without thorium', () => {
    const { w, step } = makeSim();
    step([build('turret', 10, 10)]);
    w.players[0].thorium = 5;
    const ev = step([{ t: 'upgrade', player: 0, tx: 10, ty: 10 }]);
    expect(ev).toContainEqual({ t: 'denied', owner: 0, reason: 'not enough thorium' });
  });

  it('basic ops upgrades unlock further outputs and cycleOutput walks them', () => {
    const { w, step } = makeSim();
    w.players[0].tech.tank = true;
    step([build('basicOps', 10, 10)]);
    const s = [...w.structures.values()][0];
    expect(s.output).toBe('scout');
    step([{ t: 'upgrade', player: 0, tx: 10, ty: 10 }]);
    expect(s.output).toBe('scout');
    expect(unlockedOutputs(w.players[0].tech, 'basicOps', s.level)).toEqual(['scout', 'tank']);
    const cycle = { t: 'cycleOutput', player: 0, tx: 10, ty: 10 } as const;
    step([cycle]);
    expect(s.output).toBe('tank');
    step([cycle]);
    expect(s.output).toBe('scout');
  });

  it('special ops default to the hammer', () => {
    const { w, step } = makeSim();
    w.players[0].tech.hammers = true;
    w.players[0].tech.thief = true;
    step([build('specialOps', 10, 10)]);
    const s = [...w.structures.values()][0];
    expect(s.output).toBe('hammer');
    step([{ t: 'cycleOutput', player: 0, tx: 10, ty: 10 }]);
    expect(s.output).toBe('thief');
  });

  it('recycle refunds (build + upgrades) scaled by health', () => {
    const { w, step } = makeSim();
    step([build('turret', 10, 10)]);
    step([{ t: 'upgrade', player: 0, tx: 10, ty: 10 }]);
    step([{ t: 'upgrade', player: 0, tx: 10, ty: 10 }]);
    const s = [...w.structures.values()][0];
    const cash = w.players[0].thorium;
    const ev = step([{ t: 'recycle', player: 0, tx: 10, ty: 10 }]);
    const full = Math.round((50 + 40 + 70) * RECYCLE_FULL);
    expect(ev).toContainEqual({ t: 'structureRecycled', id: s.id, refund: full, owner: 0 });
    expect(w.players[0].thorium).toBe(cash + full);
    expect(w.structures.size).toBe(0);
    expect(w.grid.occupant[10 * w.grid.w + 10]).toBe(0);
  });

  it('damaged structures recycle for less', () => {
    const { w, step } = makeSim();
    step([build('turret', 10, 10)]);
    const s = [...w.structures.values()][0];
    s.hp = s.maxHp / 2;
    const ev = step([{ t: 'recycle', player: 0, tx: 10, ty: 10 }]);
    expect(ev).toContainEqual({ t: 'structureRecycled', id: s.id, refund: Math.round(50 * RECYCLE_FULL * 0.5), owner: 0 });
  });

  it('repair costs thorium by damage and restores hp', () => {
    const { w, step } = makeSim();
    step([build('turret', 10, 10)]);
    const s = [...w.structures.values()][0];
    const repair = { t: 'repair', player: 0, tx: 10, ty: 10 } as const;
    expect(step([repair]).some((e) => e.t === 'denied')).toBe(true);
    s.hp = s.maxHp / 2;
    const cash = w.players[0].thorium;
    const ev = step([repair]);
    expect(ev).toContainEqual({ t: 'structureRepaired', id: s.id, cost: 13 });
    expect(w.players[0].thorium).toBe(cash - 13);
    expect(s.hp).toBe(s.maxHp);
  });

  it('cannot touch other players structures', () => {
    const { w, step } = makeSim();
    addStructure(w, { kind: 'turret', owner: 1, tx: 12, ty: 12, hp: 50 });
    const ev = step([{ t: 'recycle', player: 0, tx: 12, ty: 12 }]);
    expect(ev.some((e) => e.t === 'denied')).toBe(true);
    expect(w.structures.size).toBe(1);
  });
});
