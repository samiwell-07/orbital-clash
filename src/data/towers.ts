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
  harvesters: 0,
};

function lvl(stats: Partial<TowerLevelStats>): TowerLevelStats {
  return { ...BASE, ...stats };
}

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  laser: {
    kind: 'laser',
    name: 'Red Laser',
    description: 'Rapid red laser. Hits ground and air.',
    hitsGround: true,
    hitsAir: true,
    levels: [
      lvl({ cost: 30, damage: 5, range: 2.6, fireInterval: 0.22 }),
      lvl({ cost: 40, damage: 8, range: 3, fireInterval: 0.17 }),
      lvl({ cost: 80, damage: 13, range: 3.5, fireInterval: 0.12 }),
    ],
  },
  cannon: {
    kind: 'cannon',
    name: 'Fireball Mortar',
    description: 'Explosive fireballs with splash. Ground only.',
    hitsGround: true,
    hitsAir: false,
    levels: [
      lvl({ cost: 55, damage: 22, range: 3, fireInterval: 1.2, splashRadius: 0.9, projectileSpeed: 7 }),
      lvl({ cost: 65, damage: 36, range: 3.5, fireInterval: 1.0, splashRadius: 1.1, projectileSpeed: 8 }),
      lvl({ cost: 120, damage: 60, range: 4, fireInterval: 0.8, splashRadius: 1.4, projectileSpeed: 9 }),
    ],
  },
  cryo: {
    kind: 'cryo',
    name: 'Frost Emitter',
    description: 'Blue frost wave slows every ground unit nearby.',
    hitsGround: true,
    hitsAir: false,
    levels: [
      lvl({ cost: 45, damage: 2, range: 2, fireInterval: 0.9, splashRadius: 2, slowFactor: 0.55, slowDuration: 1.5 }),
      lvl({ cost: 55, damage: 3, range: 2.5, fireInterval: 0.8, splashRadius: 2.5, slowFactor: 0.45, slowDuration: 2 }),
      lvl({ cost: 95, damage: 5, range: 3, fireInterval: 0.7, splashRadius: 3, slowFactor: 0.35, slowDuration: 2.5 }),
    ],
  },
  plasma: {
    kind: 'plasma',
    name: 'Plasma Lance',
    description: 'Searing yellow-white plasma stream that burns through packed swarms.',
    hitsGround: true,
    hitsAir: true,
    levels: [
      lvl({ cost: 75, damage: 3, range: 3, fireInterval: 0.08, splashRadius: 0.45 }),
      lvl({ cost: 90, damage: 5, range: 3.4, fireInterval: 0.07, splashRadius: 0.55 }),
      lvl({ cost: 150, damage: 8, range: 3.8, fireInterval: 0.06, splashRadius: 0.7 }),
    ],
  },
  refinery: {
    kind: 'refinery',
    name: 'Harvest Station',
    description: 'Launches harvester drones; its magnet pulls nearby Thorium in and refines it.',
    hitsGround: false,
    hitsAir: false,
    levels: [
      lvl({ cost: 110, magnetRadius: 2, magnetStrength: 1.5, refineTime: 1.4, valueMultiplier: 1, harvesters: 1 }),
      lvl({ cost: 130, magnetRadius: 3, magnetStrength: 2.5, refineTime: 1.1, valueMultiplier: 1.2, harvesters: 2 }),
      lvl({ cost: 190, magnetRadius: 4.5, magnetStrength: 4, refineTime: 0.8, valueMultiplier: 1.5, harvesters: 3 }),
    ],
  },
};

export const TOWER_KINDS: readonly TowerKind[] = ['laser', 'cannon', 'cryo', 'plasma', 'refinery'];

export function towerStats(kind: TowerKind, level: 0 | 1 | 2): TowerLevelStats {
  return TOWER_DEFS[kind].levels[level];
}

/** Cost of the next upgrade, or null if already max level (2). Research gating is checked by BuildSystem. */
export function upgradeCost(kind: TowerKind, level: 0 | 1 | 2): number | null {
  if (level >= 2) return null;
  return TOWER_DEFS[kind].levels[(level + 1) as 1 | 2].cost;
}
