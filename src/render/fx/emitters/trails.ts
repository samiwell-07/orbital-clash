import type { World } from '@/types';
import { count, type Fx } from '../types';
import { FIRE_HOT, FIRE_MID, WHITE, mixHex, playerColor } from '../palette';

const HEAD_TRAIN = 20;
const BEHIND = 0.18;

/**
 * Fire trails behind marching units. Samples a rotating window of at most `cap` units per frame
 * so cost is bounded regardless of army size; every unit still gets visited in turn.
 */
export function createTrailSampler() {
  let cursor = 0;
  return {
    reset(): void {
      cursor = 0;
    },
    sample(world: World, fx: Fx, cap: number): number {
      const units = world.units;
      const n = units.length;
      if (n === 0 || cap <= 0) return 0;
      const visit = Math.min(n, cap);
      if (cursor >= n) cursor = 0;
      for (let k = 0; k < visit; k++) {
        const u = units[cursor];
        cursor = cursor + 1 === n ? 0 : cursor + 1;
        if (u.state === 'dead') continue;
        const col = playerColor(u.owner);
        const dx = Math.cos(u.heading);
        const dz = Math.sin(u.heading);
        const x = u.x - dx * BEHIND;
        const z = u.y - dz * BEHIND;
        const y = 0.2 + u.z;
        const j = fx.rnd() - 0.5;
        if (u.trainIndex < HEAD_TRAIN) {
          fx.glow.emit(fx.now, x, y, z, -dx * 0.3 - dz * j * 0.5, 0.25 + fx.rnd() * 0.3, -dz * 0.3 + dx * j * 0.5,
            0.5, 0.1, 0.3, FIRE_HOT, mixHex(FIRE_MID, col, 0.5), 0.85, 0.3);
          if (u.state === 'attacking' && fx.rnd() < 0.5) {
            fx.spark.emit(fx.now, u.x, y + 0.1, u.y, (fx.rnd() - 0.5) * 3, 1 + fx.rnd() * 2, (fx.rnd() - 0.5) * 3,
              0.35, 0.14, 0.02, WHITE, FIRE_HOT, 1, -6);
          }
        } else if (fx.rnd() < 0.4 * fx.lod) {
          fx.glow.emit(fx.now, x, y, z, -dx * 0.15, 0.1, -dz * 0.15, 0.3, 0.08, 0.16, mixHex(WHITE, col, 0.6), col, 0.35, 0);
        }
      }
      return visit;
    },
  };
}

export type TrailSampler = ReturnType<typeof createTrailSampler>;

export function trailCap(fx: Fx, unitCount: number): number {
  const base = unitCount > 1000 ? 90 : 160;
  return count(fx, base);
}
