import type { Intent, Player, PlayerId, World } from '@/types';
import type { AiTuning } from './tuning';
import type { Threat } from './threat';

/** Per-AI persistent state (kept between decisions, never read by the rest of the sim). */
export interface AiMemory {
  tuning: AiTuning | null;
  /** Seconds until the next decision. */
  timer: number;
  attacking: boolean;
  /** World time when the last attack ended (-Infinity before the first). */
  lastAttackEnd: number;
  cycleTries: number;
  weaponsBuilt: number;
  baseAskedAt: number;
  grabCooldown: number;
  rockId: number;
}

export function newMemory(): AiMemory {
  return {
    tuning: null, timer: 0, attacking: false, lastAttackEnd: -Infinity, cycleTries: 0,
    weaponsBuilt: 0, baseAskedAt: -Infinity, grabCooldown: 0, rockId: 0,
  };
}

/** What one decision pass works with. `budget` and `pending` guard against overspending and double placement. */
export interface BrainCtx {
  w: World;
  me: PlayerId;
  p: Player;
  tun: AiTuning;
  mem: AiMemory;
  threat: Threat;
  budget: { thorium: number };
  pending: Set<number>;
  out: Intent[];
}
