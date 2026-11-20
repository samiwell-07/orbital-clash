import type { Emit, Intent, Structure, Tech, UnitKind, World } from '@/types';
import { DEFS, SPAWN_TOWER_DEFS, UNIT_DEFS, isUnlocked } from '@/data';
import { structureAt } from '@/sim/core';

/** Units the tower could currently produce, in cycle order (level-gated, then research-gated). */
export function unlockedOutputs(tech: Tech, kind: Structure['kind'], level: number): UnitKind[] {
  let pool: readonly UnitKind[] = [];
  if (kind === 'basicOps') pool = DEFS.basicOutputsFor(level);
  else if (kind === 'specialOps') {
    const levels = SPAWN_TOWER_DEFS.specialOps.outputsByLevel;
    pool = levels[Math.min(levels.length - 1, Math.max(0, level))];
  }
  return pool.filter((k) => isUnlocked(tech, UNIT_DEFS[k].requires));
}

/** Initial output of a new spawn tower: first unlocked unit (Special Ops prefers the Hammer). */
export function defaultOutput(tech: Tech, kind: Structure['kind']): UnitKind | null {
  const list = unlockedOutputs(tech, kind, 0);
  if (kind === 'specialOps' && list.includes('hammer')) return 'hammer';
  return list[0] ?? null;
}

export function nextOutput(tech: Tech, s: Structure): UnitKind | null {
  const list = unlockedOutputs(tech, s.kind, s.level);
  if (list.length === 0) return null;
  const i = s.output ? list.indexOf(s.output) : -1;
  return list[(i + 1) % list.length];
}

export function handleCycleOutput(w: World, intent: Intent, _emit: Emit): boolean {
  if (intent.t !== 'cycleOutput') return false;
  const s = structureAt(w, intent.tx, intent.ty);
  if (!s || s.owner !== intent.player || (s.kind !== 'basicOps' && s.kind !== 'specialOps')) return true;
  const next = nextOutput(w.players[intent.player].tech, s);
  if (next) s.output = next;
  return true;
}
