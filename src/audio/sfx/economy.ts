import { tone, sweep, noiseBurst, fmBlip } from '../synth';
import type { Player } from '../synth';

export const economySounds = {
  rockGrab: (o) => {
    sweep(o, 200, 520, 0.12, 'triangle', { peak: 0.16 });
    noiseBurst(o, 0.06, { type: 'bandpass', f: 900, q: 2 }, { peak: 0.1 });
  },
  rockSmash: (o) => {
    noiseBurst(o, 0.3, { type: 'bandpass', f: 1400, to: 300, q: 0.8 }, { peak: 0.3 });
    sweep(o, 220, 60, 0.2, 'square', { peak: 0.15 });
    noiseBurst(o, 0.12, { type: 'highpass', f: 3500 }, { delay: 0.05, peak: 0.12 });
  },
  thorium: (o) => {
    tone(o, 1318, 0.35, 'sine', { peak: 0.14 });
    fmBlip(o, 1975, 3.5, 0.6, 0.3, { delay: 0.05, peak: 0.07 });
  },
} satisfies Record<string, Player>;
