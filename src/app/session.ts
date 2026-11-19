import type { DeviceId, Intent, PlayerId, SimApi, StructureKind, UnitKind, World } from '@/types';
import { WEAPONS } from '@/types';
import { createSim, FixedStepLoop, structureAt } from '@/sim/core';
import { createInput, type CreateInputOptions, type InputController } from '@/input';
import { buildKindsFor, attackKindsFor } from '@/ui';
import { DEFS } from '@/data';
import type { RunSpec } from './runSpec';

export interface Session {
  spec: RunSpec;
  sim: SimApi;
  input: InputController;
  /** Advances the simulation for one rendered frame; returns the interpolation alpha. */
  frame(dt: number): number;
  /** Applies shell-made intents (pause-menu Resume); online sessions route them through lockstep. */
  submit(intents: Intent[]): void;
  /** Pause-overlay warning while a lobby controller is unplugged, else null. */
  pauseNotice(): string | null;
  /** Top-of-screen status line (online: waiting for a peer, a player left, desync), else null. */
  banner(): string | null;
  dispose(): void;
}

/** Intents the input layer emits every poll (analog); every other intent is an edge that must apply exactly once. */
export const CONTINUOUS: ReadonlySet<Intent['t']> = new Set<Intent['t']>(['move', 'grab']);

export type SessionIo = Pick<CreateInputOptions, 'getGamepads' | 'keyboard'>;

/** createInput options for the given local players, with the world-reading hooks every session uses. */
export function sessionInputOptions(
  w: World, players: readonly PlayerId[], bindings: ReadonlyMap<PlayerId, DeviceId> | undefined, io: SessionIo = {},
): CreateInputOptions {
  return {
    ...io,
    players,
    bindings,
    getBuildItems: () => buildKindsFor(w) as readonly StructureKind[],
    getAttackUnits: () => attackKindsFor(w) as readonly UnitKind[],
    getCursor: (p) => ({ tx: w.players[p].ship.cursorTx, ty: w.players[p].ship.cursorTy }),
    getStructureKindAt: (tx, ty) => structureAt(w, tx, ty)?.kind ?? null,
    hasBase: (p) => w.players[p].baseBuilt,
  };
}

/** Pause-overlay text for local players whose controller is unplugged, else null. */
export function missingNotice(gone: readonly PlayerId[], humans: readonly PlayerId[]): string | null {
  if (gone.length === 0) return null;
  const names = gone.map((p) => `P${humans.indexOf(p) + 1}`).join(', ');
  return `${names} controller disconnected — reconnect it or press A / ✕ on a free controller`;
}

export function createSession(spec: RunSpec, io: SessionIo = {}): Session {
  const sim = createSim(spec.options);
  const w = sim.world;
  const humans = spec.humans.length > 0 ? spec.humans : ([0] as PlayerId[]);
  const bindings = spec.bindings.length > 0 ? new Map(spec.bindings.map((b) => [b.player, b.device])) : undefined;
  const input = createInput(sessionInputOptions(w, humans, bindings, io));
  const loop = new FixedStepLoop();
  const carried: Intent[] = [];
  let wasMissing = new Set<PlayerId>();

  return {
    spec, sim, input,
    frame(dt) {
      const polled = input.poll(dt);
      // Auto-pause only when a controller newly drops, so the others can still resume without it.
      const missing = new Set(input.missing());
      if ([...missing].some((p) => !wasMissing.has(p)) && !w.over) polled.push(...input.setPaused(true));
      wasMissing = missing;
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
    submit(intents) {
      sim.step(intents);
    },
    banner: () => null,
    pauseNotice: () => missingNotice(input.missing(), humans),
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
