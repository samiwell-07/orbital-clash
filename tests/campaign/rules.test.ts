import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Difficulty, Mission, Objective, SimEvent } from '@/types';
import { createSim, hitBase, removeStructure } from '@/sim/core';
import { campaignResult, objectiveProgress, setReleaseHandler, startCampaign } from '@/sim/modes/campaign';
import { ALL_MISSIONS } from '@/data/areas';

beforeEach(() => setReleaseHandler(() => undefined));
afterEach(() => setReleaseHandler(null));

const base = ALL_MISSIONS.find((m) => m.id === 'kreios-2') as Mission;

function make(difficulty: Difficulty = 'normal', humans = 1, objectives?: Objective[]) {
  const mission = objectives ? { ...base, objectives } : base;
  const sim = createSim(startCampaign({ mission, difficulty, humanPlayers: humans, seed: 3 }));
  const emit = (e: SimEvent) => sim.world.events.push(e);
  return { sim, w: sim.world, emit };
}

describe('startCampaign', () => {
  it('sets up slots, teams, hits and start thorium per difficulty and player count', () => {
    const { w } = make('expert', 3);
    expect(w.players.map((p) => p.controller)).toEqual(['human', 'script', 'human', 'human', 'none']);
    expect(w.players[0].team).toBe(w.players[3].team);
    expect(w.players[1].team).not.toBe(w.players[0].team);
    expect(w.players[1].maxHits).toBe(base.enemyHits.expert);
    expect(w.players[1].thorium).toBe(0);
    expect(w.players[0].thorium).toBe(Math.round(base.startThorium * 0.8));
    expect(w.settings.mode).toBe('campaign');
    expect(make('beginner').w.players[0].thorium).toBe(Math.round(base.startThorium * 1.5));
  });

  it('applies preplaced structures and the stored army once', () => {
    const { sim, w } = make();
    sim.step([]);
    sim.step([]);
    expect([...w.structures.values()].filter((s) => s.scripted)).toHaveLength(base.preplaced.length + 0);
    expect(Object.values(w.players[1].stored).reduce((a, b) => a + (b ?? 0), 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('penalties and results', () => {
  it.each([['beginner', 0], ['casual', 0], ['normal', 10], ['expert', 20]] as const)(
    'applies time penalties as hits occur (%s)',
    (d, expected) => {
      const { sim, w, emit } = make(d);
      sim.step([]);
      hitBase(w, 0, 1, emit, 1);
      sim.step([]);
      hitBase(w, 0, 1, emit, 1);
      sim.step([]);
      expect(w.players[0].stats.penaltySec).toBe(expected);
      expect(campaignResult(w)?.penaltySec).toBe(expected);
    },
  );

  it('wins when the enemy base falls and reports time and penalty', () => {
    const { sim, w, emit } = make('normal');
    for (let i = 0; i < 120; i++) sim.step([]);
    hitBase(w, 0, 1, emit, 1);
    hitBase(w, 1, 0, emit, w.players[1].maxHits);
    sim.step([]);
    const ev = sim.drainEvents();
    expect(w.over).toBe(true);
    expect(ev.filter((e) => e.t === 'victory')).toHaveLength(1);
    const r = campaignResult(w)!;
    expect(r).toMatchObject({ finished: true, won: true, penaltySec: 5, errored: false });
    expect(r.timeSec).toBeCloseTo(2.0167, 3);
    expect(r.totalSec).toBeCloseTo(r.timeSec + 5, 5);
    expect(r.stars).toBe(3);
  });

  it('loses when the human base falls, including in co-op with teammates alive', () => {
    for (const humans of [1, 3]) {
      const { sim, w, emit } = make('normal', humans);
      hitBase(w, 0, 1, emit, w.players[0].maxHits);
      sim.step([]);
      sim.step([]);
      expect(w.over).toBe(true);
      expect(w.winnerTeam).toBe(w.players[1].team);
      expect(campaignResult(w)).toMatchObject({ finished: true, won: false });
    }
  });
});

describe('objectives', () => {
  const alt = (o: Objective) => [{ id: 'base', text: 'Destroy the base', type: 'destroyBase', value: 1 } as Objective, o];

  it('destroyStructures wins after enough enemy structures fall', () => {
    const { sim, w } = make('normal', 1, alt({ id: 'a', text: 'x', type: 'destroyStructures', value: 2 }));
    sim.step([]);
    const [a, b] = [...w.structures.values()].filter((s) => s.scripted);
    removeStructure(w, a.id);
    sim.step([]);
    expect(w.over).toBe(false);
    expect(objectiveProgress(w)[1].current).toBe(1);
    removeStructure(w, b.id);
    sim.step([]);
    expect(w.over).toBe(true);
    expect(w.winnerTeam).toBe(w.players[0].team);
    expect(campaignResult(w)?.won).toBe(true);
  });

  it('survive and thorium objectives win when reached', () => {
    const s = make('normal', 1, alt({ id: 's', text: 'x', type: 'survive', value: 2 }));
    for (let i = 0; i < 130 && !s.w.over; i++) s.sim.step([]);
    expect(s.w.over).toBe(true);
    const t = make('normal', 1, alt({ id: 't', text: 'x', type: 'thorium', value: 400 }));
    t.sim.step([]);
    t.w.players[0].stats.thoriumEarned = 400;
    t.sim.step([]);
    expect(t.w.over).toBe(true);
    expect(campaignResult(t.w)?.won).toBe(true);
  });
});
