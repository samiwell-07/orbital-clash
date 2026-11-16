import type { LevelDef } from '../types';
import { START_MONEY } from '../core/config';

/** Versus (2P) uses fair, symmetric settings. */
export const VERSUS_LEVEL: LevelDef = {
  level: 0,
  aiStartMoney: START_MONEY,
  aiIncomeMult: 1,
  aiThinkInterval: 1,
  aiUnitHpMult: 1,
  aiDroneSpeed: 6,
  aiAggression: 0.5,
  aiLaunchSize: 40,
  meteorInterval: 24,
  rocksPerShower: [4, 8],
};

/** Single-player level scaling: higher level => harder AI. Unbounded. */
export function getLevel(level: number): LevelDef {
  const n = Math.max(1, Math.floor(level));
  const t = Math.min(1, (n - 1) / 9);
  const beyond = Math.max(0, n - 10);
  return {
    level: n,
    aiStartMoney: Math.round(START_MONEY * (0.8 + 0.6 * t) + beyond * 30),
    aiIncomeMult: 0.8 + 0.8 * t + beyond * 0.1,
    aiThinkInterval: Math.max(0.35, 1.5 - 1.1 * t),
    aiUnitHpMult: 1 + 0.6 * t + beyond * 0.08,
    aiDroneSpeed: 3 + 4 * t,
    aiAggression: 0.35 + 0.3 * t,
    aiLaunchSize: Math.round(20 + 60 * t + beyond * 10),
    meteorInterval: 24,
    rocksPerShower: [4, 8],
  };
}
