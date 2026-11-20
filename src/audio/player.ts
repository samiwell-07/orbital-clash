// Plays one SoundCall: rate limit, pan, then run the synth for that id.
import { getBus } from './context';
import { createRateLimiter } from './rate-limiter';
import { SOUND_META } from './sound-ids';
import type { SoundCall } from './sound-ids';
import { SFX } from './sfx';

const limiter = createRateLimiter();

export function playSound(call: SoundCall): void {
  const bus = getBus();
  if (!bus) return;
  const { ctx } = bus;
  const meta = SOUND_META[call.id];
  const scale = limiter.acquire(call.id, ctx.currentTime, meta.max, meta.win);
  if (scale === 0) return;
  let dest: AudioNode = bus.sfx;
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, call.pan));
    panner.connect(bus.sfx);
    dest = panner;
  }
  SFX[call.id]({ ctx, dest, t: ctx.currentTime + 0.005, vol: call.vol * scale });
}
