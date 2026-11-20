import type { Difficulty } from '../types';
import { DIFFICULTY_MULT } from '../config/constants';

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';
export const RANKS: readonly Rank[] = ['S', 'A', 'B', 'C', 'D'];

/**
 * Rank = effective time / par time, where effective = timeSec + penaltySec.
 * ratio <= 0.75 S, <= 1.0 A, <= 1.4 B, <= 2.0 C, otherwise D.
 * Normal is the ranked difficulty and uses these thresholds as written.
 * Expert is stricter on penalties (already in penaltySec) but equally ranked.
 * Beginner/Casual are unranked practice difficulties: rank is capped at C / B.
 */
const THRESHOLDS: readonly [number, Rank][] = [[0.75, 'S'], [1.0, 'A'], [1.4, 'B'], [2.0, 'C']];
const RANK_CAP: Record<Difficulty, Rank> = { beginner: 'C', casual: 'B', normal: 'S', expert: 'S' };
const SCORE_DIFFICULTY: Record<Difficulty, number> = { beginner: 0.5, casual: 0.75, normal: 1, expert: 1.5 };

export const RANKED_DIFFICULTY: Difficulty = 'normal';

export function effectiveTime(timeSec: number, penaltySec: number): number {
  return Math.max(0, timeSec) + Math.max(0, penaltySec);
}

export function betterRank(a: Rank, b: Rank): Rank {
  return RANKS.indexOf(a) <= RANKS.indexOf(b) ? a : b;
}

export function computeRank(timeSec: number, penaltySec: number, parTimeSec: number, difficulty: Difficulty): Rank {
  const ratio = effectiveTime(timeSec, penaltySec) / Math.max(1, parTimeSec);
  const raw = THRESHOLDS.find(([limit]) => ratio <= limit)?.[1] ?? 'D';
  // A cap only lowers a rank, never raises one.
  return RANKS.indexOf(raw) >= RANKS.indexOf(RANK_CAP[difficulty]) ? raw : RANK_CAP[difficulty];
}

/**
 * Score = round(10000 * clamp(par / effective, 0.25, 3) * difficultyFactor) - 50 * penaltyHits,
 * floored at 0. difficultyFactor: beginner 0.5, casual 0.75, normal 1, expert 1.5.
 * penaltyHits is derived from penaltySec / DIFFICULTY_MULT[difficulty].penaltyPerHit (0 when no penalty).
 */
export function computeScore(timeSec: number, penaltySec: number, parTimeSec: number, difficulty: Difficulty): number {
  const eff = Math.max(1, effectiveTime(timeSec, penaltySec));
  const speed = Math.min(3, Math.max(0.25, Math.max(1, parTimeSec) / eff));
  const perHit = DIFFICULTY_MULT[difficulty].penaltyPerHit;
  const hits = perHit > 0 ? Math.round(Math.max(0, penaltySec) / perHit) : 0;
  return Math.max(0, Math.round(10000 * speed * SCORE_DIFFICULTY[difficulty]) - 50 * hits);
}
