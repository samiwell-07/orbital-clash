import { hash01 } from '@/render/instancing/colorTables';

export const TWO_PI = Math.PI * 2;

/** Hop/bob phase of a unit in a marching train: neighbours are offset so the train ripples. */
export function snakeBobPhase(trainIndex: number, id: number, timeSec: number): number {
  return timeSec * 9 - trainIndex * 0.55 + hash01(id) * 1.2;
}

/** 0..amp hop height from a phase (rectified sine reads as hopping). */
export function bobHeight(phase: number, amp: number): number {
  return Math.abs(Math.sin(phase)) * amp;
}

/** Signed shortest angle from a to b in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  else if (d <= -Math.PI) d += TWO_PI;
  return d;
}

/** Rotates `cur` toward `target` by at most maxStep (radians). */
export function approachAngle(cur: number, target: number, maxStep: number): number {
  const d = angleDiff(cur, target);
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function easeOutBack(t: number): number {
  const k = clamp01(t) - 1;
  return 1 + 2.70158 * k * k * k + 1.70158 * k * k;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
