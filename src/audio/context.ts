// Lazy AudioContext with master/sfx/music buses. Every accessor is a graceful no-op without WebAudio.

export interface AudioBus {
  ctx: AudioContext;
  master: GainNode;
  sfx: GainNode;
  music: GainNode;
}

let bus: AudioBus | null = null;
let vols = { master: 0.8, sfx: 1, music: 0.6 };

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

function contextCtor(): typeof AudioContext | null {
  const g = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function applyVolumes(b: AudioBus): void {
  const t = b.ctx.currentTime;
  b.master.gain.setTargetAtTime(vols.master, t, 0.02);
  b.sfx.gain.setTargetAtTime(vols.sfx, t, 0.02);
  b.music.gain.setTargetAtTime(vols.music, t, 0.02);
}

function build(ctx: AudioContext): AudioBus {
  const master = ctx.createGain();
  const sfx = ctx.createGain();
  const music = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 12;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  sfx.connect(master);
  music.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);
  const b = { ctx, master, sfx, music };
  master.gain.value = vols.master;
  sfx.gain.value = vols.sfx;
  music.gain.value = vols.music;
  return b;
}

/** The bus only once the context is actually running (after a user gesture); otherwise null. */
export function getBus(): AudioBus | null {
  return bus && bus.ctx.state === 'running' ? bus : null;
}

/** Create (first call) and resume the context. Call from a user gesture. Resolves true when running. */
export async function unlockContext(): Promise<boolean> {
  const Ctor = contextCtor();
  if (!Ctor) return false;
  try {
    if (!bus) bus = build(new Ctor());
    if (bus.ctx.state !== 'running') await bus.ctx.resume();
    return bus.ctx.state === 'running';
  } catch {
    return false;
  }
}

export function setBusVolume(master: number, sfx: number, music: number): void {
  vols = { master: clamp01(master), sfx: clamp01(sfx), music: clamp01(music) };
  if (bus) applyVolumes(bus);
}

const GESTURES = ['pointerdown', 'keydown', 'touchstart', 'mousedown'] as const;

/** Unlock on user gestures; keeps listening so a suspended/interrupted context can recover. */
export function installUnlockListeners(onRunning: () => void): void {
  const target = (globalThis as { document?: Document }).document;
  if (!target) return;
  const handler = (): void => {
    if (bus && bus.ctx.state === 'running') return;
    void unlockContext().then((ok) => ok && onRunning());
  };
  for (const g of GESTURES) target.addEventListener(g, handler, { capture: true, passive: true });
}
