import type { Intent, PlayerId, SimApi, StructureKind, UnitKind, World } from '@/types';
import { WEAPONS } from '@/types';
import { createSim, FixedStepLoop, structureAt } from '@/sim/core';
import { createInput, type InputController } from '@/input';
import { buildKindsFor, attackKindsFor } from '@/ui';
import { DEFS } from '@/data';
import type { RunSpec } from './runSpec';

export interface Session {
  spec: RunSpec;
  sim: SimApi;
  input: InputController;
  /** Advances the simulation for one rendered frame; returns the interpolation alpha. */
  frame(dt: number): number;
  dispose(): void;
}

const CONTINUOUS = new Set<Intent['t']>(['move', 'grab']);

export function createSession(spec: RunSpec): Session {
  const sim = createSim(spec.options);
  const w = sim.world;
  const humans = spec.humans.length > 0 ? spec.humans : ([0] as PlayerId[]);
  const input = createInput({
    players: humans,
    getBuildItems: () => buildKindsFor(w) as readonly StructureKind[],
    getAttackUnits: () => attackKindsFor(w) as readonly UnitKind[],
    getCursor: (p) => ({ tx: w.players[p].ship.cursorTx, ty: w.players[p].ship.cursorTy }),
    getStructureKindAt: (tx, ty) => structureAt(w, tx, ty)?.kind ?? null,
    hasBase: (p) => w.players[p].baseBuilt,
  });
  const loop = new FixedStepLoop();
  const carried: Intent[] = [];

  return {
    spec, sim, input,
    frame(dt) {
      const polled = input.poll(dt);
      let first = true;
      const alpha = loop.advance(dt, () => {
        // Edge-triggered intents (build, upgrade, pause...) apply once; analog ones every fixed step.
        if (first) sim.step(polled);
        else {
          carried.length = 0;
          for (const it of polled) if (CONTINUOUS.has(it.t)) carried.push(it);
          sim.step(carried);
        }
        first = false;
      });
      if (first && polled.length > 0) sim.step(polled.filter((i) => i.t === 'pause'));
      return alpha;
    },
    dispose() {
      input.dispose();
    },
  };
}

/** Range (tiles) of the weapon under a tile, for the dashed red ring the manual describes. */
export function rangeAt(w: World, tx: number, ty: number): number {
  const s = structureAt(w, tx, ty);
  if (!s || !(WEAPONS as readonly string[]).includes(s.kind)) return 0;
  const def = DEFS.weapon(s.kind as (typeof WEAPONS)[number]);
  return def.range[Math.min(s.level, def.range.length - 1)];
}
