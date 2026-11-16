import type { BuildAction, UnitDef, UnitKind } from '../types';

export const UNIT_DEFS: Record<UnitKind, UnitDef> = {
  scout: {
    kind: 'scout',
    name: 'Dart Scout',
    description: 'Fast and cheap, fragile.',
    cost: 15,
    maxHp: 30,
    maxShield: 0,
    shieldRegen: 0,
    shieldRegenDelay: 0,
    shieldLaserMult: 1,
    speed: 2.6,
    baseDamage: 3,
    bounty: 4,
    radius: 7,
  },
  tank: {
    kind: 'tank',
    name: 'Bulwark Tank',
    description: 'Slow, heavily armored, hits the base hard.',
    cost: 45,
    maxHp: 220,
    maxShield: 0,
    shieldRegen: 0,
    shieldRegenDelay: 0,
    shieldLaserMult: 1,
    speed: 1.0,
    baseDamage: 10,
    bounty: 12,
    radius: 13,
  },
  shielded: {
    kind: 'shielded',
    name: 'Aegis Walker',
    description: 'Regenerating energy shield shrugs off lasers.',
    cost: 35,
    maxHp: 70,
    maxShield: 90,
    shieldRegen: 12,
    shieldRegenDelay: 2,
    shieldLaserMult: 0.5,
    speed: 1.6,
    baseDamage: 6,
    bounty: 9,
    radius: 10,
  },
};

export const UNIT_KINDS: readonly UnitKind[] = ['scout', 'tank', 'shielded'];

/** Hotkey slots 1..7 (index 0..6), shared by both players and the build menu. */
export const SLOT_ACTIONS: readonly BuildAction[] = [
  { type: 'build', kind: 'laser' },
  { type: 'build', kind: 'cannon' },
  { type: 'build', kind: 'cryo' },
  { type: 'build', kind: 'refinery' },
  { type: 'send', kind: 'scout' },
  { type: 'send', kind: 'tank' },
  { type: 'send', kind: 'shielded' },
];
