// WebAudio playback of the procedural music: lookahead timer feeding a pure sequencer.
import { tone, sweep, noiseBurst } from './synth';
import type { Out } from './synth';
import type { AudioBus } from './context';
import { midiToFreq } from './music-theory';
import { buildPattern, createSequencer, STEPS_PER_BAR } from './music-pattern';
import type { MusicMode, Pattern, Step } from './music-pattern';

const LOOKAHEAD_SEC = 0.25;
const TICK_MS = 25;
const FADE_SEC = 1.2;
const SEEDS: Record<MusicMode, number> = { menu: 7, game: 1337 };

function playStep(o: Out, pattern: Pattern, step: Step, game: boolean): void {
  const sec = pattern.stepSec;
  if (step.pad) {
    for (const n of step.pad) {
      const f = midiToFreq(n);
      tone(o, f, sec * STEPS_PER_BAR * 0.98, 'sawtooth', { a: 0.8, peak: 0.03, detune: -7 });
      tone(o, f, sec * STEPS_PER_BAR * 0.98, 'sawtooth', { a: 0.8, peak: 0.03, detune: 7 });
    }
  }
  if (step.bass !== undefined) {
    const f = midiToFreq(step.bass);
    tone(o, f, sec * (game ? 1.8 : 6), 'triangle', { peak: 0.3 });
    tone(o, f, sec * (game ? 1.8 : 6), 'sawtooth', { peak: 0.05 });
  }
  if (step.arp !== undefined) {
    const f = midiToFreq(step.arp);
    tone(o, f, sec * 1.4, 'square', { peak: game ? 0.05 : 0.035 });
    tone(o, f, sec * 1.4, 'square', { delay: sec * 3, peak: 0.015 });
  }
  if (step.kick) sweep(o, 150, 40, 0.16, 'sine', { peak: 0.5 });
  if (step.snare) noiseBurst(o, 0.12, { type: 'highpass', f: 1800 }, { peak: 0.2 });
  if (step.hat) noiseBurst(o, 0.035, { type: 'highpass', f: 7000 }, { peak: 0.07 });
}

interface Session { gain: GainNode; timer: ReturnType<typeof setInterval> }

export interface Music {
  set(mode: MusicMode | 'off'): void;
  /** Start the desired mode if it was requested before the context was running. */
  resume(): void;
}

export function createMusic(getBus: () => AudioBus | null): Music {
  let mode: MusicMode | 'off' = 'off';
  let session: Session | null = null;

  function stop(): void {
    if (!session) return;
    const { gain, timer } = session;
    session = null;
    clearInterval(timer);
    const ctx = gain.context;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setTargetAtTime(0, ctx.currentTime, FADE_SEC / 4);
    setTimeout(() => gain.disconnect(), FADE_SEC * 1000 + 200);
  }

  function start(): void {
    const bus = getBus();
    if (!bus || mode === 'off' || session) return;
    const { ctx } = bus;
    const game = mode === 'game';
    const pattern = buildPattern(mode, SEEDS[mode]);
    const seq = createSequencer(pattern, ctx.currentTime + 0.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_SEC);
    gain.connect(bus.music);
    const tick = (): void => {
      const now = ctx.currentTime;
      for (const s of seq.pull(now + LOOKAHEAD_SEC)) {
        // After a throttled background tab, skip steps already in the past rather than burst them.
        if (s.time < now - 0.05) continue;
        playStep({ ctx, dest: gain, t: s.time, vol: 1 }, pattern, s.step, game);
      }
    };
    session = { gain, timer: setInterval(tick, TICK_MS) };
    tick();
  }

  return {
    set(next) {
      if (next === mode && (session || next === 'off')) return;
      mode = next;
      stop();
      start();
    },
    resume: start,
  };
}
