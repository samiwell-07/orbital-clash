// Research (tech unlock) definitions. Costs are TUNED balance values.
// Scout and Turret are always available (requires: null) and have no research entry.
import type { ResearchDef, StructureKind, Tech, UnitKind, WeaponKind } from '../types';

export const RESEARCH_DEFS: readonly ResearchDef[] = [
  { key: 'tank', name: 'Tanks', description: 'Slow, tough ground units. Basic Ops level 1.', cost: 60 },
  { key: 'laser', name: 'Lasers', description: 'Rapid-fire weapon hitting ground and air; smashes rocks.', cost: 100 },
  { key: 'gateways', name: 'Gateways', description: 'Paired portals that teleport ground units.', cost: 120 },
  { key: 'hammers', name: 'Hammers', description: 'Unlocks the Special Ops tower and the Hammer unit.', cost: 140 },
  { key: 'pulsar', name: 'Pulsars', description: 'Area pulse weapon hitting ground and air.', cost: 130 },
  { key: 'thief', name: 'Thieves', description: 'Special unit that steals enemy thorium.', cost: 150 },
  { key: 'bomber', name: 'Bombers', description: 'Splash weapon against air units; smashes rocks.', cost: 130 },
  { key: 'drone', name: 'Drones', description: 'Fast flying units that ignore the maze.', cost: 100 },
  { key: 'switches', name: 'Switches', description: 'Special unit that toggles and redirects structures.', cost: 160 },
  { key: 'torpedoes', name: 'Torpedoes', description: 'Heavy structure damage. Basic Ops level 3.', cost: 160 },
  { key: 'carrier', name: 'Carriers', description: 'Special unit that ferries other units.', cost: 180 },
  { key: 'waypoint', name: 'Waypoints', description: 'Steer your attack routes through the maze.', cost: 90 },
];

export const TECH_UNITS: Readonly<Record<string, UnitKind>> = {
  tank: 'tank', drone: 'drone', torpedoes: 'torpedo',
  hammers: 'hammer', switches: 'switch', thief: 'thief', carrier: 'carrier',
};

export const TECH_WEAPONS: Readonly<Record<string, WeaponKind>> = {
  laser: 'laser', pulsar: 'pulsar', bomber: 'bomber',
};

/** Techs that unlock a structure rather than a unit or weapon. */
export const TECH_STRUCTURES: Readonly<Record<string, StructureKind>> = {
  gateways: 'gateway', hammers: 'specialOps', waypoint: 'waypoint',
};

export const ALL_TECH_KEYS: readonly string[] = RESEARCH_DEFS.map((r) => r.key);

/** A null requirement (always available) counts as unlocked. */
export function isUnlocked(tech: Tech, key: string | null): boolean {
  return key === null || tech[key] === true;
}

export function researchDef(key: string): ResearchDef | undefined {
  return RESEARCH_DEFS.find((r) => r.key === key);
}

/** Tech state with every research unlocked (Battle mode default). */
export function allTech(): Record<string, boolean> {
  return Object.fromEntries(ALL_TECH_KEYS.map((k) => [k, true]));
}
