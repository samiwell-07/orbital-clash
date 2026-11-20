import { describe, it, expect } from 'vitest';
import { SCALES, makeRng, midiToFreq, scaleNote } from '../../src/audio/music-theory';
import { buildPattern, createSequencer, BARS, STEPS_PER_BAR } from '../../src/audio/music-pattern';

describe('music theory', () => {
  it('converts midi to frequency', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(57)).toBeCloseTo(220);
  });

  it('walks scale degrees across octaves, including negatives', () => {
    const s = SCALES.minor;
    expect(scaleNote(40, s, 0)).toBe(40);
    expect(scaleNote(40, s, 2)).toBe(43);
    expect(scaleNote(40, s, 7)).toBe(52);
    expect(scaleNote(40, s, 9)).toBe(55);
    expect(scaleNote(40, s, -1)).toBe(40 - 12 + 10);
  });

  it('seeded rng is deterministic and in range', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seq = Array.from({ length: 50 }, () => a());
    expect(seq).toEqual(Array.from({ length: 50 }, () => b()));
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(makeRng(43)()).not.toBe(seq[0]);
  });
});

describe('pattern', () => {
  it('is deterministic per seed, and differs by mode', () => {
    expect(buildPattern('game', 9)).toEqual(buildPattern('game', 9));
    expect(buildPattern('game', 9)).not.toEqual(buildPattern('menu', 9));
    expect(buildPattern('game', 9)).not.toEqual(buildPattern('game', 10));
  });

  it('is exactly BARS bars with a root bass and pad on every bar start', () => {
    for (const mode of ['menu', 'game'] as const) {
      const p = buildPattern(mode, 1337);
      expect(p.steps).toHaveLength(BARS * STEPS_PER_BAR);
      for (let b = 0; b < BARS; b++) {
        const s = p.steps[b * STEPS_PER_BAR];
        expect(s.pad).toHaveLength(3);
        expect(s.bass).toBeDefined();
      }
      expect(p.steps[0].bass).toBe(mode === 'game' ? 40 : 45);
    }
  });

  it('game mode is faster and denser than menu mode', () => {
    const g = buildPattern('game', 1);
    const m = buildPattern('menu', 1);
    expect(g.bpm).toBeGreaterThan(m.bpm);
    expect(g.steps.filter((s) => s.kick).length).toBeGreaterThan(0);
    expect(m.steps.some((s) => s.kick)).toBe(false);
  });
});

describe('sequencer', () => {
  it('schedules only steps before the horizon, without gaps or repeats', () => {
    const p = buildPattern('game', 1);
    const seq = createSequencer(p, 10);
    const first = seq.pull(10 + p.stepSec * 3.5);
    expect(first.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(first[0].time).toBe(10);
    expect(seq.pull(10 + p.stepSec * 3.5)).toEqual([]);
    const next = seq.pull(10 + p.stepSec * 5.5);
    expect(next.map((s) => s.index)).toEqual([4, 5]);
    expect(next[0].time).toBeCloseTo(10 + p.stepSec * 4);
  });

  it('loops seamlessly after the pattern ends', () => {
    const p = buildPattern('menu', 7);
    const seq = createSequencer(p, 0);
    const all = seq.pull(p.stepSec * (p.steps.length + 2) - 0.0001);
    expect(all).toHaveLength(p.steps.length + 2);
    expect(all[p.steps.length].step).toBe(p.steps[0]);
    expect(all[p.steps.length + 1].step).toBe(p.steps[1]);
  });
});
