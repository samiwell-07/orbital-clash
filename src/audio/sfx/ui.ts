import { tone, sweep } from '../synth';
import type { Player } from '../synth';

export const uiSounds = {
  uiMove: (o) => {
    tone(o, 880, 0.03, 'square', { peak: 0.06 });
  },
  uiConfirm: (o) => {
    tone(o, 660, 0.07, 'square', { peak: 0.1 });
    tone(o, 990, 0.12, 'square', { delay: 0.06, peak: 0.1 });
  },
  uiBack: (o) => {
    tone(o, 600, 0.07, 'square', { peak: 0.09 });
    tone(o, 400, 0.1, 'square', { delay: 0.06, peak: 0.09 });
  },
  uiDenied: (o) => {
    sweep(o, 150, 110, 0.2, 'sawtooth', { peak: 0.14 });
    tone(o, 155, 0.2, 'square', { peak: 0.06, detune: 40 });
  },
} satisfies Record<string, Player>;
