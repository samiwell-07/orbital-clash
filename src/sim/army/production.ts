import type { Structure, System, UnitKind, World } from '@/types';
import { SPAWN_TOWER_DEFS, UNIT_DEFS } from '@/data';
import { overtimeMult } from '@/sim/core';
import { DEFAULT_BASIC_OUTPUT } from './constants';
import { storageFull, storedOf } from './storage';

const MAX_SPAWNS_PER_TICK = 8;

export function towerOutput(s: Structure): UnitKind | null {
  if (s.output) return s.output;
  return s.kind === 'basicOps' ? DEFAULT_BASIC_OUTPUT : null;
}

/** Seconds between units: unit spawnSeconds / tower spawnMult[level] / overtime multiplier. */
export function spawnInterval(w: World, s: Structure): number {
  const kind = towerOutput(s);
  if (!kind || (s.kind !== 'basicOps' && s.kind !== 'specialOps')) return Infinity;
  const mults = SPAWN_TOWER_DEFS[s.kind].spawnMult;
  const mult = mults[Math.min(mults.length - 1, Math.max(0, s.level))];
  return UNIT_DEFS[kind].spawnSeconds / mult / overtimeMult(w);
}

/** Stage 'production': towers teleport new units into the owner's base; a full base pauses them. */
export const productionSystem: System = (w, dt, emit) => {
  for (const s of w.structures.values()) {
    if (s.kind !== 'basicOps' && s.kind !== 'specialOps') continue;
    const p = w.players[s.owner];
    if (!p.alive || !p.baseBuilt) continue;
    const kind = towerOutput(s);
    if (!kind) continue;
    s.cooldown -= dt;
    for (let n = 0; s.cooldown <= 0 && n < MAX_SPAWNS_PER_TICK; n++) {
      if (storageFull(p)) {
        s.cooldown = 0;
        break;
      }
      p.stored[kind] = storedOf(p, kind) + 1;
      emit({ t: 'unitSpawned', owner: s.owner, kind, fromId: s.id });
      s.cooldown += spawnInterval(w, s);
    }
  }
};
