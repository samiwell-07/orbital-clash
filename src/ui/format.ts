import { PIP_VALUES } from '../config/constants';
import type { UnitKind } from '../types';

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);

/** mm:ss (minutes widen past 99). Negative and NaN clamp to 0. */
export function formatTime(sec: number): string {
  const s = Number.isFinite(sec) ? Math.max(0, Math.floor(sec)) : 0;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** m:ss.t with tenths, for par/best times on screens. */
export function formatTimeTenths(sec: number): string {
  const s = Math.max(0, sec);
  return `${formatTime(s)}.${Math.floor((s * 10) % 10)}`;
}

/** Exponential approach that is frame-rate independent (tau = time constant in seconds). */
export function approach(cur: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  const next = target + (cur - target) * Math.exp(-Math.max(0, dt) / tau);
  return Math.abs(next - target) < 0.5 ? target : next;
}

export interface Pips {
  white: number;
  blue: number;
  red: number;
}

/** Splits a unit count into pips: white = 1, blue = 10, red = 100 (PIP_VALUES). */
export function pipsFor(count: number): Pips {
  let n = Math.max(0, Math.floor(count));
  const red = Math.floor(n / PIP_VALUES[2]);
  n -= red * PIP_VALUES[2];
  const blue = Math.floor(n / PIP_VALUES[1]);
  n -= blue * PIP_VALUES[1];
  return { white: n, blue, red };
}

export function sumStored(stored: Partial<Record<UnitKind, number>>): number {
  let total = 0;
  for (const v of Object.values(stored)) total += v ?? 0;
  return total;
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

/** 'thorium' -> 'Thorium', 'basicOps' -> 'Basic Ops'. */
export function humanize(id: string): string {
  const spaced = id.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
