// Reusable WebAudio voice primitives with a global voice cap.

export interface Out {
  ctx: BaseAudioContext;
  dest: AudioNode;
  /** Start time on the context clock. */
  t: number;
  vol: number;
}

export type Player = (o: Out) => void;

export interface Env {
  /** Attack seconds. */
  a?: number;
  peak?: number;
  /** Seconds after o.t before the voice starts. */
  delay?: number;
}

export interface ToneOpts extends Env {
  /** Glide the frequency to this value over the duration. */
  to?: number;
  detune?: number;
}

export interface NoiseFilter {
  type?: BiquadFilterType;
  f: number;
  to?: number;
  q?: number;
}

export const MAX_VOICES = 72;
let active = 0;

export function activeVoices(): number {
  return active;
}

function claim(node: AudioScheduledSourceNode): boolean {
  if (active >= MAX_VOICES) return false;
  active++;
  node.onended = () => {
    active = Math.max(0, active - 1);
  };
  return true;
}

function envGain(o: Out, start: number, dur: number, env: Env): GainNode {
  const g = o.ctx.createGain();
  const peak = Math.max(0.0002, (env.peak ?? 0.3) * o.vol);
  const a = Math.min(env.a ?? 0.004, dur * 0.5);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + a);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  g.connect(o.dest);
  return g;
}

export function tone(o: Out, freq: number, dur: number, type: OscillatorType = 'sine', opts: ToneOpts = {}): void {
  const s = o.t + (opts.delay ?? 0);
  const osc = o.ctx.createOscillator();
  if (!claim(osc)) return;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, s);
  if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), s + dur);
  if (opts.detune) osc.detune.value = opts.detune;
  osc.connect(envGain(o, s, dur, opts));
  osc.start(s);
  osc.stop(s + dur + 0.03);
}

export function sweep(o: Out, from: number, to: number, dur: number, type: OscillatorType = 'sine', opts: Env = {}): void {
  tone(o, from, dur, type, { ...opts, to });
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buf);
  }
  return buf;
}

export function noiseBurst(o: Out, dur: number, filter: NoiseFilter, opts: Env = {}): void {
  const s = o.t + (opts.delay ?? 0);
  const src = o.ctx.createBufferSource();
  if (!claim(src)) return;
  src.buffer = noiseBuffer(o.ctx);
  src.loop = true;
  const f = o.ctx.createBiquadFilter();
  f.type = filter.type ?? 'bandpass';
  f.Q.value = filter.q ?? 1;
  f.frequency.setValueAtTime(filter.f, s);
  if (filter.to !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, filter.to), s + dur);
  src.connect(f);
  f.connect(envGain(o, s, dur, opts));
  src.start(s, Math.random() * 0.5);
  src.stop(s + dur + 0.03);
}

/** Two-operator FM blip: modulator at carrier*ratio, depth = index * carrier Hz. */
export function fmBlip(o: Out, carrier: number, ratio: number, index: number, dur: number, opts: Env = {}): void {
  const s = o.t + (opts.delay ?? 0);
  const car = o.ctx.createOscillator();
  if (!claim(car)) return;
  const mod = o.ctx.createOscillator();
  const depth = o.ctx.createGain();
  car.frequency.setValueAtTime(carrier, s);
  mod.frequency.setValueAtTime(carrier * ratio, s);
  depth.gain.setValueAtTime(index * carrier, s);
  depth.gain.exponentialRampToValueAtTime(Math.max(1, carrier * 0.05), s + dur);
  mod.connect(depth);
  depth.connect(car.frequency);
  car.connect(envGain(o, s, dur, opts));
  car.start(s);
  mod.start(s);
  car.stop(s + dur + 0.03);
  mod.stop(s + dur + 0.03);
}
