import type { Difficulty, UnitKind } from '@/types';

/** Adaptive AI balance. Difficulty scales reaction time and aggression, never resources. */
export interface AiTuning {
  /** Seconds between decisions (reaction time). */
  thinkSec: number;
  maxBasicOps: number;
  /** Stored army size that triggers an attack. */
  attackThreshold: number;
  /** Minimum seconds between the end of one attack and the start of the next. */
  attackCooldownSec: number;
  /** Max Chebyshev tile distance from the base for towers. */
  towerRadius: number;
  /** Weapons wanted per spawn tower. */
  weaponsPerTower: number;
  /** Highest Basic Ops level the AI buys. */
  maxTowerLevel: number;
}

export const AI_TUNING: Readonly<Record<Difficulty, AiTuning>> = {
  beginner: { thinkSec: 0.9, maxBasicOps: 3, attackThreshold: 200, attackCooldownSec: 90, towerRadius: 7, weaponsPerTower: 1.5, maxTowerLevel: 1 },
  casual: { thinkSec: 0.6, maxBasicOps: 4, attackThreshold: 150, attackCooldownSec: 60, towerRadius: 8, weaponsPerTower: 2, maxTowerLevel: 2 },
  normal: { thinkSec: 0.35, maxBasicOps: 6, attackThreshold: 100, attackCooldownSec: 40, towerRadius: 9, weaponsPerTower: 2.5, maxTowerLevel: 3 },
  expert: { thinkSec: 0.25, maxBasicOps: 9, attackThreshold: 70, attackCooldownSec: 25, towerRadius: 10, weaponsPerTower: 3, maxTowerLevel: 3 },
};

/** Baseline output shares of the Basic Ops towers. */
export const BASE_MIX: Readonly<Partial<Record<UnitKind, number>>> = { scout: 0.35, tank: 0.3, drone: 0.2, torpedo: 0.15 };

/** How much the AI likes releasing each unit when several are stored (specials without a base hit are never sent). */
export const ATTACK_WEIGHT: Readonly<Partial<Record<UnitKind, number>>> = {
  tank: 1.0, scout: 0.8, drone: 1.0, torpedo: 1.1, hammer: 1.3, snake: 1.2, dragon: 1.2,
};

/** Minimum Basic Ops level that unlocks each basic unit. */
export const UNIT_LEVEL: Readonly<Partial<Record<UnitKind, number>>> = { scout: 0, tank: 1, drone: 2, torpedo: 3 };

/** Ship steering gains for the per-tick PD controller. */
export const SHIP_STEER = { posGain: 2.5, maxSpeed: 8, velGain: 0.5, grabRadius: 0.9, repeatSec: 0.6 } as const;

/** Route segment (path steps from my base) where weapons are placed, and max lateral offset from the route. */
export const ROUTE_BAND = { from: 4, to: 18, lateral: 2 } as const;
