// Support / economy structure definitions. All numbers are TUNED balance values.
// Research Lab, Silo and missile defense belong to the Bionic Swarm profile; the rest exist in both profiles.
// Silo and missile defense are researched at the lab (see the bionic entries in research.ts).
import type { SupportDef, SupportKind } from '../types';

export const SUPPORT_DEFS: Readonly<Record<SupportKind, SupportDef>> = {
  // Each Harvester level widens its rock magnet (see ECON.harvesterRange).
  harvester: {
    kind: 'harvester', name: 'Harvester', buildCost: 80, hp: 90, requires: null, profile: 'both',
    maxLevel: 3, upgradeCost: [60, 100, 150],
  },
  researchLab: { kind: 'researchLab', name: 'Research Lab', buildCost: 150, hp: 120, requires: null, profile: 'bionic' },
  missileSilo: {
    kind: 'missileSilo', name: 'Missile Silo', buildCost: 200, hp: 160, requires: 'missileSilo', profile: 'bionic',
  },
  missileDefense: {
    kind: 'missileDefense', name: 'Missile Defense', buildCost: 160, hp: 140, requires: 'missileDefense', profile: 'bionic',
  },
  gateway: { kind: 'gateway', name: 'Gateway', buildCost: 100, hp: 80, requires: 'gateways', profile: 'both' },
  waypoint: { kind: 'waypoint', name: 'Waypoint', buildCost: 30, hp: 50, requires: 'waypoint', profile: 'both' },
};

/**
 * Missile Silo: holds one missile and reloads it over reloadSec (the first load starts when it is placed).
 * Holding the missile button for chargeSec fires every loaded silo the player owns at the targeted enemy base.
 */
export const MISSILE_SILO = {
  reloadSec: 30,
  chargeSec: 3,
  speed: 6,
  damage: 80,
  splash: 1.5,
} as const;
