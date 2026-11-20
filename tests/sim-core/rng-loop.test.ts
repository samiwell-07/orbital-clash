import { describe, expect, it } from 'vitest';
import { TICK_DT, MAX_STEPS_PER_FRAME } from '@/config/constants';
import { FixedStepLoop } from '@/sim/core/loop';
import { pick, rand, randInt, randRange } from '@/sim/core/rng';
import { makeWorld } from './helpers';

describe('rng', () => {
  it('is deterministic per seed and stays in range', () => {
    const a = makeWorld();
    const b = makeWorld();
    const sa = Array.from({ length: 50 }, () => rand(a));
    const sb = Array.from({ length: 50 }, () => rand(b));
    expect(sa).toEqual(sb);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
    const c = makeWorld({ seed: 99 });
    expect(rand(c)).not.toBe(sa[0]);
  });

  it('randInt is inclusive, randRange and pick work', () => {
    const w = makeWorld();
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(w, 1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    const r = randRange(w, 5, 6);
    expect(r).toBeGreaterThanOrEqual(5);
    expect(r).toBeLessThan(6);
    expect(['a', 'b']).toContain(pick(w, ['a', 'b']));
  });
});

describe('FixedStepLoop', () => {
  it('runs whole ticks and returns remainder alpha', () => {
    const loop = new FixedStepLoop();
    let n = 0;
    const alpha = loop.advance(TICK_DT * 2.5, () => n++);
    expect(n).toBe(2);
    expect(alpha).toBeCloseTo(0.5, 5);
    loop.advance(TICK_DT * 0.5, () => n++);
    expect(n).toBe(3);
  });

  it('caps steps per frame and drops the backlog', () => {
    const loop = new FixedStepLoop();
    let n = 0;
    const alpha = loop.advance(10, () => n++);
    expect(n).toBe(MAX_STEPS_PER_FRAME);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
    n = 0;
    loop.advance(TICK_DT, () => n++);
    expect(n).toBe(1);
  });
});
