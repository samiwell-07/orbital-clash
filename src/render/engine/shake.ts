import type { SimEvent } from '@/types';

export const SHAKE = {
  /** Max camera displacement in tiles at trauma 1 (style guide: 0.35). */
  maxOffset: 0.35,
  /** Trauma lost per second. */
  decay: 1.8,
  maxRoll: 0.012,
  frequency: 22,
} as const;

export interface ShakeOffset {
  x: number;
  y: number;
  roll: number;
}

/** Trauma-based camera shake: displacement scales with trauma^2 and decays linearly. */
export class ShakeState {
  trauma = 0;

  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  step(dt: number): void {
    this.trauma = Math.max(0, this.trauma - SHAKE.decay * dt);
  }

  offset(timeSec: number, out: ShakeOffset): ShakeOffset {
    const s = this.trauma * this.trauma;
    const t = timeSec * SHAKE.frequency;
    out.x = s * SHAKE.maxOffset * (Math.sin(t * 1.0) * 0.6 + Math.sin(t * 2.3 + 1.3) * 0.4);
    out.y = s * SHAKE.maxOffset * (Math.sin(t * 1.4 + 2.0) * 0.6 + Math.sin(t * 2.9 + 0.4) * 0.4);
    out.roll = s * SHAKE.maxRoll * Math.sin(t * 1.7 + 0.8);
    return out;
  }
}

export interface EventKick {
  shake: number;
  flash: { color: number; strength: number } | null;
}

/** Trauma / colour pulse caused by a sim event (only base hits and big blasts shake the camera). */
export function kickFor(e: SimEvent): EventKick | null {
  if (e.t === 'baseHit') return { shake: 0.55, flash: { color: 0xff3030, strength: 0.45 } };
  if (e.t === 'baseDestroyed') return { shake: 0.9, flash: { color: 0xff5a30, strength: 0.7 } };
  if (e.t === 'explosion' && e.big) return { shake: Math.min(0.5, 0.2 + e.radius * 0.1), flash: null };
  return null;
}
