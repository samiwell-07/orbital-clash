import { describe, expect, it } from 'vitest';
import { ALL_TECH_KEYS, BIONIC_TECH_KEYS } from '@/data';
import { ALL_MISSIONS, EXPANSION_MISSIONS, getMission, missionSummaries } from '@/data/areas';
import { ROCK_GRIDS } from '@/data/areas/rockGrids';
import { createGrid, createWorld } from '@/sim/core';
import { reachableFrom } from '@/sim/core/reach';
import { applyMissionSetup, compile, startCampaign } from '@/sim/modes/campaign';
import { purchasableResearch } from '@/sim/economy/research';
import { fireMissiles } from '@/sim/combat/missiles';
import { buildSystem } from '@/sim/build/buildSystem';
import { BUILD_SECONDS } from '@/sim/build/info';

describe('Gaia and Kronos', () => {
  it('exposes 14 numbered missions and two Resurgences without changing the original list', () => {
    const summaries = missionSummaries();
    expect(summaries).toHaveLength(48);
    expect(EXPANSION_MISSIONS).toHaveLength(16);
    expect(new Set([...ALL_MISSIONS, ...EXPANSION_MISSIONS].map(m => m.map.rows.join('|'))).size).toBe(48);
    for (const [ci, comet] of (['gaia', 'kronos'] as const).entries()) {
      for (let i = 0; i < 7; i++) {
        const m = getMission(comet, i)!;
        const n = 29 + ci * 7 + i;
        expect(EXPANSION_MISSIONS).toContain(m);
        expect(summaries.find(s => s.id === m.id)).toMatchObject({ number: n, label: `Area ${n}`, resurgence: false });
      }
      expect(getMission(comet, 7)).toBeNull();
      const r = getMission(comet, 0, true)!;
      expect(summaries.find(s => s.id === r.id)).toMatchObject({ number: 0, resurgence: true });
    }
  });

  it.each(EXPANSION_MISSIONS)('$id has clear pads, connected floor and a funded swarm script', m => {
    expect(m.profile).toBe('bionic');
    expect(m.map.w).toBe(m.map.h);
    const grid = createGrid(m.map);
    const start = m.map.baseTiles[0]!;
    const seen = reachableFrom(grid, start.tx, start.ty);
    expect(grid.terrain.every((t, i) => t !== 0 || seen[i] === 1)).toBe(true);
    m.map.baseTiles.forEach((pad, i) => {
      // Areas 29-40 play on original rock grids, which only guarantee a 3x3 pad.
      const original = !m.resurgence && ROCK_GRIDS.has(29 + (m.comet === 'kronos' ? 7 : 0) + m.index);
      const r = i < 2 && !original ? 3 : 1;
      for (let y = pad!.ty - r; y <= pad!.ty + r; y++) {
        expect(m.map.rows[y].slice(pad!.tx - r, pad!.tx + r + 1)).toBe('.'.repeat(2 * r + 1));
      }
    });
    expect(m.timeline.some(({ action: a }) => a.a === 'release' && (a.kind === 'snake' || a.kind === 'dragon'))).toBe(true);
    for (const d of ['beginner', 'casual', 'normal', 'expert'] as const) {
      expect(compile(m, d).errors).toEqual([]);
    }
  });

  it('makes the nursery lab and relay silo usable in real co-op setups', () => {
    const setup = (comet: 'gaia' | 'kronos', index: number) => {
      const mission = getMission(comet, index)!;
      const w = createWorld(startCampaign({ mission, difficulty: 'expert', humanPlayers: 3 }));
      expect(applyMissionSetup(w)).toEqual([]);
      buildSystem(w, BUILD_SECONDS, () => undefined);
      for (const id of [0, 2, 3]) expect(ALL_TECH_KEYS.every(key => w.players[id].tech[key])).toBe(true);
      return w;
    };
    const nursery = setup('gaia', 0);
    expect(new Set(purchasableResearch(nursery, 0).map(r => r.key))).toEqual(new Set(BIONIC_TECH_KEYS));
    expect(nursery.players[1].stored.snake).toBeGreaterThan(0);
    const relay = setup('kronos', 3);
    expect(fireMissiles(relay, 0, () => undefined)).toBe(1);
  });
});
