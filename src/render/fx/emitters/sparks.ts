import { count, type Fx } from '../types';
import { AMBER, BOMB_ORANGE, CYAN, CYAN_DEEP, FIRE_DARK, FIRE_HOT, FIRE_MID, MUZZLE, PULSAR, TRACER, WHITE, mixHex, playerColor } from '../palette';
import { emitFlakPuff } from './smoke';
import { emitRing } from './rings';

const TAU = Math.PI * 2;
const TRACER_SPEED = 22;
const BOMB_SPEED = 9;

/** Spark spray that falls under gravity. */
export function emitFireSparks(fx: Fx, x: number, y: number, z: number, n: number, speed: number, t: number): void {
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const sp = speed * (0.3 + fx.rnd() * 0.7);
    fx.spark.emit(t, x, y, z, Math.cos(a) * sp, 0.8 + fx.rnd() * speed * 0.7, Math.sin(a) * sp, 0.45 + fx.rnd() * 0.6,
      0.1 + fx.rnd() * 0.08, 0.02, FIRE_HOT, FIRE_MID, 1, -7);
  }
}

export function emitHitSparks(fx: Fx, x: number, z: number): void {
  fx.glow.emit(fx.now, x, 0.3, z, 0, 0, 0, 0.12, 0.5, 0.15, WHITE, FIRE_HOT, 0.9, 0);
  emitFireSparks(fx, x, 0.3, z, count(fx, 6), 2.4, fx.now);
}

/** One-frame-ish muzzle flash plus a tiny kick of sparks. */
export function emitMuzzle(fx: Fx, x: number, z: number, color: number, size: number): void {
  fx.glow.emit(fx.now, x, 0.5, z, 0, 0, 0, 0.09, size, size * 0.4, WHITE, color, 1, 0);
  fx.spark.emit(fx.now, x, 0.5, z, 0, 0, 0, 0.1, size * 1.6, size * 0.6, WHITE, color, 0.9, 0);
}

export function emitTurretShot(fx: Fx, x: number, z: number, tx: number, tz: number): void {
  emitMuzzle(fx, x, z, MUZZLE, 0.35);
  const dist = Math.hypot(tx - x, tz - z);
  fx.tracer.emit(fx.now, x, 0.5, z, tx, 0.3, tz, Math.max(0.05, dist / TRACER_SPEED), 0.07, 0.05, TRACER, 1, 0.4);
}

export function emitLaserMuzzle(fx: Fx, x: number, z: number, owner: number): void {
  emitMuzzle(fx, x, z, mixHex(CYAN, playerColor(owner), 0.35), 0.4);
}

/** Pulsar: expanding white-violet ring and a short ground glow centred on the emitter. */
export function emitPulsarShot(fx: Fx, x: number, z: number, range: number): void {
  emitRing(fx, x, 0.08, z, 0.2, range, 0.25, PULSAR, 0.8);
  fx.glow.emit(fx.now, x, 0.2, z, 0, 0, 0, 0.3, 1.0, range * 0.9, PULSAR, 0x6a4cff, 0.45, 0);
}

/** Bomber: lobbed orange orb with a smoke trail, flak puff when it arrives. */
export function emitBomberShot(fx: Fx, x: number, z: number, tx: number, tz: number): void {
  emitMuzzle(fx, x, z, BOMB_ORANGE, 0.4);
  const dist = Math.hypot(tx - x, tz - z);
  const T = Math.max(0.15, dist / BOMB_SPEED);
  const g = -9;
  const vy = (0 - 0.5 * g * T * T) / T;
  fx.shard.emit(fx.now, x, 0.5, z, (tx - x) / T, vy, (tz - z) / T, T, 0.34, 0.26, FIRE_HOT, BOMB_ORANGE, 1, g);
  const puffs = count(fx, 6);
  for (let i = 1; i <= puffs; i++) {
    const f = i / (puffs + 1);
    const y = 0.5 + vy * f * T + 0.5 * g * f * f * T * T;
    fx.smoke.emit(fx.now + f * T, x + (tx - x) * f, y, z + (tz - z) * f, 0, 0.2, 0, 0.7, 0.18, 0.5, 0x6a6470, 0x1a171e, 0.4, 0.1);
  }
  emitFlakPuff(fx, tx, tz, fx.now + T);
}

/** Rising cyan sparkle plus a base ring for build/upgrade. */
export function emitBuildSparkle(fx: Fx, x: number, z: number, color: number, big = false): void {
  const n = count(fx, big ? 26 : 14);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const r = 0.15 + fx.rnd() * 0.4;
    fx.glow.emit(fx.now + fx.rnd() * 0.25, x + Math.cos(a) * r, 0.1, z + Math.sin(a) * r, 0, 1.2 + fx.rnd() * 1.4, 0,
      0.6 + fx.rnd() * 0.4, 0.14, 0.02, mixHex(WHITE, CYAN_DEEP, fx.rnd()), color, 0.95, 0.5);
  }
  emitRing(fx, x, 0.06, z, 0.2, big ? 2.4 : 1.1, 0.5, color, 0.8);
  fx.glow.emit(fx.now, x, 0.3, z, 0, 0, 0, 0.3, big ? 2.2 : 1.0, 0.2, WHITE, color, 0.7, 0);
}

/** Recycle: the structure dissolves into amber motes that rise and implode. */
export function emitRecycleDissolve(fx: Fx, x: number, z: number): void {
  const n = count(fx, 22);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const r = 0.1 + fx.rnd() * 0.45;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    fx.glow.emit(fx.now + fx.rnd() * 0.2, px, 0.1 + fx.rnd() * 0.2, pz, (x - px) * 1.2, 1.0 + fx.rnd() * 1.6, (z - pz) * 1.2,
      0.7 + fx.rnd() * 0.5, 0.16, 0.02, AMBER, FIRE_DARK, 0.9, 0.2);
  }
  emitRing(fx, x, 0.06, z, 0.7, 0.1, 0.4, AMBER, 0.7);
}
