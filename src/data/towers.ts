import type { TowerDef, TowerKind, TowerLevelStats } from '../types';

const BASE: TowerLevelStats = {
  cost: 0,
  damage: 0,
  range: 0,
  fireInterval: 1,
  splashRadius: 0,
  slowFactor: 1,
  slowDuration: 0,
  projectileSpeed: 0,
  magnetRadius: 0,
  magnetStrength: 0,
  refineTime: 0,
  valueMultiplier: 1,
};

function lvl(stats: Partial<TowerLevelStats>): TowerLevelStats {
  return { ...BASE, ...stats };
}

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  laser: {
    kind: 'laser',
    name: 'Pulse Laser',
    description: 'Fast single-target beam. Weak vs shields.',
    levels: [
      lvl({ cost: 60, damage: 7, range: 3, fireInterval: 0.25 }),
      lvl({ cost: 70, damage: 12, range: 3.5, fireInterval: 0.2 }),
      lvl({ cost: 110, damage: 19, range: 4, fireInterval: 0.15 }),
    ],
  },
  cannon: {
    kind: 'cannon',
    name: 'Plasma Cannon',
    description: 'Slow homing missiles with splash damage.',
    levels: [
      lvl({ cost: 100, damage: 30, range: 3.5, fireInterval: 1.4, splashRadius: 1.0, projectileSpeed: 7 }),
      lvl({ cost: 110, damage: 50, range: 4, fireInterval: 1.2, splashRadius: 1.25, projectileSpeed: 8 }),
      lvl({ cost: 160, damage: 80, range: 4.5, fireInterval: 1.0, splashRadius: 1.5, projectileSpeed: 9 }),
    ],
  },
  cryo: {
    kind: 'cryo',
    name: 'Cryo Pulse',
    description: 'Area pulse that slows every enemy in range.',
    levels: [
      lvl({ cost: 80, damage: 2, range: 2.5, fireInterval: 0.8, splashRadius: 2.5, slowFactor: 0.6, slowDuration: 1.5 }),
      lvl({ cost: 90, damage: 4, range: 3, fireInterval: 0.7, splashRadius: 3, slowFactor: 0.5, slowDuration: 2 }),
      lvl({ cost: 130, damage: 6, range: 3.5, fireInterval: 0.6, splashRadius: 3.5, slowFactor: 0.4, slowDuration: 2.5 }),
    ],
  },
  refinery: {
    kind: 'refinery',
    name: 'Magnet Refinery',
    description: 'Magnet pulls Thorium in and refines it into cash.',
    levels: [
      lvl({ cost: 120, magnetRadius: 2.5, magnetStrength: 1.5, refineTime: 2.0, valueMultiplier: 1 }),
      lvl({ cost: 140, magnetRadius: 4, magnetStrength: 2.5, refineTime: 1.5, valueMultiplier: 1.2 }),
      lvl({ cost: 200, magnetRadius: 6, magnetStrength: 4, refineTime: 1.0, valueMultiplier: 1.5 }),
    ],
  },
};

export const TOWER_KINDS: readonly TowerKind[] = ['laser', 'cannon', 'cryo', 'refinery'];

export function towerStats(kind: TowerKind, level: 0 | 1 | 2): TowerLevelStats {
  return TOWER_DEFS[kind].levels[level];
}

/** Cost of the next upgrade, or null if already max level. */
export function upgradeCost(kind: TowerKind, level: 0 | 1 | 2): number | null {
  if (level >= 2) return null;
  return TOWER_DEFS[kind].levels[(level + 1) as 1 | 2].cost;
}
