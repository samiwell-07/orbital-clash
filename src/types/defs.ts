import type { PlayerId, UnitKind, StructureKind, WeaponKind, BasicUnitKind, TargetMask, Layer } from './ids';

/** Static definition of a unit type. All numbers are tuned, not official. */
export interface UnitDef {
  kind: UnitKind;
  name: string;
  tier: 'basic' | 'special' | 'bionic';
  layer: Layer;
  hp: number;
  /** tiles per second */
  speed: number;
  /** damage dealt to structures per hit */
  structureDamage: number;
  /** damage a unit deals to a base on arrival (hit counts as 1 'hit' of Max Hits) */
  baseHits: number;
  /** Seconds a spawn tower needs to produce one unit at level 0. */
  spawnSeconds: number;
  /** Thorium to buy/switch the tower to this output upgrade level. */
  unlockCost: number;
  /** Research key required (campaign tech unlock), or null for always available. */
  requires: string | null;
  /** Visual radius in tiles for crowd spacing. */
  radius: number;
}

export interface WeaponDef {
  kind: WeaponKind;
  name: string;
  targets: TargetMask;
  maxLevel: number;
  buildCost: number;
  upgradeCost: readonly number[];
  hp: number;
  /** Per level: range in tiles, damage per shot, seconds between shots. */
  range: readonly number[];
  damage: readonly number[];
  cooldown: readonly number[];
  splash: number;
  /** Can smash drifting rocks to release Thorium (Turret, Laser, Bomber). */
  smashesRocks: boolean;
  requires: string | null;
}

export interface SpawnTowerDef {
  kind: 'basicOps' | 'specialOps';
  name: string;
  buildCost: number;
  upgradeCost: readonly number[];
  maxLevel: number;
  hp: number;
  /** Basic Ops: output unlocked per level, in order. Special Ops: all specials gated by research. */
  outputsByLevel: readonly (readonly UnitKind[])[];
  /** Spawn speed multiplier per level. */
  spawnMult: readonly number[];
  requires: string | null;
}

export interface SupportDef {
  kind: StructureKind;
  name: string;
  buildCost: number;
  hp: number;
  requires: string | null;
  profile: 'base' | 'bionic' | 'both';
}

export interface ResearchDef {
  key: string;
  name: string;
  description: string;
  cost: number;
}

export type Tech = Readonly<Record<string, boolean>>;

export interface DefsApi {
  unit(kind: UnitKind): UnitDef;
  weapon(kind: WeaponKind): WeaponDef;
  spawnTower(kind: 'basicOps' | 'specialOps'): SpawnTowerDef;
  support(kind: StructureKind): SupportDef;
  basicOutputsFor(level: number): readonly BasicUnitKind[];
  recycleRatio(hp: number, maxHp: number): number;
  repairCost(baseCost: number, hp: number, maxHp: number): number;
}

export type { PlayerId };
