import { count, type Fx } from '../types';
import { CRYSTAL, THORIUM, THORIUM_GOLD, WHITE } from '../palette';
import { emitRing } from './rings';

const TAU = Math.PI * 2;
const SHARD_GRAVITY = -7;

/**
 * Rock harvested (emptied): crystal burst, then glowing thorium shards that arc to the owner's base (tx, tz).
 * Shard count scales with the thorium released.
 */
export function emitRockBurst(fx: Fx, x: number, z: number, thorium: number, tx: number, tz: number): void {
  fx.glow.emit(fx.now, x, 0.4, z, 0, 0, 0, 0.22, 2.0, 0.6, WHITE, THORIUM, 1, 0);
  emitRing(fx, x, 0.08, z, 0.2, 1.5, 0.4, CRYSTAL, 0.75);
  const n = count(fx, 14);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const sp = 1.2 + fx.rnd() * 2.6;
    fx.spark.emit(fx.now, x, 0.4, z, Math.cos(a) * sp, 1.5 + fx.rnd() * 2.5, Math.sin(a) * sp, 0.6 + fx.rnd() * 0.5,
      0.16 + fx.rnd() * 0.1, 0.03, mixCrystal(fx.rnd()), THORIUM, 1, -8);
  }
  if (!Number.isFinite(tx) || !Number.isFinite(tz)) return;
  const shards = Math.min(20, Math.max(8, 8 + Math.floor(thorium / 12)));
  const dist = Math.hypot(tx - x, tz - z);
  for (let i = 0; i < count(fx, shards); i++) {
    const delay = fx.rnd() * 0.25;
    const T = 0.7 + dist * 0.05 + fx.rnd() * 0.35;
    const a = fx.rnd() * TAU;
    const px = x + Math.cos(a) * 0.3;
    const pz = z + Math.sin(a) * 0.3;
    const vy = (0.2 - 0.5 - 0.5 * SHARD_GRAVITY * T * T) / T;
    fx.shard.emit(fx.now + delay, px, 0.5, pz, (tx - px) / T, vy, (tz - pz) / T, T, 0.22 + fx.rnd() * 0.1, 0.1,
      WHITE, i % 2 ? THORIUM : THORIUM_GOLD, 1, SHARD_GRAVITY);
  }
}

function mixCrystal(t: number): number {
  return t < 0.5 ? CRYSTAL : WHITE;
}

/** Local pickup pulse where a rock is grabbed or thorium is collected at a position. */
export function emitThoriumGlow(fx: Fx, x: number, z: number): void {
  fx.glow.emit(fx.now, x, 0.5, z, 0, 0.5, 0, 0.5, 0.8, 1.6, WHITE, THORIUM_GOLD, 0.7, 0);
  emitRing(fx, x, 0.1, z, 0.2, 1.1, 0.4, THORIUM, 0.7);
}
