import type { Fx } from '../types';
import { BOMB_ORANGE, FIRE_HOT, SMOKE_DARK, SMOKE_LIGHT } from '../palette';

const TAU = Math.PI * 2;

/** Billowing grey puffs that drift upward and grow. */
export function emitSmokePuffs(fx: Fx, x: number, y: number, z: number, n: number, size: number, life: number, t: number): void {
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const sp = (0.1 + fx.rnd() * 0.5) * size;
    fx.smoke.emit(t, x, y, z, Math.cos(a) * sp, 0.3 + fx.rnd() * 0.6, Math.sin(a) * sp, life * (0.7 + fx.rnd() * 0.5),
      size * 0.45, size * 1.5, SMOKE_LIGHT, SMOKE_DARK, 0.5, 0.1);
  }
}

/** Anti-air flak burst: orange flash that cools into a dark puff. */
export function emitFlakPuff(fx: Fx, x: number, z: number, t: number): void {
  fx.glow.emit(t, x, 0.6, z, 0, 0, 0, 0.2, 0.9, 0.5, FIRE_HOT, BOMB_ORANGE, 1, 0);
  for (let i = 0; i < 3; i++) {
    const a = fx.rnd() * TAU;
    fx.smoke.emit(t, x + Math.cos(a) * 0.15, 0.6, z + Math.sin(a) * 0.15, Math.cos(a) * 0.3, 0.3, Math.sin(a) * 0.3,
      0.9 + fx.rnd() * 0.4, 0.35, 1.0, 0x4a4450, SMOKE_DARK, 0.55, 0.05);
  }
}
