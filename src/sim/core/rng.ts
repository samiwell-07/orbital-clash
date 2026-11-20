import type { World } from '@/types';

/** Stateless mulberry32 stream for non-world uses (map generation). */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedRng(w: World, seed: number): void {
  w.rng = seed | 0;
}

/** Uniform float in [0, 1). Advances w.rng. */
export function rand(w: World): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(w.rng ^ (w.rng >>> 15), w.rng | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function randInt(w: World, min: number, max: number): number {
  return min + Math.floor(rand(w) * (max - min + 1));
}

/** Float in [min, max). */
export function randRange(w: World, min: number, max: number): number {
  return min + rand(w) * (max - min);
}

export function chance(w: World, p: number): boolean {
  return rand(w) < p;
}

export function pick<T>(w: World, items: readonly T[]): T {
  return items[Math.floor(rand(w) * items.length)];
}
