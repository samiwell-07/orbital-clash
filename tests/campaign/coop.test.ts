import { beforeAll, describe, expect, it } from 'vitest';
import type { Intent, Mission, PlayerId, SimEvent } from '@/types';
import { TICK_HZ } from '@/config/constants';
import { createSim, createWorld, hitBase, pathExists } from '@/sim/core';
import { canBuild } from '@/sim/build/rules';
import {
  applyMissionSetup, campaignResult, HUMAN_SLOT_IDS, setReleaseHandler, startCampaign,
} from '@/sim/modes/campaign';
import { executeAction } from '@/sim/modes/campaign/actions';
import { addStored, launchBatch } from '@/sim/army';
import { ALL_MISSIONS, EXPANSION_MISSIONS } from '@/data/areas';
import { PlayerController } from '@/input/playerIntents';
import { PAD } from '@/input/bindings';
import { emptySnapshot } from '@/input/gamepad';
import { registerAllSystems } from '@/app/registerSystems';

beforeAll(() => registerAllSystems());

const kreios2 = ALL_MISSIONS.find((m) => m.id === 'kreios-2') as Mission;

function coop(humans: number, mission = kreios2) {
  const sim = createSim(startCampaign({ mission, difficulty: 'normal', humanPlayers: humans, seed: 7 }));
  sim.step([]);
  return { sim, w: sim.world };
}

/** A free floor tile near `p`'s base that the player may build on. */
function freeTileNear(w: ReturnType<typeof coop>['w'], id: PlayerId) {
  const p = w.players[id];
  for (let r = 2; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const t = { tx: p.baseTx + dx, ty: p.baseTy + dy };
        if (canBuild(w, id, 'turret', t.tx, t.ty).ok) return t;
      }
    }
  }
  throw new Error('no free tile');
}

describe('campaign co-op bases', () => {
  it('gives each joined human their own base on a distinct floor tile', () => {
    const { w } = coop(2);
    const [p0, p2] = [w.players[0], w.players[2]];
    expect(p2.baseBuilt).toBe(true);
    expect([p2.baseTx, p2.baseTy]).not.toEqual([p0.baseTx, p0.baseTy]);
    expect(w.grid.terrain[p2.baseTy * w.grid.w + p2.baseTx]).toBe(0);
    expect(w.players[3].controller).toBe('none');
    expect(w.players[3].baseBuilt).toBe(false);
  });

  it.each([2, 4] as const)('lets slot %s build a Turret, produce Scouts at its own base and launch them', (id) => {
    const { sim, w } = coop(4);
    const t = freeTileNear(w, id);
    expect(canBuild(w, id, 'turret', t.tx, t.ty)).toEqual({ ok: true, reason: '' });
    sim.step([{ t: 'build', player: id, kind: 'turret', tx: t.tx, ty: t.ty }]);
    expect([...w.structures.values()].some((s) => s.owner === id && s.kind === 'turret')).toBe(true);

    const o = freeTileNear(w, id);
    sim.step([{ t: 'build', player: id, kind: 'basicOps', tx: o.tx, ty: o.ty }]);
    expect([...w.structures.values()].some((s) => s.owner === id && s.kind === 'basicOps')).toBe(true);
    for (let i = 0; i < 30 * TICK_HZ && (w.players[id].stored.scout ?? 0) < 2; i++) sim.step([]);
    expect(w.players[id].stored.scout ?? 0).toBeGreaterThan(0);

    const before = w.units.length;
    sim.step([{ t: 'attackSelect', player: id, kind: 'scout' }]);
    for (let i = 0; i < TICK_HZ; i++) sim.step([]);
    const mine = w.units.slice(before).filter((u) => u.owner === id);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((u) => u.targetPlayer === 1)).toBe(true);
  });

  it('never founds an extra base for a co-op partner', () => {
    const { sim, w } = coop(2);
    const p2 = w.players[2];
    const at = { tx: p2.baseTx, ty: p2.baseTy };
    const out: Intent[] = [];
    const pc = new PlayerController(2, {
      getBuildItems: () => ['turret'], getAttackUnits: () => ['scout'],
      getCursor: () => ({ tx: at.tx + 3, ty: at.ty }), hasBase: (p) => w.players[p].baseBuilt,
    });
    const snap = emptySnapshot();
    snap.buttons[PAD.X] = true;
    pc.update(snap, 1 / 60, false, out);
    expect(out.some((i) => i.t === 'buildBase')).toBe(false);

    sim.step([{ t: 'buildBase', player: 2, tx: at.tx + 3, ty: at.ty }]);
    expect({ tx: p2.baseTx, ty: p2.baseTy }).toEqual(at);
    expect(sim.drainEvents().some((e) => e.t === 'baseBuilt')).toBe(false);
  });

  it('loses the mission when a partner base is destroyed', () => {
    const { sim, w } = coop(4);
    const emit = (e: SimEvent) => w.events.push(e);
    hitBase(w, 4, 1, emit, w.players[4].maxHits);
    sim.step([]);
    sim.step([]);
    expect(w.over).toBe(true);
    expect(w.players[0].alive).toBe(true);
    expect(w.winnerTeam).toBe(w.players[1].team);
    expect(campaignResult(w)).toMatchObject({ finished: true, won: false });
  });

  it('spreads scripted releases across the living human bases', () => {
    const w = createWorld(startCampaign({ mission: kreios2, difficulty: 'normal', humanPlayers: 4 }));
    applyMissionSetup(w, () => undefined);
    // Without its garrison every release comes out of the base, through the handler.
    w.units.length = 0;
    const aimed: PlayerId[] = [];
    setReleaseHandler((world, owner) => { aimed.push(world.players[owner].attack.targetPlayer); });
    try {
      for (let i = 0; i < 4; i++) {
        w.players[1].stored.scout = 5;
        expect(executeAction(w, 1, { a: 'release', kind: 'scout', count: 1 }, { dry: false }, () => undefined)).toBeNull();
      }
      w.players[2].alive = false;
      w.players[1].stored.scout = 5;
      executeAction(w, 1, { a: 'release', kind: 'scout', count: 1 }, { dry: false }, () => undefined);
    } finally {
      setReleaseHandler((world, owner, kind, count, emit) => {
        addStored(world, owner, kind, count);
        launchBatch(world, owner, kind, count, emit);
      });
    }
    expect(aimed.slice(0, 4)).toEqual([0, 2, 3, 4]);
    expect(aimed[4]).not.toBe(2);
  });

  it('1-player campaigns have only one human base', () => {
    const { w } = coop(1);
    expect(w.players.filter((p) => p.controller === 'human' && p.baseBuilt).map((p) => p.id)).toEqual([0]);
    expect(w.players[2].baseBuilt || w.players[3].baseBuilt).toBe(false);
  });

  it.each([...ALL_MISSIONS, ...EXPANSION_MISSIONS].map((m) => [m.id, m] as const))('%s sets up for 4 humans with every base reachable', (_id, m) => {
    const w = createWorld(startCampaign({ mission: m, difficulty: 'normal', humanPlayers: 4 }));
    expect(applyMissionSetup(w, () => undefined)).toEqual([]);
    const enemy = { tx: w.players[1].baseTx, ty: w.players[1].baseTy };
    const tiles = new Set<string>();
    for (const id of HUMAN_SLOT_IDS) {
      const p = w.players[id];
      expect(p.baseBuilt).toBe(true);
      expect(w.grid.terrain[p.baseTy * w.grid.w + p.baseTx]).toBe(0);
      expect(pathExists(w, { tx: p.baseTx, ty: p.baseTy }, enemy)).toBe(true);
      tiles.add(`${p.baseTx},${p.baseTy}`);
    }
    expect(tiles.size).toBe(4);
  });
});
