// Spawn tower definitions. All numbers are TUNED balance values, not official figures.
// Basic Ops: each level unlocks the next basic unit (Scout -> Tank -> Drone -> Torpedo) and
// spawns faster. outputsByLevel is cumulative: the player may pick any unit unlocked so far.
// Special Ops ("Hammer" tower): all four specials are selectable, each gated by its research key.
import type { SpawnTowerDef } from '../types';

export const SPAWN_TOWER_DEFS: Readonly<Record<'basicOps' | 'specialOps', SpawnTowerDef>> = {
  basicOps: {
    kind: 'basicOps', name: 'Basic Ops', buildCost: 60, upgradeCost: [60, 100, 160],
    maxLevel: 3, hp: 200,
    outputsByLevel: [
      ['scout'],
      ['scout', 'tank'],
      ['scout', 'tank', 'drone'],
      ['scout', 'tank', 'drone', 'torpedo'],
    ],
    spawnMult: [1, 1.4, 1.8, 2.3],
    requires: null,
  },
  specialOps: {
    kind: 'specialOps', name: 'Special Ops', buildCost: 140, upgradeCost: [120, 200],
    maxLevel: 2, hp: 260,
    outputsByLevel: [
      ['hammer', 'switch', 'thief', 'carrier'],
      ['hammer', 'switch', 'thief', 'carrier'],
      ['hammer', 'switch', 'thief', 'carrier'],
    ],
    spawnMult: [1, 1.5, 2],
    requires: 'hammers',
  },
};
