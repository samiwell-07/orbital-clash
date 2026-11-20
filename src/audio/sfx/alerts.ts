import { tone } from '../synth';
import type { Out, Player } from '../synth';

function arpeggio(o: Out, notes: number[], gap: number, dur: number, type: OscillatorType, peak: number): void {
  notes.forEach((f, i) => tone(o, f, dur, type, { delay: i * gap, peak }));
}

export const alertSounds = {
  baseAlarm: (o) => {
    for (let i = 0; i < 3; i++) {
      tone(o, 880, 0.14, 'square', { delay: i * 0.22, peak: 0.12 });
      tone(o, 660, 0.14, 'square', { delay: i * 0.22 + 0.11, peak: 0.12 });
    }
  },
  timeUp: (o) => {
    arpeggio(o, [988, 740, 988, 740], 0.18, 0.15, 'square', 0.1);
  },
  victory: (o) => {
    arpeggio(o, [392, 523, 659, 784, 1046], 0.13, 0.4, 'triangle', 0.16);
    arpeggio(o, [196, 262, 330], 0.13, 1.2, 'sawtooth', 0.05);
    tone(o, 1046, 1.4, 'sine', { delay: 0.7, peak: 0.12 });
  },
  defeat: (o) => {
    arpeggio(o, [392, 349, 311, 262], 0.28, 0.6, 'triangle', 0.15);
    tone(o, 65, 1.8, 'sawtooth', { delay: 0.7, a: 0.2, peak: 0.12 });
  },
} satisfies Record<string, Player>;
