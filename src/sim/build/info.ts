import type { StructureKind, WeaponKind } from '@/types';
import { WEAPONS } from '@/types';
import { DEFS, SUPPORT_DEFS } from '@/data';

export interface StructureInfo {
  buildCost: number;
  hp: number;
  maxLevel: number;
  upgradeCost: readonly number[];
  requires: string | null;
  profile: 'base' | 'bionic' | 'both';
}

/** Construction animation length in seconds. */
export const BUILD_SECONDS = 0.5;
/** Max hp gained per upgrade level, as a fraction of the base hp. */
export const HP_PER_LEVEL = 0.25;

/** Unified definition lookup across weapons, spawn towers and support structures; null for unknown kinds. */
export function structureInfo(kind: StructureKind): StructureInfo | null {
  if ((WEAPONS as readonly string[]).includes(kind)) {
    const d = DEFS.weapon(kind as WeaponKind);
    return {
      buildCost: d.buildCost, hp: d.hp, maxLevel: d.maxLevel, upgradeCost: d.upgradeCost,
      requires: d.requires, profile: 'both',
    };
  }
  if (kind === 'basicOps' || kind === 'specialOps') {
    const d = DEFS.spawnTower(kind);
    return {
      buildCost: d.buildCost, hp: d.hp, maxLevel: d.maxLevel, upgradeCost: d.upgradeCost,
      requires: d.requires, profile: 'both',
    };
  }
  if (kind in SUPPORT_DEFS) {
    const d = DEFS.support(kind);
    return {
      buildCost: d.buildCost, hp: d.hp, maxLevel: d.maxLevel ?? 0, upgradeCost: d.upgradeCost ?? [],
      requires: d.requires, profile: d.profile,
    };
  }
  return null;
}

export function maxHpAt(info: StructureInfo, level: number): number {
  return Math.round(info.hp * (1 + HP_PER_LEVEL * level));
}

/** Thorium spent on upgrades so far, derived from the level (no per-structure bookkeeping needed). */
export function upgradeSpend(info: StructureInfo, level: number): number {
  let sum = 0;
  for (let i = 0; i < level && i < info.upgradeCost.length; i++) sum += info.upgradeCost[i];
  return sum;
}
