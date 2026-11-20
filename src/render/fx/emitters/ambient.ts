import type { World } from '@/types';
import type { Fx } from '../types';
import { FIRE_HOT, FIRE_MID, SMOKE_DARK, SMOKE_LIGHT } from '../palette';

const DUST_RATE = 9;
const DUST_COLOR = 0xb8b0ff;
const STREAK_RATE = 50;

/** Ambient life: meteor streaks behind drifting rocks and slow dust motes over the plateau. */
export function updateAmbient(world: World, fx: Fx, dt: number): void {
  const p = Math.min(1, dt * STREAK_RATE * fx.lod);
  for (const r of world.rocks) {
    if (r.state !== 'drifting') continue;
    const speed = Math.hypot(r.vx, r.vy) || 1;
    const nx = r.vx / speed;
    const nz = r.vy / speed;
    const s = 0.14 * r.size;
    if (fx.rnd() < p) {
      fx.glow.emit(fx.now, r.x - nx * s * 1.4, 0.55, r.y - nz * s * 1.4, -r.vx * 0.2 + (fx.rnd() - 0.5) * 0.3, 0.2, -r.vy * 0.2 + (fx.rnd() - 0.5) * 0.3,
        0.75, s * 1.1, s * 0.15, FIRE_HOT, FIRE_MID, 0.8, 0.1);
    }
    if (fx.rnd() < p * 0.3) {
      fx.smoke.emit(fx.now, r.x - nx * s * 2, 0.55, r.y - nz * s * 2, -r.vx * 0.1, 0.2, -r.vy * 0.1, 1.4, s * 0.8, s * 2.4,
        SMOKE_LIGHT, SMOKE_DARK, 0.35, 0.1);
    }
  }
  if (fx.rnd() < dt * DUST_RATE * fx.lod) {
    fx.glow.emit(fx.now, fx.rnd() * world.grid.w, 0.15 + fx.rnd() * 0.7, fx.rnd() * world.grid.h, 0.15 + fx.rnd() * 0.1, 0.02, (fx.rnd() - 0.5) * 0.1,
      5, 0.05, 0.05, DUST_COLOR, DUST_COLOR, 0.28, 0);
  }
}
