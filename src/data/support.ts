// Support / economy structure definitions. All numbers are TUNED balance values.
// Silo and missile defense belong to the Bionic Swarm profile; the rest exist in both profiles.
import type { SupportDef, SupportKind } from '../types';

export const SUPPORT_DEFS: Readonly<Record<SupportKind, SupportDef>> = {
  harvester: { kind: 'harvester', name: 'Harvester', buildCost: 80, hp: 90, requires: null, profile: 'both' },
  researchLab: { kind: 'researchLab', name: 'Research Lab', buildCost: 150, hp: 120, requires: null, profile: 'both' },
  missileSilo: { kind: 'missileSilo', name: 'Missile Silo', buildCost: 200, hp: 160, requires: null, profile: 'bionic' },
  missileDefense: { kind: 'missileDefense', name: 'Missile Defense', buildCost: 160, hp: 140, requires: null, profile: 'bionic' },
  gateway: { kind: 'gateway', name: 'Gateway', buildCost: 100, hp: 80, requires: 'gateways', profile: 'both' },
  waypoint: { kind: 'waypoint', name: 'Waypoint', buildCost: 30, hp: 50, requires: 'waypoint', profile: 'both' },
};
