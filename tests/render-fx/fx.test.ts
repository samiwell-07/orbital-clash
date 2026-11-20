import { describe, expect, it } from 'vitest';
import { FloatRing, RingPool } from '@/render/fx/pool';
import { computeLod, FxBudget, PopBatcher } from '@/render/fx/budget';
import { createCmd, routeEvent, type Pos, type RouteEnv } from '@/render/fx/eventRouter';
import { hexToLinear, lifeAlpha, lifeColor, lifeSize } from '@/render/fx/particleMaterial';
import { mixHex } from '@/render/fx/palette';
import { createRng, type Fx, type PointSink, type QuadSink } from '@/render/fx/types';
import { emitRockBurst } from '@/render/fx/emitters/thorium';
import { emitExplosion } from '@/render/fx/emitters/explosion';
import { BeamTracker } from '@/render/fx/emitters/beams';

describe('RingPool', () => {
  it('wraps and overwrites the oldest slot', () => {
    const p = new RingPool(3);
    expect([p.alloc(), p.alloc(), p.alloc(), p.alloc()]).toEqual([0, 1, 2, 0]);
  });

  it('tracks a partial dirty range and widens to everything on wrap', () => {
    const p = new RingPool(8);
    p.alloc(); p.alloc(); p.alloc();
    expect([p.dirtyStart, p.dirtyCount]).toEqual([0, 3]);
    p.clearDirty();
    expect(p.dirty).toBe(false);
    p.alloc(); p.alloc();
    expect([p.dirtyStart, p.dirtyCount]).toEqual([3, 2]);
    p.clearDirty();
    for (let i = 0; i < 5; i++) p.alloc();
    expect(p.dirtyCount).toBe(8);
  });

  it('rejects invalid capacity and sizes FloatRing arrays by stride', () => {
    expect(() => new RingPool(0)).toThrow();
    const f = new FloatRing(10, [3, 4]);
    expect(f.arrays.map((a) => a.length)).toEqual([30, 40]);
  });
});

function stubEnv(): RouteEnv {
  return {
    structurePos: (id: number, out: Pos) => (id === 7 ? ((out.x = 3.5), (out.y = 4.5), true) : false),
    basePos: (owner: number, out: Pos) => (owner === 0 ? ((out.x = 10.5), (out.y = 2.5), true) : false),
    shipPos: (owner: number, out: Pos) => (owner === 0 ? ((out.x = 5), (out.y = 6), true) : false),
    hitsFrac: () => 0.4,
  };
}

describe('routeEvent', () => {
  const env = stubEnv();
  const out = createCmd();

  it('maps combat events', () => {
    expect(routeEvent({ t: 'explosion', x: 1, y: 2, radius: 1.2, big: true }, env, out)).toBe(true);
    expect(out).toMatchObject({ kind: 'explosion', x: 1, y: 2, n: 1.2, big: true });
    routeEvent({ t: 'shot', from: 1, kind: 'bomber', x: 1, y: 1, tx: 4, ty: 5 }, env, out);
    expect(out).toMatchObject({ kind: 'shot', sub: 'bomber', tx: 4, ty: 5 });
    routeEvent({ t: 'beam', owner: 2, x: 1, y: 1, tx: 2, ty: 2 }, env, out);
    expect(out).toMatchObject({ kind: 'beam', owner: 2 });
    routeEvent({ t: 'unitDied', id: 1, kind: 'tank', owner: 1, x: 5, y: 6, killer: 0 }, env, out);
    expect(out).toMatchObject({ kind: 'unitPop', owner: 1, x: 5, y: 6 });
  });

  it('resolves positions through the env and skips unresolved ones', () => {
    routeEvent({ t: 'unitSpawned', owner: 0, kind: 'scout', fromId: 7 }, env, out);
    expect(out).toMatchObject({ kind: 'teleport', x: 3.5, y: 4.5 });
    expect(routeEvent({ t: 'unitSpawned', owner: 0, kind: 'scout', fromId: 99 }, env, out)).toBe(false);
    routeEvent({ t: 'baseHit', target: 0, attacker: 1, hitsLeft: 3 }, env, out);
    expect(out).toMatchObject({ kind: 'baseHit', x: 10.5, y: 2.5, n: 0.4, owner: 0 });
    expect(routeEvent({ t: 'baseDestroyed', target: 3, attacker: -1 }, env, out)).toBe(false);
  });

  it('sends rock thorium toward the owner base, or NaN when unknown', () => {
    routeEvent({ t: 'rockSmashed', id: 1, x: 5, y: 5, thorium: 80, owner: 0 }, env, out);
    expect([out.kind, out.tx, out.ty, out.n]).toEqual(['rockBurst', 10.5, 2.5, 80]);
    routeEvent({ t: 'rockSmashed', id: 1, x: 5, y: 5, thorium: 80, owner: 2 }, env, out);
    expect(Number.isNaN(out.tx)).toBe(true);
  });

  it('ignores events without visuals', () => {
    expect(routeEvent({ t: 'message', text: 'hi', owner: -1 }, env, out)).toBe(false);
    expect(routeEvent({ t: 'timeUp' }, env, out)).toBe(false);
  });
});

describe('FxBudget', () => {
  it('caps events per frame and refills over time', () => {
    const b = new FxBudget();
    b.beginFrame(0, 0);
    let ok = 0;
    for (let i = 0; i < 100; i++) if (b.allow('hitSparks')) ok++;
    expect(ok).toBe(10);
    b.beginFrame(0.016, 0);
    expect(b.allow('hitSparks')).toBe(true);
  });

  it('drains the token bucket under sustained spam', () => {
    const b = new FxBudget();
    let total = 0;
    for (let f = 0; f < 120; f++) {
      b.beginFrame(f / 60, 0);
      for (let i = 0; i < 10; i++) if (b.allow('hitSparks')) total++;
    }
    expect(total).toBeLessThan(50 * 2 + 14 + 1);
    expect(total).toBeGreaterThan(50);
  });

  it('lowers LOD under load but never below a quarter', () => {
    expect(computeLod(0, 0)).toBe(1);
    expect(computeLod(40, 0)).toBeCloseTo(0.5);
    expect(computeLod(5000, 5000)).toBe(0.25);
    expect(computeLod(0, 1600)).toBeLessThan(1);
  });
});

describe('PopBatcher', () => {
  it('merges thousands of deaths into one pop per cell per interval', () => {
    const pops = new PopBatcher(0.1);
    const seen: number[][] = [];
    for (let i = 0; i < 3000; i++) pops.add(5 + (i % 3) * 0.1, 5, 1);
    pops.add(20, 20, 0);
    pops.flush(1, (x, y, n, o) => seen.push([x, y, n, o]));
    expect(seen).toHaveLength(2);
    expect(seen.find((s) => s[3] === 1)![2]).toBe(3000);
    pops.add(5, 5, 1);
    pops.flush(1.05, () => seen.push([]));
    expect(seen).toHaveLength(2);
  });
});

describe('colour over life', () => {
  it('converts sRGB to linear and mixes hex', () => {
    const o = new Float32Array(3);
    hexToLinear(o, 0, 0xffffff);
    expect([o[0], o[1], o[2]]).toEqual([1, 1, 1]);
    hexToLinear(o, 0, 0x000000);
    expect(o[0]).toBe(0);
    expect(mixHex(0x000000, 0xff00ff, 0.5)).toBe(0x800080);
  });

  it('blends start to end colour and fades alpha', () => {
    const out = new Float32Array(3);
    lifeColor(out, [1, 1, 0], [1, 0, 0], 0, 0.5);
    expect(out[1]).toBe(1);
    lifeColor(out, [1, 1, 0], [1, 0, 0], 0.6, 0.5);
    expect(out[1]).toBe(0);
    expect(lifeAlpha(0, 1, 1)).toBe(0);
    expect(lifeAlpha(0.5, 1, 1)).toBeCloseTo(0.5);
    expect(lifeAlpha(1, 1, 1)).toBe(0);
    expect(lifeAlpha(-0.1, 1, 1)).toBe(0);
    expect(lifeSize(0.1, 0.3, 0.5)).toBeCloseTo(0.2);
  });
});

interface Rec { args: number[] }
function recorder(): PointSink & { rows: Rec[] } {
  const rows: Rec[] = [];
  return { rows, emit: (...args: number[]) => { rows.push({ args }); } } as PointSink & { rows: Rec[] };
}

function stubFx(shakes: number[] = []) {
  const sinks = { glow: recorder(), spark: recorder(), smoke: recorder(), shard: recorder() };
  const quad = (): QuadSink => ({ emit: () => {} });
  const fx: Fx = {
    ...sinks, ring: quad(), beam: quad(), tracer: quad(),
    live: { capacity: 48, set: () => {}, clear: () => {} },
    now: 0, lod: 1, rnd: createRng(5), shake: (a) => shakes.push(a), flash: () => {},
  };
  return { fx, sinks };
}

describe('emitters', () => {
  it('big explosions shake, small ones do not', () => {
    const shakes: number[] = [];
    const { fx } = stubFx(shakes);
    emitExplosion(fx, 1, 1, 1, false);
    expect(shakes).toHaveLength(0);
    emitExplosion(fx, 1, 1, 1, true);
    expect(shakes).toHaveLength(1);
  });

  it('lod scales particle counts down', () => {
    const a = stubFx();
    const b = stubFx();
    b.fx.lod = 0.25;
    emitExplosion(a.fx, 0, 0, 1, true);
    emitExplosion(b.fx, 0, 0, 1, true);
    expect(b.sinks.glow.rows.length).toBeLessThan(a.sinks.glow.rows.length);
  });

  it('thorium shards land exactly on the owner base', () => {
    const { fx, sinks } = stubFx();
    emitRockBurst(fx, 2, 3, 100, 12, 8);
    expect(sinks.shard.rows.length).toBeGreaterThanOrEqual(8);
    for (const { args } of sinks.shard.rows) {
      const [spawn, x, y, z, vx, vy, vz, life, , , , , , g] = args;
      expect(spawn).toBeGreaterThanOrEqual(0);
      expect(x + vx * life).toBeCloseTo(12, 3);
      expect(z + vz * life).toBeCloseTo(8, 3);
      expect(y + vy * life + 0.5 * g * life * life).toBeCloseTo(0.2, 3);
    }
  });
});

describe('BeamTracker', () => {
  it('keeps one slot per emitter and releases it after the hold time', () => {
    const sets: number[] = [];
    const clears: number[] = [];
    const { fx } = stubFx();
    fx.live = { capacity: 48, set: (s) => { sets.push(s); }, clear: (s) => { clears.push(s); } };
    const t = new BeamTracker();
    t.touch(0, 1, 1, 5, 5, 0);
    t.touch(0, 1, 1, 6, 6, 0.1);
    t.touch(1, 9, 9, 5, 5, 0.1);
    fx.now = 0.12;
    t.update(fx);
    expect(new Set(sets).size).toBe(2);
    fx.now = 1;
    t.update(fx);
    expect(clears.sort()).toEqual([0, 1]);
  });
});
