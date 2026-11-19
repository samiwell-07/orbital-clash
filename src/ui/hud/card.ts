import type { PlayerId, Structure, StructureKind, UnitKind, World } from '../../types';
import { WEAPONS } from '../../types';
import { DEFS, SPAWN_TOWER_DEFS, researchDef } from '../../data';
import type { WeaponKind } from '../../types';

export interface StructureCard {
  id: number;
  kind: StructureKind;
  name: string;
  owner: PlayerId;
  level: number;
  maxLevel: number;
  hp: number;
  maxHp: number;
  /** Own structures only; null otherwise or when maxed. */
  upgradeCost: number | null;
  recycle: number | null;
  repair: number | null;
  /** Spawn towers: what the tower makes now. */
  output: UnitKind | null;
  /** Spawn towers: the unit the next upgrade level unlocks. */
  nextOutput: UnitKind | null;
  /** Weapons: text-only stats (the terrain layer draws the range ring). */
  stats: string | null;
  locked: string | null;
}

export function structureAt(world: World, tx: number, ty: number): Structure | null {
  const { grid } = world;
  if (tx < 0 || ty < 0 || tx >= grid.w || ty >= grid.h) return null;
  const id = grid.occupant[ty * grid.w + tx];
  return id ? world.structures.get(id) ?? null : null;
}

interface Costs {
  buildCost: number;
  upgrade: readonly number[];
  maxLevel: number;
}

function costsOf(kind: StructureKind): Costs {
  if ((WEAPONS as readonly string[]).includes(kind)) {
    const d = DEFS.weapon(kind as WeaponKind);
    return { buildCost: d.buildCost, upgrade: d.upgradeCost, maxLevel: d.maxLevel };
  }
  if (kind === 'basicOps' || kind === 'specialOps') {
    const d = SPAWN_TOWER_DEFS[kind];
    return { buildCost: d.buildCost, upgrade: d.upgradeCost, maxLevel: d.maxLevel };
  }
  const d = DEFS.support(kind);
  return { buildCost: d.buildCost, upgrade: d.upgradeCost ?? [], maxLevel: d.maxLevel ?? 0 };
}

/** Thorium put into a structure so far: build cost + the upgrades already bought. */
export function invested(kind: StructureKind, level: number): number {
  const c = costsOf(kind);
  let sum = c.buildCost;
  for (let i = 0; i < level && i < c.upgrade.length; i++) sum += c.upgrade[i];
  return sum;
}

function nextUnit(kind: StructureKind, level: number): UnitKind | null {
  if (kind !== 'basicOps') return null;
  const levels = SPAWN_TOWER_DEFS.basicOps.outputsByLevel;
  const now = new Set<UnitKind>(levels[Math.min(level, levels.length - 1)]);
  const next = levels[Math.min(level + 1, levels.length - 1)].find((u) => !now.has(u));
  return next ?? null;
}

function weaponStats(kind: StructureKind, level: number): string | null {
  if (!(WEAPONS as readonly string[]).includes(kind)) return null;
  const d = DEFS.weapon(kind as WeaponKind);
  const i = Math.min(level, d.range.length - 1);
  const targets = d.targets === 'both' ? 'ground + air' : d.targets;
  return `Range ${d.range[i]} · Dmg ${d.damage[i]} · ${d.cooldown[i]}s · ${targets}`;
}

export function structureCard(world: World, s: Structure, viewer: PlayerId): StructureCard {
  const c = costsOf(s.kind);
  const own = s.owner === viewer || world.players[s.owner]?.team === world.players[viewer]?.team;
  const maxed = s.level >= c.maxLevel;
  const tech = world.players[viewer]?.tech ?? {};
  const need = DEFS.support(s.kind).requires;
  const locked = own && need && !tech[need] ? `Requires ${researchDef(need)?.name ?? need}` : null;
  return {
    id: s.id,
    kind: s.kind,
    name: DEFS.support(s.kind).name,
    owner: s.owner,
    level: s.level,
    maxLevel: c.maxLevel,
    hp: s.hp,
    maxHp: s.maxHp,
    upgradeCost: own && !maxed ? c.upgrade[s.level] ?? null : null,
    recycle: own ? Math.round(invested(s.kind, s.level) * DEFS.recycleRatio(s.hp, s.maxHp)) : null,
    repair: own && s.hp < s.maxHp ? Math.ceil(DEFS.repairCost(c.buildCost, s.hp, s.maxHp) - 1e-9) : null,
    output: s.output,
    nextOutput: own && !maxed ? nextUnit(s.kind, s.level) : null,
    stats: weaponStats(s.kind, s.level),
    locked,
  };
}
