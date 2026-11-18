import { SPAWN_TOWER_DEFS, WEAPON_DEFS } from '@/data';
import type { StructureKind } from '@/types';

export const GROWN_VARIANT = 4;

/** Level -> corner mark description (style guide section 4). */
export interface UpgradeMarks {
  /** Triangles per corner (0..3). */
  marks: number;
  /** Max level reached: platform grows and corners turn solid black. */
  grown: boolean;
}

export function upgradeMarks(level: number, maxLevel: number): UpgradeMarks {
  const l = Math.max(0, Math.floor(level));
  if (maxLevel <= 0) return { marks: 0, grown: false };
  if (l >= maxLevel) return { marks: Math.min(3, maxLevel), grown: true };
  return { marks: Math.min(3, l), grown: false };
}

/** Platform geometry variant: 0..3 = that many marks, 4 = grown with solid corners. */
export function platformVariant(level: number, maxLevel: number): number {
  const m = upgradeMarks(level, maxLevel);
  return m.grown ? GROWN_VARIANT : m.marks;
}

export function maxLevelOf(kind: StructureKind): number {
  if (kind === 'basicOps' || kind === 'specialOps') return SPAWN_TOWER_DEFS[kind].maxLevel;
  const w = (WEAPON_DEFS as Record<string, { maxLevel: number } | undefined>)[kind];
  return w ? w.maxLevel : 0;
}
