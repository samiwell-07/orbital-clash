// Pure pattern generation and look-ahead sequencing for the procedural music.
import { SCALES, makeRng, scaleNote } from './music-theory';
import type { ScaleName } from './music-theory';

export type MusicMode = 'menu' | 'game';

export interface Step {
  /** MIDI notes. */
  bass?: number;
  arp?: number;
  pad?: readonly number[];
  kick?: boolean;
  snare?: boolean;
  hat?: boolean;
}

export interface Pattern {
  bpm: number;
  stepSec: number;
  steps: readonly Step[];
}

export const STEPS_PER_BAR = 16;
export const BARS = 4;

interface Profile { bpm: number; scale: ScaleName; root: number; salt: number }

const PROFILES: Record<MusicMode, Profile> = {
  menu: { bpm: 84, scale: 'dorian', root: 45, salt: 0x51 },
  game: { bpm: 126, scale: 'minor', root: 40, salt: 0xa7 },
};

function buildProgression(rng: () => number): number[] {
  const pool = [5, 3, 6, 4, 2];
  const prog = [0];
  while (prog.length < BARS) {
    const prev = prog[prog.length - 1];
    const choices = (prog.length === BARS - 1 ? [6, 4, 5] : pool).filter((d) => d !== prev);
    prog.push(choices[Math.floor(rng() * choices.length)]);
  }
  return prog;
}

/** Deterministic: the same (mode, seed) always yields the same loop. The loop is exactly BARS bars long. */
export function buildPattern(mode: MusicMode, seed: number): Pattern {
  const p = PROFILES[mode];
  const rng = makeRng((seed ^ Math.imul(p.salt, 0x9e3779b1)) >>> 0);
  const scale = SCALES[p.scale];
  const prog = buildProgression(rng);
  const arpOrder = Array.from({ length: 8 }, () => Math.floor(rng() * 4));
  const game = mode === 'game';
  const steps: Step[] = [];
  for (let bar = 0; bar < BARS; bar++) {
    const deg = prog[bar];
    const chord = [0, 2, 4, 7].map((d) => scaleNote(p.root + 12, scale, deg + d));
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const step: Step = {};
      if (s === 0) step.pad = chord.slice(0, 3);
      const bassHit = game ? s % 2 === 0 : s % 8 === 0;
      if (bassHit) step.bass = scaleNote(p.root, scale, deg) + (game && s % 8 === 6 ? 12 : 0);
      const arpHit = game ? rng() < 0.88 : s % 2 === 0 && rng() < 0.6;
      if (arpHit) step.arp = chord[arpOrder[s % 8]] + (s >= 8 && game ? 12 : 0);
      if (game) {
        step.kick = s % 4 === 0;
        step.snare = s % 8 === 4;
        step.hat = s % 4 === 2;
      } else step.hat = s % 8 === 4;
      steps.push(step);
    }
  }
  return { bpm: p.bpm, stepSec: 60 / p.bpm / 4, steps };
}

export interface ScheduledStep { time: number; index: number; step: Step }

export interface Sequencer {
  /** Returns every step whose start time is before `until`, advancing the cursor. */
  pull(until: number): ScheduledStep[];
}

export function createSequencer(pattern: Pattern, startTime: number): Sequencer {
  let next = startTime;
  let index = 0;
  return {
    pull(until) {
      const out: ScheduledStep[] = [];
      while (next < until) {
        out.push({ time: next, index, step: pattern.steps[index % pattern.steps.length] });
        next += pattern.stepSec;
        index++;
      }
      return out;
    },
  };
}
