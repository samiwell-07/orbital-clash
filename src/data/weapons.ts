// Defensive weapon definitions. All numbers are TUNED balance values, not official figures.
// Target layers (manual: "some only ground, some only air, some both"):
//   Turret  -> ground only (cheap workhorse)
//   Laser   -> both (precise, no splash)
//   Pulsar  -> both (area pulse, splash, slow)
//   Bomber  -> air only (flak-style splash against drones/dragons)
// Weapons never shoot rocks: thorium comes only from Harvesters.
// Per-level arrays have maxLevel + 1 entries; upgradeCost has maxLevel entries.
import type { WeaponDef, WeaponKind } from '../types';

export const WEAPON_DEFS: Readonly<Record<WeaponKind, WeaponDef>> = {
  turret: {
    kind: 'turret', name: 'Turret', targets: 'ground', maxLevel: 3,
    buildCost: 50, upgradeCost: [40, 70, 110], hp: 120,
    range: [4.0, 4.5, 5.0, 5.5], damage: [8, 11, 15, 20], cooldown: [0.5, 0.45, 0.4, 0.35],
    splash: 0, requires: null,
  },
  laser: {
    kind: 'laser', name: 'Laser', targets: 'both', maxLevel: 3,
    buildCost: 120, upgradeCost: [80, 130, 200], hp: 100,
    range: [5.0, 5.5, 6.0, 7.0], damage: [5, 7, 10, 14], cooldown: [0.2, 0.2, 0.18, 0.16],
    splash: 0, requires: 'laser',
  },
  pulsar: {
    kind: 'pulsar', name: 'Pulsar', targets: 'both', maxLevel: 3,
    buildCost: 150, upgradeCost: [100, 160, 240], hp: 140,
    range: [3.5, 3.8, 4.2, 4.6], damage: [6, 9, 13, 18], cooldown: [0.9, 0.85, 0.8, 0.7],
    splash: 1.5, requires: 'pulsar',
  },
  bomber: {
    kind: 'bomber', name: 'Bomber', targets: 'air', maxLevel: 3,
    buildCost: 130, upgradeCost: [90, 140, 210], hp: 110,
    range: [5.0, 5.5, 6.0, 6.5], damage: [40, 60, 85, 120], cooldown: [2.2, 2.0, 1.8, 1.6],
    splash: 1.2, requires: 'bomber',
  },
};
