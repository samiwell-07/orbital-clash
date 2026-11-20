import { tone, sweep, noiseBurst, fmBlip } from '../synth';
import type { Player } from '../synth';

export const weaponSounds = {
  turretShot: (o) => {
    sweep(o, 520, 90, 0.09, 'square', { peak: 0.16 });
    noiseBurst(o, 0.05, { type: 'highpass', f: 2500 }, { peak: 0.1 });
  },
  laserBeam: (o) => {
    tone(o, 110, 0.32, 'sawtooth', { a: 0.06, peak: 0.08 });
    tone(o, 221, 0.32, 'sine', { a: 0.06, peak: 0.08, detune: 9 });
    sweep(o, 1900, 1300, 0.3, 'triangle', { a: 0.08, peak: 0.03 });
  },
  pulsarPulse: (o) => {
    sweep(o, 900, 160, 0.24, 'sine', { peak: 0.24 });
    fmBlip(o, 300, 2.5, 3, 0.2, { peak: 0.1 });
  },
  bomberBomb: (o) => {
    sweep(o, 1500, 320, 0.45, 'sine', { a: 0.1, peak: 0.08 });
    sweep(o, 130, 32, 0.55, 'sine', { delay: 0.45, peak: 0.4 });
    noiseBurst(o, 0.5, { type: 'lowpass', f: 1100, to: 90 }, { delay: 0.45, peak: 0.3 });
  },
} satisfies Record<string, Player>;
