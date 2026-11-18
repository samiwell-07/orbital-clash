import { describe, expect, it } from 'vitest';
import { SHIP_MAX_SPEED } from '@/config/constants';
import { addRock, addStructure } from '@/sim/core';
import {
  awardBaseKillBonus, mapThoriumFactor, purchasableResearch, smashRock, spawnInitialRocks, unlockResearch,
} from '@/sim/economy';
import { generateDefaultMap } from '@/sim/core/defaultMap';
import { makeSim } from '../sim-build/helpers';

const move = (ax: number, ay: number) => ({ t: 'move', player: 0, ax, ay }) as const;

describe('ship', () => {
  it('accelerates, respects max speed and clamps to the map', () => {
    const { w, step } = makeSim();
    const s = w.players[0].ship;
    step([move(-1, -1)], 5);
    expect(s.vx).toBeLessThan(0);
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      step(i === 0 ? [move(-5, -5)] : []);
      peak = Math.max(peak, Math.hypot(s.vx, s.vy));
    }
    expect(peak).toBeLessThanOrEqual(SHIP_MAX_SPEED + 1e-9);
    expect(s.x).toBeCloseTo(0.5);
    expect(s.y).toBeCloseTo(0.5);
    expect([s.cursorTx, s.cursorTy]).toEqual([0, 0]);
    step([move(1, 1)], 1200);
    expect(s.x).toBeCloseTo(w.grid.w - 0.5);
    expect(s.y).toBeCloseTo(w.grid.h - 0.5);
  });

  it('drags to a stop and flies over structures', () => {
    const { w, step } = makeSim();
    const s = w.players[0].ship;
    addStructure(w, { kind: 'turret', owner: 1, tx: s.cursorTx + 2, ty: s.cursorTy, hp: 10 });
    step([move(1, 0)], 30);
    expect(s.x).toBeGreaterThan(s.cursorTx);
    step([move(0, 0)], 120);
    expect(Math.hypot(s.vx, s.vy)).toBeLessThan(1e-3);
  });
});

describe('rocks', () => {
  it('grab, carry and smash over a turret credits the carrier', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    addStructure(w, { kind: 'turret', owner: 1, tx: 20, ty: 12, hp: 100 });
    const rock = addRock(w, { x: p.ship.x + 0.5, y: p.ship.y, size: 2, thorium: 30, state: 'landed' });
    const cash = p.thorium;
    const grabbed = step([{ t: 'grab', player: 0 }]);
    expect(grabbed).toContainEqual({ t: 'rockGrabbed', id: rock.id, owner: 0 });
    expect(rock.state).toBe('grabbed');
    expect(p.ship.carrying).toBe(rock.id);
    step([], 3);
    expect([rock.x, rock.y]).toEqual([p.ship.x, p.ship.y]);

    p.ship.x = 20.5;
    p.ship.y = 12.5;
    const ev = step();
    const factor = mapThoriumFactor(w);
    const paid = Math.round(30 * factor);
    expect(ev).toContainEqual(expect.objectContaining({ t: 'rockSmashed', id: rock.id, thorium: paid, owner: 0 }));
    expect(p.thorium).toBe(cash + paid);
    expect(p.stats.thoriumEarned).toBe(paid);
    expect(p.ship.carrying).toBe(0);
    expect(w.rocks).toHaveLength(0);
  });

  it('drop leaves a landed rock that does nothing off-tower', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    const rock = addRock(w, { x: p.ship.x, y: p.ship.y, thorium: 10, state: 'drifting', vx: 0.1 });
    step([{ t: 'grab', player: 0 }]);
    expect(rock.state).toBe('grabbed');
    step([{ t: 'drop', player: 0 }]);
    expect(rock.state).toBe('landed');
    expect(rock.carriedBy).toBe(-1);
    expect(p.ship.carrying).toBe(0);
    expect(w.rocks).toHaveLength(1);
  });

  it('pulsars do not smash; a landed rock over a laser pays its owner', () => {
    const { w, step } = makeSim();
    addStructure(w, { kind: 'pulsar', owner: 0, tx: 15, ty: 15, hp: 10 });
    addStructure(w, { kind: 'laser', owner: 1, tx: 16, ty: 15, hp: 10 });
    addRock(w, { x: 15.5, y: 15.5, thorium: 20, state: 'landed' });
    const onLaser = addRock(w, { x: 16.5, y: 15.5, thorium: 20, state: 'landed' });
    const before = w.players[1].thorium;
    step();
    expect(w.rocks.map((r) => r.id)).not.toContain(onLaser.id);
    expect(w.rocks).toHaveLength(1);
    expect(w.players[1].thorium).toBe(before + Math.round(20 * mapThoriumFactor(w)));
  });

  it('smashRock applies thoriumRate and is idempotent', () => {
    const { w } = makeSim({ thoriumRate: 2 });
    const rock = addRock(w, { x: 12, y: 12, thorium: 10, state: 'drifting' });
    const evs: unknown[] = [];
    const paid = smashRock(w, rock.id, 1, (e) => evs.push(e));
    expect(paid).toBe(Math.round(10 * 2 * mapThoriumFactor(w)));
    expect(smashRock(w, rock.id, 1, (e) => evs.push(e))).toBe(0);
    expect(evs).toHaveLength(2);
  });
});

describe('meteors', () => {
  const run = (over = {}) => {
    const g = makeSim(over);
    g.step([], 60 * 90);
    return g.w.rocks.map((r) => [r.id, r.state, r.size, +r.x.toFixed(4), +r.y.toFixed(4)]);
  };

  it('spawns deterministically for the same seed and respects the cap', () => {
    const a = run();
    expect(a.length).toBeGreaterThan(0);
    expect(run()).toEqual(a);
    expect(run({ seed: 99 })).not.toEqual(a);
    expect(a.length).toBeLessThanOrEqual(14);
  });

  it('spawns more with a higher thorium rate', () => {
    const lo = makeSim({ thoriumRate: 0.5 });
    const hi = makeSim({ thoriumRate: 2 });
    const count = (g: typeof lo) => g.step([], 60 * 40).filter((e) => e.t === 'rockSpawned').length;
    expect(count(hi)).toBeGreaterThan(count(lo));
  });

  it('spawnInitialRocks places map.rockCount landed rocks on free floor', () => {
    const { w } = makeSim();
    const map = generateDefaultMap('x');
    spawnInitialRocks(w, map);
    expect(w.rocks).toHaveLength(map.rockCount);
    for (const r of w.rocks) {
      expect(r.state).toBe('landed');
      expect(w.grid.terrain[Math.floor(r.y) * w.grid.w + Math.floor(r.x)]).toBe(0);
    }
  });
});

describe('thorium and bionic layer', () => {
  it('base kill bonus only applies in Battle', () => {
    const battle = makeSim();
    expect(awardBaseKillBonus(battle.w, 0, 100)).toBe(100);
    expect(battle.w.players[0].stats.thoriumEarned).toBe(100);
    const camp = makeSim({ mode: 'campaign' });
    expect(awardBaseKillBonus(camp.w, 0, 100)).toBe(0);
  });

  it('harvesters trickle thorium from nearby landed rocks (bionic only)', () => {
    for (const profile of ['bionic', 'base'] as const) {
      const { w, step } = makeSim({ profile });
      const h = addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
      const rock = addRock(w, { x: 21.5, y: 12.5, thorium: 8, state: 'landed' });
      const cash = w.players[0].thorium;
      step([], 60 * 6);
      if (profile === 'base') {
        expect(w.players[0].thorium).toBe(cash);
        continue;
      }
      expect(h.cooldown).toBeGreaterThan(-1);
      expect(w.players[0].thorium).toBeGreaterThan(cash);
      expect(w.rocks.includes(rock)).toBe(false);
    }
  });

  it('research labs sell tech', () => {
    const { w, step } = makeSim({ profile: 'bionic' });
    expect(purchasableResearch(w, 0)).toEqual([]);
    expect(unlockResearch(w, 0, 'tank', () => {}).reason).toBe('needs a research lab');
    addStructure(w, { kind: 'researchLab', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
    const list = purchasableResearch(w, 0);
    expect(list[0].cost).toBeLessThanOrEqual(list[list.length - 1].cost);
    const cash = w.players[0].thorium;
    const ev = step([{ t: 'upgrade', player: 0, tx: 20, ty: 12 }]);
    expect(ev).toContainEqual({ t: 'techUnlocked', owner: 0, key: list[0].key });
    expect(w.players[0].tech[list[0].key]).toBe(true);
    expect(w.players[0].thorium).toBe(cash - list[0].cost);
  });
});
