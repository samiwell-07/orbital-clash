// Unit definitions. All numbers are TUNED balance values, not official figures.
// Roles: scout fast+fragile, tank slow+tough, drone flies (air layer, ignores the maze),
// torpedo = glass-cannon structure buster, hammer smashes structures, switch toggles/redirects
// enemy structures, thief steals thorium (no base hit), carrier ferries units (no base hit),
// snake/dragon are the Bionic Swarm army (dragon flies).
import type { UnitDef, UnitKind } from '../types';

const basic = { tier: 'basic', requires: null } as const;

export const UNIT_DEFS: Readonly<Record<UnitKind, UnitDef>> = {
  scout: {
    ...basic, kind: 'scout', name: 'Scout', layer: 'ground',
    hp: 25, speed: 4.0, structureDamage: 1, baseHits: 1,
    spawnSeconds: 1.0, unlockCost: 0, radius: 0.22,
  },
  tank: {
    ...basic, kind: 'tank', name: 'Tank', layer: 'ground', requires: 'tank',
    hp: 160, speed: 1.6, structureDamage: 6, baseHits: 1,
    spawnSeconds: 2.0, unlockCost: 60, radius: 0.4,
  },
  drone: {
    ...basic, kind: 'drone', name: 'Drone', layer: 'air', requires: 'drone',
    hp: 45, speed: 3.2, structureDamage: 2, baseHits: 1,
    spawnSeconds: 1.6, unlockCost: 100, radius: 0.26,
  },
  torpedo: {
    ...basic, kind: 'torpedo', name: 'Torpedo', layer: 'ground', requires: 'torpedoes',
    hp: 60, speed: 2.4, structureDamage: 90, baseHits: 2,
    spawnSeconds: 3.0, unlockCost: 160, radius: 0.3,
  },
  hammer: {
    kind: 'hammer', name: 'Hammer', tier: 'special', layer: 'ground', requires: 'hammers',
    hp: 300, speed: 1.8, structureDamage: 200, baseHits: 2,
    spawnSeconds: 4.0, unlockCost: 0, radius: 0.45,
  },
  switch: {
    kind: 'switch', name: 'Switch', tier: 'special', layer: 'ground', requires: 'switches',
    hp: 70, speed: 2.6, structureDamage: 0, baseHits: 1,
    spawnSeconds: 3.5, unlockCost: 0, radius: 0.28,
  },
  thief: {
    kind: 'thief', name: 'Thief', tier: 'special', layer: 'ground', requires: 'thief',
    hp: 40, speed: 3.4, structureDamage: 0, baseHits: 0,
    spawnSeconds: 3.0, unlockCost: 0, radius: 0.24,
  },
  carrier: {
    kind: 'carrier', name: 'Carrier', tier: 'special', layer: 'ground', requires: 'carrier',
    hp: 400, speed: 1.4, structureDamage: 0, baseHits: 0,
    spawnSeconds: 6.0, unlockCost: 0, radius: 0.55,
  },
  snake: {
    kind: 'snake', name: 'Snake', tier: 'bionic', layer: 'ground', requires: null,
    hp: 90, speed: 2.2, structureDamage: 4, baseHits: 1,
    spawnSeconds: 5.0, unlockCost: 0, radius: 0.3,
  },
  dragon: {
    kind: 'dragon', name: 'Dragon', tier: 'bionic', layer: 'air', requires: null,
    hp: 260, speed: 3.0, structureDamage: 30, baseHits: 3,
    spawnSeconds: 8.0, unlockCost: 0, radius: 0.5,
  },
};
