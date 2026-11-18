import { tone, sweep, noiseBurst, fmBlip } from '../synth';
import type { Player } from '../synth';

export const unitSounds = {
  spawn: (o) => {
    fmBlip(o, 660, 2, 1.5, 0.08, { peak: 0.12 });
  },
  launch: (o) => {
    noiseBurst(o, 0.28, { type: 'bandpass', f: 400, to: 2600, q: 2 }, { a: 0.1, peak: 0.16 });
    sweep(o, 200, 700, 0.25, 'triangle', { peak: 0.08 });
  },
  unitDeath: (o) => {
    sweep(o, 480, 90, 0.12, 'square', { peak: 0.14 });
    noiseBurst(o, 0.08, { type: 'highpass', f: 1800 }, { peak: 0.1 });
  },
  hammerSmash: (o) => {
    sweep(o, 180, 40, 0.3, 'sine', { peak: 0.45 });
    noiseBurst(o, 0.25, { type: 'lowpass', f: 1500, to: 120 }, { peak: 0.3 });
    tone(o, 1200, 0.1, 'square', { peak: 0.06 });
  },
  switchClick: (o) => {
    tone(o, 1800, 0.03, 'square', { peak: 0.1 });
    tone(o, 1200, 0.04, 'square', { delay: 0.05, peak: 0.1 });
  },
  thiefSneak: (o) => {
    noiseBurst(o, 0.3, { type: 'bandpass', f: 3000, to: 800, q: 4 }, { a: 0.12, peak: 0.07 });
    sweep(o, 300, 180, 0.3, 'triangle', { a: 0.1, peak: 0.05 });
  },
  carrierHum: (o) => {
    tone(o, 70, 0.6, 'sawtooth', { a: 0.2, peak: 0.07 });
    tone(o, 105, 0.6, 'sine', { a: 0.2, peak: 0.07, detune: 6 });
  },
  torpedo: (o) => {
    noiseBurst(o, 0.4, { type: 'lowpass', f: 3000, to: 300 }, { a: 0.03, peak: 0.2 });
    sweep(o, 500, 120, 0.4, 'sawtooth', { peak: 0.09 });
  },
} satisfies Record<string, Player>;
