// Special-unit tuning. Base unit stats (hp, speed, structureDamage) live in src/data/units.ts.
import type { Tech, UnitKind } from '@/types';
import { UNIT_DEFS } from '@/data';

export interface ContactSpec {
  /** Max distance (tiles) from the unit centre to a structure tile's edge to count as touching. */
  reach: number;
  /** Seconds between attacks. */
  interval: number;
  /** Splash radius around the struck structure (0 = single target). */
  area: number;
}

const PAD = 0.35;
const spec = (kind: UnitKind, interval: number, area = 0): ContactSpec => ({
  reach: UNIT_DEFS[kind].radius + PAD, interval, area,
});

/** Contact attacks on enemy structures, by unit kind. Tank and Dragon hit an area. */
export const CONTACT: Readonly<Partial<Record<UnitKind, ContactSpec>>> = {
  scout: spec('scout', 0.8),
  tank: spec('tank', 1.0, 1.2),
  drone: spec('drone', 0.8),
  hammer: spec('hammer', 1.2),
  switch: spec('switch', 0.5),
  snake: spec('snake', 0.9),
  dragon: spec('dragon', 1.0, 1.5),
};

export const TORPEDO_SPLASH = 0.8;
export const TORPEDO_FUSE = 0.6;

/** Seconds a Switch disables a weapon / spawn tower, and how many structures it can switch off. */
export const SWITCH_STUN = 8;
export const SWITCH_USES = 3;

/** Max thorium a Thief steals per raid. */
export const THIEF_LOOT = 40;

export const CARRIER_CAP = 20;
export const CARGO_KIND: UnitKind = 'scout';

/**
 * Kamikaze Drones (Bionic research): drones get extra hp, and a drone passing within `reach` of a live enemy
 * ship dives into it: `damage` to the ship (raw, not weapon-scaled), `splash` damage to enemy units around it.
 */
export const KAMIKAZE = { key: 'kamikaze', hpMult: 1.5, reach: 0.6, damage: 12, splashRadius: 0.8, splash: 10 } as const;

/** Launch hp of a unit for its owner's tech (Kamikaze Drones toughen drones). */
export function launchHp(tech: Tech, kind: UnitKind): number {
  const hp = UNIT_DEFS[kind].hp;
  return kind === 'drone' && tech[KAMIKAZE.key] === true ? Math.round(hp * KAMIKAZE.hpMult) : hp;
}