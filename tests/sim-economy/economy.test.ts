import { describe, expect, it } from 'vitest';
import { SHIP_FULL_HEAL_S, SHIP_HP_CAP, SHIP_HP_START, SHIP_MAX_SPEED, SHIP_RESPAWN_S } from '@/config/constants';
import { addRock, addStructure } from '@/sim/core';
import {
  awardBaseKillBonus, damageShip, ECON, harvesterRange, mapThoriumFactor, purchasableResearch, spawnInitialRocks, unlockResearch,
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
  it('a towed rock rides in front of the ship, on its heading', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    p.ship.x = 10;
    p.ship.y = 10;
    const rock = addRock(w, { x: 10.5, y: 10, size: 2, thorium: 30, state: 'landed' });
    const grabbed = step([{ t: 'grab', player: 0 }]);
    expect(grabbed).toContainEqual({ t: 'rockGrabbed', id: rock.id, owner: 0 });
    expect(rock.state).toBe('grabbed');
    expect(p.ship.carrying).toBe(rock.id);
    step([move(0, 1)], 60);
    const dist = Math.hypot(rock.x - p.ship.x, rock.y - p.ship.y);
    expect(dist).toBeCloseTo(ECON.towDistance[2]);
    expect(rock.y - p.ship.y).toBeCloseTo(dist, 2);
  });

  it('drop leaves a landed rock where it was towed; nothing smashes it over a weapon', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    addStructure(w, { kind: 'turret', owner: 0, tx: 20, ty: 12, hp: 100 });
    const rock = addRock(w, { x: p.ship.x, y: p.ship.y, thorium: 10, state: 'drifting', vx: 0.1 });
    step([{ t: 'grab', player: 0 }]);
    expect(rock.state).toBe('grabbed');
    p.ship.x = 19.5;
    p.ship.y = 12.5;
    step([], 3);
    const at = [rock.x, rock.y];
    const cash = p.thorium;
    step([{ t: 'drop', player: 0 }], 60);
    expect(rock.state).toBe('landed');
    expect([rock.x, rock.y]).toEqual(at);
    expect(rock.carriedBy).toBe(-1);
    expect(p.ship.carrying).toBe(0);
    expect(w.rocks).toHaveLength(1);
    expect(p.thorium).toBe(cash);
  });

  it('a rock dropped on the move keeps the exact ship velocity and never slows down', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    p.ship.x = 4;
    p.ship.y = 12.5;
    const rock = addRock(w, { x: 4.5, y: 12.5, size: 1, thorium: 15, state: 'landed' });
    step([{ t: 'grab', player: 0 }]);
    step([move(1, 0)], 10);
    step([{ t: 'drop', player: 0 }, move(0, 0)]);
    const v = [rock.vx, rock.vy];
    expect(rock.state).toBe('drifting');
    expect(v[0]).toBeGreaterThan(0.5);
    const x0 = rock.x;
    step([], 60 * 3);
    expect(rock.state).toBe('drifting');
    expect([rock.vx, rock.vy]).toEqual(v);
    expect(rock.x).toBeCloseTo(x0 + v[0] * 3, 6);
  });

  it('a drifting rock never lands and is removed once it leaves the map', () => {
    const { w, step } = makeSim();
    const rock = addRock(w, { x: 2, y: 2.5, size: 1, thorium: 15, state: 'drifting', vx: 1.5 });
    let ticks = 0;
    while (w.rocks.includes(rock) && ticks < 60 * 120) {
      step();
      ticks++;
      expect(rock.state === 'drifting' || rock.state === 'smashed').toBe(true);
      expect(rock.vx).toBe(1.5);
    }
    expect(w.rocks.includes(rock)).toBe(false);
    expect(rock.x).toBeGreaterThan(w.grid.w);
  });

  it('a thrown rock flies over blocked terrain', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    p.ship.x = 4;
    p.ship.y = 3.5;
    const rock = addRock(w, { x: 4.5, y: 3.5, size: 2, thorium: 40, state: 'landed' });
    step([{ t: 'grab', player: 0 }]);
    step([move(1, 0)], 10);
    step([{ t: 'drop', player: 0 }, move(-1, 0)]);
    const wall = Math.floor(rock.x) + 2;
    for (let ty = 0; ty < w.grid.h; ty++) w.grid.terrain[ty * w.grid.w + wall] = 1;
    step([], 60 * 4);
    expect(rock.state).toBe('drifting');
    expect(rock.x).toBeGreaterThan(wall + 2);
  });

  it('a harvester catches a rock thrown into its magnet from far away', () => {
    const { w, step } = makeSim();
    addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
    const rock = addRock(w, { x: 5.5, y: 12.5, size: 1, thorium: ECON.rockThorium[1], state: 'drifting', vx: 3 });
    step([], 60 * 3);
    expect(rock.state).toBe('drifting');
    step([], 60 * 2);
    expect(rock.state).toBe('harvesting');
    expect([rock.vx, rock.vy]).toEqual([0, 0]);
    step([], 60 * 10);
    expect(w.rocks.includes(rock)).toBe(false);
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

  it('harvesters work in every ruleset: the magnet pulls a rock in and drains it for its owner', () => {
    for (const profile of ['bionic', 'base'] as const) {
      const { w, step } = makeSim({ profile });
      addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
      const rock = addRock(w, { x: 22.5, y: 12.5, size: 1, thorium: ECON.rockThorium[1], state: 'landed' });
      const cash = w.players[0].thorium;
      step();
      expect(rock.state).toBe('harvesting');
      const ev = step([], 60 * 6);
      const paid = Math.round(ECON.rockThorium[1] * mapThoriumFactor(w));
      expect(w.players[0].thorium).toBe(cash + paid);
      expect(ev).toContainEqual(expect.objectContaining({ t: 'rockSmashed', id: rock.id, thorium: paid, owner: 0 }));
      expect(w.rocks.includes(rock)).toBe(false);
    }
  });

  it('upgrading widens the magnet', () => {
    const { w, step } = makeSim();
    const h = addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
    const d = (harvesterRange(0) + harvesterRange(1)) / 2;
    const rock = addRock(w, { x: 20.5 + d, y: 12.5, size: 1, thorium: 15, state: 'landed' });
    step([], 30);
    expect(rock.state).toBe('landed');
    h.level = 1;
    step();
    expect(rock.state).toBe('harvesting');
  });

  it('bigger rocks take longer to harvest but pay more', () => {
    const harvest = (size: 1 | 3) => {
      const { w, step } = makeSim();
      addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
      addRock(w, { x: 20.5, y: 12.5, size, thorium: ECON.rockThorium[size], state: 'landed' });
      const cash = w.players[0].thorium;
      let ticks = 0;
      while (w.rocks.length > 0 && ticks < 60 * 60) {
        step();
        ticks++;
      }
      return { ticks, paid: w.players[0].thorium - cash };
    };
    const small = harvest(1);
    const big = harvest(3);
    expect(big.ticks).toBeGreaterThan(small.ticks * 2);
    expect(big.paid).toBeGreaterThan(small.paid * 3);
  });

  it('the magnet ignores a towed rock until it is dropped inside the range', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
    p.ship.x = 21.5;
    p.ship.y = 12.5;
    const rock = addRock(w, { x: 21.5, y: 12.5, size: 1, thorium: 15, state: 'landed' });
    step([{ t: 'grab', player: 0 }], 30);
    expect(rock.state).toBe('grabbed');
    step([{ t: 'drop', player: 0 }], 2);
    expect(rock.state).toBe('harvesting');
  });

  it('a harvester destroyed mid-harvest drops its rock', () => {
    const { w, step } = makeSim();
    const h = addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
    const rock = addRock(w, { x: 21.5, y: 12.5, size: 3, thorium: ECON.rockThorium[3], state: 'landed' });
    step([], 90);
    expect(rock.state).toBe('harvesting');
    w.structures.delete(h.id);
    step();
    expect(rock.state).toBe('landed');
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

describe('ship health', () => {
  const at = (w: ReturnType<typeof makeSim>['w'], x: number, y: number) => {
    const s = w.players[0].ship;
    s.x = x;
    s.y = y;
    return s;
  };

  it('dies at 0 hp, drops its rock with the ship velocity, respawns at its base after the delay with less max hp', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    p.baseBuilt = true;
    const s = at(w, 10, 10);
    const rock = addRock(w, { x: 10.5, y: 10, size: 1, thorium: 15, state: 'landed' });
    step([{ t: 'grab', player: 0 }]);
    step([move(1, 0)], 20);
    s.maxHp = 55;
    s.hp = 5;
    const vx = s.vx;
    const ev: (typeof w.events)[number][] = [];
    expect(damageShip(w, 0, 10, 1, (e) => ev.push(e))).toBe(true);
    expect(ev).toContainEqual(expect.objectContaining({ t: 'shipDestroyed', owner: 0, killer: 1 }));
    expect(s.dead).toBe(true);
    expect(s.maxHp).toBe(35);
    expect(s.carrying).toBe(0);
    expect(rock.state).toBe('drifting');
    expect(rock.vx).toBeCloseTo(vx);
    const ticks = Math.round(SHIP_RESPAWN_S * 60);
    step([], ticks - 2);
    expect(s.dead).toBe(true);
    const back = step([], 2);
    expect(back).toContainEqual(expect.objectContaining({ t: 'shipRespawned', owner: 0, hp: 35, maxHp: 35 }));
    expect([s.dead, s.hp, s.x, s.y, s.vx, s.vy]).toEqual([false, 35, p.baseTx + 0.5, p.baseTy + 0.5, 0, 0]);
    s.hp = 1;
    damageShip(w, 0, 5, -1, () => {});
    expect(s.maxHp).toBe(SHIP_HP_START);
  });

  it('a dead ship ignores move and grab input and cannot be damaged', () => {
    const { w, step } = makeSim();
    const s = at(w, 10, 10);
    const rock = addRock(w, { x: 10.5, y: 10, size: 1, thorium: 15, state: 'landed' });
    damageShip(w, 0, 1000, -1, () => {});
    step([move(1, 0), { t: 'grab', player: 0 }], 30);
    expect([s.x, s.y, s.carrying, rock.state]).toEqual([10, 10, 0, 'landed']);
    expect(damageShip(w, 0, 5, -1, () => {})).toBe(false);
  });

  it('heals over its own base: full in SHIP_FULL_HEAL_S, flagged while healing', () => {
    const { w, step } = makeSim();
    const p = w.players[0];
    p.baseBuilt = true;
    const s = at(w, p.baseTx + 0.5, p.baseTy + 0.5);
    s.maxHp = SHIP_HP_CAP;
    s.hp = 0.001;
    step();
    expect(s.healing).toBe(true);
    step([], Math.round(SHIP_FULL_HEAL_S * 60) - 2);
    expect(s.hp).toBeLessThan(SHIP_HP_CAP);
    step([], 3);
    expect(s.hp).toBe(SHIP_HP_CAP);
    expect(s.healing).toBe(false);
    s.hp = 50;
    at(w, p.baseTx + 3.5, p.baseTy + 0.5);
    step([], 60);
    expect([s.hp, s.healing]).toEqual([50, false]);
  });

  it('a full harvest flies a money token; big rocks often drop health tokens that raise max hp up to the cap', () => {
    const { w, step } = makeSim();
    const s = w.players[0].ship;
    addStructure(w, { kind: 'harvester', owner: 0, tx: 20, ty: 12, hp: 10, buildProgress: 1 });
    let health = 0;
    let money = 0;
    for (let i = 0; i < 12; i++) {
      addRock(w, { x: 20.5, y: 12.5, size: 3, thorium: 1, state: 'landed' });
      for (const e of step([], 120)) {
        if (e.t !== 'token') continue;
        if (e.kind === 'money') money++;
        else health++;
      }
    }
    expect(money).toBe(12);
    expect(health).toBeGreaterThanOrEqual(8);
    expect(s.maxHp).toBe(SHIP_HP_CAP);
    expect(s.hp).toBeLessThanOrEqual(s.maxHp);
  });
});