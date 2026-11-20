import { MAX_HITS, MIN_HITS } from '@/config/constants';

/** Battle tuning: balance numbers for the mode (the systems never hard-code these). */
export const BATTLE_CONFIG = {
  /** Start Thorium at 100 % strength; manual example: 1000 Thorium at 50 % => 500. */
  fullStartThorium: 1000,
  /** Thorium awarded to the player who destroys an enemy base (patch 1.01). */
  baseKillBonus: 250,
  thoriumRate: { min: 0.5, max: 2.0 },
  playerCount: { min: 2, max: 4 },
} as const;

export function clampStrength(strength: number | undefined): number {
  return Math.min(1, Math.max(0, strength ?? 1));
}

/** Strength scales Max Hits: 50 % of 100 hits = 50 hits (never below 1 or above 100). */
export function scaleHits(maxHits: number, strength: number | undefined): number {
  return Math.min(MAX_HITS, Math.max(MIN_HITS, Math.round(maxHits * clampStrength(strength))));
}

/** Strength scales starting Thorium: 50 % of 1000 = 500. */
export function scaleThorium(full: number, strength: number | undefined): number {
  return Math.round(full * clampStrength(strength));
}
