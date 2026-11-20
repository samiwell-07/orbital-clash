import { count, type Fx } from '../types';
import { FIRE_DARK, FIRE_HOT, FIRE_MID, SMOKE_DARK, SMOKE_LIGHT, WHITE, mixHex, playerColor } from '../palette';
import { emitFireSparks } from './sparks';
import { emitSmokePuffs } from './smoke';

const TAU = Math.PI * 2;
const FIREBALL_RED = 0xd8380a;

/** Small or big explosion: flash, fireball, sparks, smoke, shockwave ring and (big) debris. */
export function emitExplosion(fx: Fx, x: number, z: number, radius: number, big: boolean, delay = 0, shake = true): void {
  const s = Math.max(0.35, radius);
  const t = fx.now + delay;
  fx.glow.emit(t, x, 0.4, z, 0, 0, 0, big ? 0.2 : 0.14, s * (big ? 2.0 : 1.9), s * (big ? 0.9 : 0.8), WHITE, FIRE_HOT, big ? 0.7 : 0.9, 0);
  const balls = count(fx, big ? 14 : 5);
  for (let i = 0; i < balls; i++) {
    const a = fx.rnd() * TAU;
    const sp = (0.25 + fx.rnd() * 1.1) * s * (big ? 1.5 : 1);
    const life = big ? 0.55 + fx.rnd() * 0.5 : 0.3 + fx.rnd() * 0.25;
    fx.glow.emit(t, x, 0.25, z, Math.cos(a) * sp, 0.3 + fx.rnd() * s, Math.sin(a) * sp, life,
      s * 0.55, s * (big ? 1.4 : 0.95), FIRE_MID, FIREBALL_RED, big ? 0.5 : 0.8, 0.2);
  }
  emitFireSparks(fx, x, 0.3, z, count(fx, big ? 24 : 7), s * (big ? 3.4 : 2.4), t);
  emitSmokePuffs(fx, x, 0.35, z, count(fx, big ? 8 : 2), s, big ? 2.0 : 1.2, t);
  fx.ring.emit(t, x, 0.06, z, 0, 0, 0, big ? 0.5 : 0.32, s * 0.3, s * (big ? 2.8 : 1.5), FIRE_MID, big ? 0.85 : 0.6, 0);
  if (big) {
    emitDebris(fx, x, z, count(fx, 6), s, t);
    if (shake) fx.shake(Math.min(0.9, 0.3 + 0.12 * s));
  }
}

/** Gravity-driven glowing shards. */
export function emitDebris(fx: Fx, x: number, z: number, n: number, speed: number, t: number): void {
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const sp = (0.8 + fx.rnd() * 1.6) * speed * 0.9;
    fx.spark.emit(t, x, 0.3, z, Math.cos(a) * sp, 2.2 + fx.rnd() * 3, Math.sin(a) * sp, 0.9 + fx.rnd() * 0.6,
      0.16 + fx.rnd() * 0.1, 0.06, FIRE_HOT, FIRE_DARK, 1, -9);
  }
}

/** Structure kill: big blast, debris and a rising smoke column. */
export function emitStructureCollapse(fx: Fx, x: number, z: number): void {
  emitExplosion(fx, x, z, 1.1, true);
  const n = count(fx, 12);
  for (let i = 0; i < n; i++) {
    const d = (i / n) * 0.9;
    const a = fx.rnd() * TAU;
    const r = fx.rnd() * 0.3;
    fx.smoke.emit(fx.now + d, x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r, (fx.rnd() - 0.5) * 0.25, 0.9 + fx.rnd() * 0.7,
      (fx.rnd() - 0.5) * 0.25, 1.8 + fx.rnd() * 0.6, 0.5, 1.7, SMOKE_LIGHT, SMOKE_DARK, 0.55, 0.15);
    if (i % 3 === 0) fx.glow.emit(fx.now + d, x, 0.3, z, (fx.rnd() - 0.5) * 0.8, 0.8 + fx.rnd(), (fx.rnd() - 0.5) * 0.8, 0.8,
      0.3, 0.05, FIRE_HOT, FIREBALL_RED, 0.8, 0.5);
  }
}

/** Very cheap unit death: tiny flash and a couple of team-tinted sparks; n merges batched deaths. */
export function emitUnitPop(fx: Fx, x: number, z: number, n: number, owner: number): void {
  const col = mixHex(WHITE, playerColor(owner), 0.45);
  const size = Math.min(0.9, 0.3 + 0.07 * n);
  fx.glow.emit(fx.now, x, 0.2, z, 0, 0.2, 0, 0.2, size, size * 0.3, col, playerColor(owner), 0.9, 0);
  const sparks = Math.min(5, 1 + (n >> 1));
  for (let i = 0; i < sparks; i++) {
    const a = fx.rnd() * TAU;
    const sp = 0.7 + fx.rnd() * 1.4;
    fx.spark.emit(fx.now, x, 0.2, z, Math.cos(a) * sp, 0.6 + fx.rnd(), Math.sin(a) * sp, 0.25 + fx.rnd() * 0.15,
      0.1, 0.02, col, playerColor(owner), 0.9, -4);
  }
}

/** Base destroyed: chain of staggered big blasts, rings, screen flash and heavy shake. */
export function emitMegaExplosion(fx: Fx, x: number, z: number, color: number): void {
  const n = count(fx, 9);
  for (let k = 0; k < n; k++) {
    const a = fx.rnd() * TAU;
    const r = fx.rnd() * 1.6;
    emitExplosion(fx, x + Math.cos(a) * r, z + Math.sin(a) * r, 1.4 + fx.rnd() * 0.8, true, k * 0.11, false);
  }
  for (let k = 0; k < 3; k++) {
    fx.ring.emit(fx.now + k * 0.18, x, 0.08, z, 0, 0, 0, 1.1, 0.5, 7 + k * 2, k === 1 ? WHITE : color, 0.9, 0);
  }
  fx.glow.emit(fx.now, x, 1.0, z, 0, 0.3, 0, 0.7, 4, 9, WHITE, color, 0.5, 0);
  fx.beam.emit(fx.now, x, 0, z, x, 9, z, 0.9, 1.1, 0.2, mixHex(color, WHITE, 0.5), 0.8, 0);
  fx.flash(WHITE, 1);
  fx.shake(1);
}
