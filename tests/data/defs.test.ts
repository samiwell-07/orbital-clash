import { describe, expect, it } from 'vitest';
import { RECYCLE_FULL, REPAIR_FULL } from '../../src/config/constants';
import { ALL_UNITS, WEAPONS } from '../../src/types';
import type { StructureKind } from '../../src/types';
import {
  ALL_TECH_KEYS, DEFS, RESEARCH_DEFS, SPAWN_TOWER_DEFS, SUPPORT_DEFS, TECH_STRUCTURES, TECH_UNITS, TECH_WEAPONS,
  UNIT_DEFS, WEAPON_DEFS, allTech, createDefs, isUnlocked,
} from '../../src/data';

const CAMPAIGN_KEYS = [
  'tank', 'laser', 'gateways', 'hammers', 'pulsar', 'thief', 'bomber', 'drone', 'switches', 'torpedoes', 'carrier', 'waypoint',
];

function numbers(o: unknown): number[] {
  if (typeof o === 'number') return [o];
  if (Array.isArray(o)) return o.flatMap(numbers);
  if (o && typeof o === 'object') return Object.values(o).flatMap(numbers);
  return [];
}

describe('units', () => {
  it('has a matching def for every UnitKind', () => {
    for (const k of ALL_UNITS) expect(UNIT_DEFS[k].kind).toBe(k);
    expect(Object.keys(UNIT_DEFS)).toHaveLength(ALL_UNITS.length);
  });
  it('has no negative numbers and positive hp/speed/spawn time', () => {
    for (const k of ALL_UNITS) {
      expect(numbers(UNIT_DEFS[k]).every((n) => n >= 0)).toBe(true);
      expect(UNIT_DEFS[k].hp).toBeGreaterThan(0);
      expect(UNIT_DEFS[k].speed).toBeGreaterThan(0);
      expect(UNIT_DEFS[k].spawnSeconds).toBeGreaterThan(0);
    }
  });
  it('keeps the intended roles', () => {
    const u = UNIT_DEFS;
    expect(u.scout.speed).toBeGreaterThan(u.tank.speed);
    expect(u.scout.hp).toBeLessThan(u.tank.hp);
    expect(u.drone.layer).toBe('air');
    expect(u.torpedo.structureDamage).toBeGreaterThan(u.tank.structureDamage);
    expect(u.hammer.structureDamage).toBeGreaterThan(u.torpedo.structureDamage);
    expect(u.dragon.layer).toBe('air');
  });
  it('unlock costs match the basic tower upgrade costs', () => {
    const up = SPAWN_TOWER_DEFS.basicOps.upgradeCost;
    expect([UNIT_DEFS.tank.unlockCost, UNIT_DEFS.drone.unlockCost, UNIT_DEFS.torpedo.unlockCost]).toEqual(up);
  });
});

describe('weapons', () => {
  it('has consistent per-level arrays for every WeaponKind', () => {
    for (const k of WEAPONS) {
      const w = WEAPON_DEFS[k];
      expect(w.kind).toBe(k);
      expect(w.upgradeCost).toHaveLength(w.maxLevel);
      for (const arr of [w.range, w.damage, w.cooldown]) expect(arr).toHaveLength(w.maxLevel + 1);
      expect(numbers(w).every((n) => n >= 0)).toBe(true);
      expect(w.cooldown.every((c) => c > 0)).toBe(true);
    }
  });
  it('upgrades never weaken a weapon', () => {
    for (const k of WEAPONS) {
      const w = WEAPON_DEFS[k];
      for (let i = 1; i <= w.maxLevel; i++) {
        expect(w.damage[i]).toBeGreaterThan(w.damage[i - 1]);
        expect(w.range[i]).toBeGreaterThanOrEqual(w.range[i - 1]);
      }
    }
  });
  it('documents target layers and rock smashing', () => {
    expect(WEAPON_DEFS.turret.targets).toBe('ground');
    expect(WEAPON_DEFS.laser.targets).toBe('both');
    expect(WEAPON_DEFS.pulsar.targets).toBe('both');
    expect(WEAPON_DEFS.bomber.targets).toBe('air');
    expect(WEAPONS.filter((k) => WEAPON_DEFS[k].smashesRocks)).toEqual(['turret', 'laser', 'bomber']);
  });
});

describe('spawn towers and support', () => {
  it('has consistent array lengths', () => {
    for (const t of Object.values(SPAWN_TOWER_DEFS)) {
      expect(t.upgradeCost).toHaveLength(t.maxLevel);
      expect(t.outputsByLevel).toHaveLength(t.maxLevel + 1);
      expect(t.spawnMult).toHaveLength(t.maxLevel + 1);
      expect(numbers(t).every((n) => n >= 0)).toBe(true);
    }
  });
  it('basic ops unlocks Scout -> Tank -> Drone -> Torpedo and speeds up', () => {
    expect([0, 1, 2, 3].map((l) => DEFS.basicOutputsFor(l).length)).toEqual([1, 2, 3, 4]);
    expect(DEFS.basicOutputsFor(3)).toEqual(['scout', 'tank', 'drone', 'torpedo']);
    expect(DEFS.basicOutputsFor(-2)).toEqual(['scout']);
    expect(DEFS.basicOutputsFor(99)).toHaveLength(4);
    const m = SPAWN_TOWER_DEFS.basicOps.spawnMult;
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1]);
  });
  it('support() resolves every structure kind', () => {
    const kinds: StructureKind[] = [
      ...WEAPONS, 'basicOps', 'specialOps', ...(Object.keys(SUPPORT_DEFS) as StructureKind[]),
    ];
    for (const k of kinds) {
      const s = DEFS.support(k);
      expect(s.kind).toBe(k);
      expect(s.buildCost).toBeGreaterThan(0);
      expect(s.hp).toBeGreaterThan(0);
    }
    expect(DEFS.support('laser').requires).toBe('laser');
  });
});

describe('research', () => {
  it('contains exactly the campaign keys', () => {
    expect([...ALL_TECH_KEYS].sort()).toEqual([...CAMPAIGN_KEYS].sort());
    expect(RESEARCH_DEFS.every((r) => r.cost > 0)).toBe(true);
  });
  it('every `requires` key and tech mapping resolves', () => {
    const keys = new Set(ALL_TECH_KEYS);
    for (const k of ALL_UNITS) {
      const r = UNIT_DEFS[k].requires;
      if (r !== null) expect(keys.has(r)).toBe(true);
    }
    for (const k of WEAPONS) {
      const r = WEAPON_DEFS[k].requires;
      if (r !== null) expect(keys.has(r)).toBe(true);
    }
    for (const s of [...Object.values(SUPPORT_DEFS), ...Object.values(SPAWN_TOWER_DEFS)]) {
      if (s.requires !== null) expect(keys.has(s.requires)).toBe(true);
    }
    for (const [key, unit] of Object.entries(TECH_UNITS)) expect(UNIT_DEFS[unit].requires).toBe(key);
    for (const [key, w] of Object.entries(TECH_WEAPONS)) expect(WEAPON_DEFS[w].requires).toBe(key);
    for (const [key, s] of Object.entries(TECH_STRUCTURES)) expect(DEFS.support(s).requires).toBe(key);
    const mapped = new Set([...Object.keys(TECH_UNITS), ...Object.keys(TECH_WEAPONS), ...Object.keys(TECH_STRUCTURES)]);
    for (const k of keys) expect(mapped.has(k)).toBe(true);
  });
  it('isUnlocked handles null, missing and set keys', () => {
    expect(isUnlocked({}, null)).toBe(true);
    expect(isUnlocked({}, 'laser')).toBe(false);
    expect(isUnlocked({ laser: false }, 'laser')).toBe(false);
    expect(isUnlocked({ laser: true }, 'laser')).toBe(true);
    expect(Object.values(allTech()).every(Boolean)).toBe(true);
  });
});

describe('recycle and repair', () => {
  const d = createDefs();
  it('recycle scales with health', () => {
    expect(d.recycleRatio(100, 100)).toBeCloseTo(RECYCLE_FULL);
    expect(d.recycleRatio(50, 100)).toBeCloseTo(RECYCLE_FULL / 2);
    expect(d.recycleRatio(0, 100)).toBe(0);
    expect(d.recycleRatio(150, 100)).toBeCloseTo(RECYCLE_FULL);
    expect(d.recycleRatio(5, 0)).toBe(0);
  });
  it('repair scales with damage', () => {
    expect(d.repairCost(200, 100, 100)).toBe(0);
    expect(d.repairCost(200, 0, 100)).toBeCloseTo(REPAIR_FULL * 200);
    expect(d.repairCost(200, 75, 100)).toBeCloseTo(REPAIR_FULL * 200 * 0.25);
  });
});
