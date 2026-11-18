import { RECYCLE_FULL, REPAIR_FULL } from '../config/constants';
import type {
  BasicUnitKind, DefsApi, SpawnTowerDef, StructureKind, SupportDef, UnitDef, UnitKind, WeaponDef, WeaponKind,
} from '../types';
import { BASIC_UNITS } from '../types';
import { SPAWN_TOWER_DEFS } from './spawnTowers';
import { SUPPORT_DEFS } from './support';
import { UNIT_DEFS } from './units';
import { WEAPON_DEFS } from './weapons';

function ratio(hp: number, maxHp: number): number {
  return maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
}

export function createDefs(): DefsApi {
  return {
    unit: (kind: UnitKind): UnitDef => UNIT_DEFS[kind],
    weapon: (kind: WeaponKind): WeaponDef => WEAPON_DEFS[kind],
    spawnTower: (kind): SpawnTowerDef => SPAWN_TOWER_DEFS[kind],
    support(kind: StructureKind): SupportDef {
      if (kind in SUPPORT_DEFS) return SUPPORT_DEFS[kind as keyof typeof SUPPORT_DEFS];
      if (kind === 'basicOps' || kind === 'specialOps') {
        const t = SPAWN_TOWER_DEFS[kind];
        return { kind, name: t.name, buildCost: t.buildCost, hp: t.hp, requires: t.requires, profile: 'both' };
      }
      const w = WEAPON_DEFS[kind as WeaponKind];
      return { kind, name: w.name, buildCost: w.buildCost, hp: w.hp, requires: w.requires, profile: 'both' };
    },
    basicOutputsFor(level: number): readonly BasicUnitKind[] {
      const levels = SPAWN_TOWER_DEFS.basicOps.outputsByLevel;
      const i = Math.min(levels.length - 1, Math.max(0, Math.floor(level)));
      return levels[i].filter((k): k is BasicUnitKind => (BASIC_UNITS as readonly UnitKind[]).includes(k));
    },
    recycleRatio: (hp, maxHp) => RECYCLE_FULL * ratio(hp, maxHp),
    repairCost: (baseCost, hp, maxHp) => REPAIR_FULL * baseCost * (1 - ratio(hp, maxHp)),
  };
}

export const DEFS: DefsApi = createDefs();
