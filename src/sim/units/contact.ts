import type { Emit, Structure, Unit, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { damageStructure, splashStructures } from '@/sim/combat/damage';
import { hostile } from '@/sim/combat/targeting';
import type { ContactSpec } from './tuning';

const timers = new WeakMap<Unit, number>();

/** Nearest hostile structure whose tile edge is within `reach` of the unit (optionally filtered). */
export function nearestHostileStructure(
  w: World, u: Unit, reach: number, pred?: (s: Structure) => boolean,
): Structure | undefined {
  const g = w.grid;
  let best: Structure | undefined;
  let bd = reach * reach;
  const y1 = Math.min(g.h - 1, Math.floor(u.y + reach));
  const x1 = Math.min(g.w - 1, Math.floor(u.x + reach));
  for (let ty = Math.max(0, Math.floor(u.y - reach)); ty <= y1; ty++) {
    for (let tx = Math.max(0, Math.floor(u.x - reach)); tx <= x1; tx++) {
      const id = g.occupant[ty * g.w + tx];
      if (id === 0) continue;
      const s = w.structures.get(id);
      if (!s || !hostile(w, u.owner, s.owner) || (pred && !pred(s))) continue;
      const dx = Math.max(tx - u.x, 0, u.x - (tx + 1));
      const dy = Math.max(ty - u.y, 0, u.y - (ty + 1));
      const d = dx * dx + dy * dy;
      if (d <= bd) {
        bd = d;
        best = s;
      }
    }
  }
  return best;
}

/**
 * Melee attack on the nearest touched enemy structure, throttled per unit.
 * Returns the structure in contact (attacked or on cooldown), if any.
 */
export function contactAttack(w: World, u: Unit, dt: number, emit: Emit, spec: ContactSpec): Structure | undefined {
  const t = (timers.get(u) ?? 0) - dt;
  const s = nearestHostileStructure(w, u, spec.reach);
  if (!s) {
    timers.set(u, Math.max(0, t));
    return undefined;
  }
  if (t > 0) {
    timers.set(u, t);
    return s;
  }
  timers.set(u, spec.interval);
  const dmg = UNIT_DEFS[u.kind].structureDamage;
  if (spec.area > 0) {
    splashStructures(w, s.tx + 0.5, s.ty + 0.5, spec.area, dmg, u.owner, emit);
    emit({ t: 'explosion', x: s.tx + 0.5, y: s.ty + 0.5, radius: spec.area, big: false });
  } else {
    damageStructure(w, s, dmg, u.owner, emit);
  }
  return s;
}
