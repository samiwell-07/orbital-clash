import type { Emit, Structure, World } from '@/types';
import { WEAPON_DEFS } from '@/data';
import { damageUnit } from '../damage';
import { structureCenter, type Target } from '../targeting';

/** Continuous beam: each firing interval applies damage instantly and emits a 'beam' event. */
export function fire(w: World, s: Structure, target: Target, level: number, emit: Emit): void {
  const { x, y } = structureCenter(s);
  emit({ t: 'beam', owner: s.owner, x, y, tx: target.x, ty: target.y });
  if (target.unit) damageUnit(w, target.unit, WEAPON_DEFS.laser.damage[level], s.owner, emit);
}
