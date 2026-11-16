import type { SfxName } from '../types';

const MASTER_GAIN = 0.35;
const MAX_VOICES = 24;
const DEFAULT_THROTTLE_MS = 30;
const THROTTLE_MS: Partial<Record<SfxName, number>> = {
  laser: 50,
  cannon: 60,
  cryo: 70,
  plasma: 70,
  explosion: 70,
  bigExplosion: 120,
  cash: 80,
  pickup: 60,
  drop: 60,
  queue: 40,
  baseHit: 120,
  meteor: 150,
  research: 200,
};

type Ctx = AudioContext;

/** Procedural WebAudio sound effects (no asset files). Safe to call before unlock (no-op). */
export class AudioFx {
  muted = false;
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = 0;
  private lastPlayed = new Map<SfxName, number>();

  /** Must be called from a user gesture (keydown/click) to create/resume the AudioContext. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const Ctor = g.AudioContext ?? g.webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : MASTER_GAIN;
        master.connect(comp);
        comp.connect(ctx.destination);
        this.ctx = ctx;
        this.master = master;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  /** Plays a synthesized effect; internally rate-limits rapid repeats of the same sound. */
  play(name: SfxName, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return;
    if (this.voices >= MAX_VOICES) return;
    const nowMs = ctx.currentTime * 1000;
    const last = this.lastPlayed.get(name);
    const throttle = THROTTLE_MS[name] ?? DEFAULT_THROTTLE_MS;
    if (last !== undefined && nowMs - last < throttle) return;
    this.lastPlayed.set(name, nowMs);
    const v = Math.max(0, Math.min(2, volume));
    try {
      this.render(name, ctx, ctx.currentTime + 0.005, v);
    } catch {
      // Ignore synthesis failures (e.g. closed context).
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx && this.master) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, t, 0.02);
    }
    return this.muted;
  }

  // ------------------------------------------------------------ building blocks

  private noiseBuffer(ctx: Ctx): AudioBuffer {
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 1.0);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      // Cosmetic noise only; deterministic gameplay RNG is not involved.
      let seed = 0x12345678;
      for (let i = 0; i < len; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = (seed / 4294967296) * 2 - 1;
      }
      this.noise = buf;
    }
    return this.noise;
  }

  /** Registers a source as a voice and disconnects the whole chain when it ends. */
  private track(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.voices++;
    src.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
      src.disconnect();
      for (const n of nodes) n.disconnect();
    };
  }

  private envGain(ctx: Ctx, t: number, peak: number, attack: number, dur: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  private tone(
    ctx: Ctx,
    type: OscillatorType,
    t: number,
    dur: number,
    f0: number,
    f1: number,
    peak: number,
    attack = 0.005,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.envGain(ctx, t, peak, attack, dur);
    osc.connect(g);
    g.connect(this.master!);
    this.track(osc, [g]);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noiseBurst(
    ctx: Ctx,
    t: number,
    dur: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    peak: number,
    q = 1,
    attack = 0.004,
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.envGain(ctx, t, peak, attack, dur);
    src.connect(bq);
    bq.connect(g);
    g.connect(this.master!);
    this.track(src, [bq, g]);
    src.start(t, ctx.currentTime % 0.5);
    src.stop(t + dur + 0.02);
  }

  private arpeggio(ctx: Ctx, t: number, freqs: readonly number[], step: number, type: OscillatorType, peak: number): void {
    freqs.forEach((f, i) => this.tone(ctx, type, t + i * step, step * 1.8, f, f, peak));
  }

  // ------------------------------------------------------------ recipes

  private render(name: SfxName, ctx: Ctx, t: number, v: number): void {
    switch (name) {
      case 'laser':
        this.tone(ctx, 'square', t, 0.08, 1900, 650, 0.12 * v);
        this.tone(ctx, 'sawtooth', t, 0.06, 2600, 900, 0.05 * v);
        break;
      case 'plasma':
        this.noiseBurst(ctx, t, 0.07, 'highpass', 6000, 3200, 0.16 * v, 3, 0.002);
        this.tone(ctx, 'sawtooth', t, 0.05, 3400, 2600, 0.035 * v, 0.002);
        break;
      case 'cannon':
        this.tone(ctx, 'sine', t, 0.25, 160, 45, 0.6 * v);
        this.noiseBurst(ctx, t, 0.15, 'lowpass', 1800, 300, 0.3 * v);
        break;
      case 'cryo':
        this.noiseBurst(ctx, t, 0.35, 'bandpass', 5000, 2500, 0.18 * v, 6, 0.02);
        this.tone(ctx, 'sine', t, 0.3, 2400, 3100, 0.07 * v, 0.02);
        this.tone(ctx, 'sine', t + 0.04, 0.26, 3600, 3300, 0.04 * v, 0.02);
        break;
      case 'explosion':
        this.noiseBurst(ctx, t, 0.45, 'lowpass', 2400, 180, 0.5 * v);
        this.tone(ctx, 'sine', t, 0.3, 110, 40, 0.35 * v);
        break;
      case 'bigExplosion':
        this.noiseBurst(ctx, t, 1.1, 'lowpass', 1400, 70, 0.75 * v, 0.8, 0.01);
        this.tone(ctx, 'sine', t, 0.8, 80, 28, 0.6 * v);
        break;
      case 'build':
        this.arpeggio(ctx, t, [392, 523, 659, 784], 0.05, 'triangle', 0.18 * v);
        break;
      case 'upgrade':
        this.arpeggio(ctx, t, [523, 659, 784, 1047, 1319], 0.045, 'square', 0.08 * v);
        break;
      case 'sell':
        this.arpeggio(ctx, t, [784, 659, 523, 392], 0.05, 'triangle', 0.16 * v);
        break;
      case 'error':
        this.tone(ctx, 'sawtooth', t, 0.22, 110, 95, 0.15 * v);
        this.tone(ctx, 'square', t, 0.22, 116, 100, 0.08 * v);
        break;
      case 'pickup':
        this.tone(ctx, 'square', t, 0.07, 660, 1320, 0.1 * v);
        break;
      case 'drop':
        this.tone(ctx, 'square', t, 0.08, 880, 330, 0.1 * v);
        break;
      case 'cash':
        this.tone(ctx, 'square', t, 0.07, 988, 988, 0.09 * v);
        this.tone(ctx, 'square', t + 0.07, 0.22, 1319, 1319, 0.09 * v);
        break;
      case 'meteor':
        this.noiseBurst(ctx, t, 0.9, 'bandpass', 3500, 250, 0.3 * v, 2, 0.15);
        this.tone(ctx, 'sine', t, 0.9, 900, 120, 0.06 * v, 0.1);
        break;
      case 'baseHit':
        for (let i = 0; i < 3; i++) this.tone(ctx, 'square', t + i * 0.12, 0.1, i % 2 === 0 ? 880 : 660, i % 2 === 0 ? 880 : 660, 0.12 * v);
        break;
      case 'wave':
        this.tone(ctx, 'sawtooth', t, 0.7, 180, 360, 0.16 * v, 0.08);
        this.tone(ctx, 'sawtooth', t, 0.7, 270, 540, 0.1 * v, 0.08);
        break;
      case 'queue':
        this.tone(ctx, 'square', t, 0.03, 1500, 1500, 0.06 * v, 0.002);
        break;
      case 'research':
        this.arpeggio(ctx, t, [523, 659, 784, 1047, 1319], 0.06, 'sine', 0.12 * v);
        this.tone(ctx, 'triangle', t + 0.3, 0.7, 1568, 1568, 0.06 * v, 0.02);
        this.tone(ctx, 'triangle', t + 0.3, 0.7, 1576, 1576, 0.05 * v, 0.02);
        this.noiseBurst(ctx, t + 0.1, 0.6, 'bandpass', 7000, 9000, 0.05 * v, 8, 0.1);
        break;
      case 'menuMove':
        this.tone(ctx, 'square', t, 0.04, 700, 700, 0.06 * v, 0.002);
        break;
      case 'menuSelect':
        this.tone(ctx, 'square', t, 0.05, 700, 700, 0.08 * v, 0.002);
        this.tone(ctx, 'square', t + 0.05, 0.09, 1050, 1050, 0.08 * v, 0.002);
        break;
      case 'victory':
        this.arpeggio(ctx, t, [523, 659, 784, 1047], 0.12, 'triangle', 0.2 * v);
        this.tone(ctx, 'triangle', t + 0.48, 0.6, 1047, 1047, 0.2 * v, 0.01);
        this.tone(ctx, 'triangle', t + 0.48, 0.6, 1319, 1319, 0.12 * v, 0.01);
        break;
      case 'defeat':
        this.arpeggio(ctx, t, [392, 330, 277], 0.18, 'sawtooth', 0.1 * v);
        this.tone(ctx, 'sawtooth', t + 0.54, 0.8, 220, 140, 0.12 * v, 0.01);
        break;
    }
  }
}
