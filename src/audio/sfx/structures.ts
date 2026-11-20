import { tone, sweep, noiseBurst, fmBlip } from '../synth';
import type { Player } from '../synth';

export const structureSounds = {
  build: (o) => {
    tone(o, 330, 0.08, 'square', { peak: 0.1 });
    tone(o, 495, 0.1, 'square', { delay: 0.07, peak: 0.1 });
    noiseBurst(o, 0.1, { type: 'highpass', f: 4000 }, { delay: 0.14, peak: 0.08 });
  },
  upgrade: (o) => {
    [523, 659, 784, 1046].forEach((f, i) => tone(o, f, 0.25, 'triangle', { delay: i * 0.06, peak: 0.14 }));
    fmBlip(o, 1568, 3, 0.8, 0.4, { delay: 0.24, peak: 0.06 });
  },
  recycle: (o) => {
    sweep(o, 900, 200, 0.3, 'sawtooth', { peak: 0.1 });
    noiseBurst(o, 0.2, { type: 'bandpass', f: 2000, to: 400, q: 2 }, { peak: 0.1 });
  },
  repair: (o) => {
    [440, 440, 587].forEach((f, i) => tone(o, f, 0.07, 'square', { delay: i * 0.08, peak: 0.08 }));
    noiseBurst(o, 0.05, { type: 'highpass', f: 5000 }, { delay: 0.05, peak: 0.06 });
  },
  structureHit: (o) => {
    tone(o, 260, 0.06, 'square', { peak: 0.1 });
    noiseBurst(o, 0.05, { type: 'bandpass', f: 1500 }, { peak: 0.08 });
  },
  explosion: (o) => {
    sweep(o, 160, 45, 0.3, 'sine', { peak: 0.3 });
    noiseBurst(o, 0.3, { type: 'lowpass', f: 2200, to: 150 }, { peak: 0.22 });
  },
  explosionBig: (o) => {
    sweep(o, 120, 28, 0.8, 'sine', { peak: 0.5 });
    sweep(o, 80, 25, 0.9, 'sawtooth', { peak: 0.15 });
    noiseBurst(o, 0.9, { type: 'lowpass', f: 1800, to: 80 }, { peak: 0.4 });
    noiseBurst(o, 0.15, { type: 'highpass', f: 3000 }, { peak: 0.2 });
  },
} satisfies Record<string, Player>;
