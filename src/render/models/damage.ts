import { clamp01 } from './motion';

export function hpRatio(hp: number, maxHp: number): number {
  return maxHp > 0 ? clamp01(hp / maxHp) : 1;
}

/** Colour multiplier for the structure body: 1 when healthy, 0.45 at death's door. */
export function damageDarken(ratio: number): number {
  return 1 - 0.55 * Math.pow(1 - clamp01(ratio), 1.3);
}

/** Orange crack glow 0..1, only below 40 % hp. */
export function crackGlow(ratio: number): number {
  return ratio >= 0.4 ? 0 : clamp01(1 - ratio / 0.4);
}

/** Smoke amount 0..1, only below 25 % hp. */
export function smokeAmount(ratio: number): number {
  return ratio >= 0.25 ? 0 : clamp01(1 - ratio / 0.25);
}

/** Glow multiplier 0.4..1: steady above 50 % hp, stuttering below. */
export function flicker(ratio: number, id: number, t: number): number {
  if (ratio >= 0.5) return 1;
  const noise = Math.max(0, Math.sin(t * 23 + id) * Math.sin(t * 7.3 + id * 2));
  return 1 - (1 - ratio * 2) * 0.6 * noise;
}
