import { describe, expect, it } from 'vitest';
import { registerAllSystems } from '@/app/registerSystems';
import { buildRun } from '@/app/runSpec';
import { createSession } from '@/app/session';
import { battleOutcome, finishRun } from '@/app/runEnd';
import { newSave } from '@/meta';
import type { PlayerId } from '@/types';

registerAllSystems();

describe('app glue', () => {
  it('builds a campaign run with the right humans', () => {
    const spec = buildRun({ t: 'startCampaign', cometId: 'kreios', index: 0, resurgence: false, difficulty: 'normal', coop: 2 });
    if (typeof spec === 'string') throw new Error(spec);
    expect(spec.humans).toEqual([0, 2]);
    expect(spec.mission?.id).toBeTruthy();
  });

  it('reports an invalid battle setup as a message instead of throwing', () => {
    const res = buildRun({
      t: 'startBattle',
      setup: { mapId: 'battle-kreios-crater', slots: [{ human: true, team: 0, strength: 1 }], maxHits: 10, thoriumRate: 1, timeLimitSec: 0, profile: 'base' },
    });
    expect(typeof res).toBe('string');
  });

  it('runs a campaign session for a few seconds and finishes a lost run cleanly', () => {
    const spec = buildRun({ t: 'startCampaign', cometId: 'kreios', index: 0, resurgence: false, difficulty: 'normal', coop: 1 });
    if (typeof spec === 'string') throw new Error(spec);
    const session = createSession(spec);
    for (let i = 0; i < 300; i++) session.sim.step([]);
    expect(session.sim.world.tick).toBe(300);
    expect(session.sim.drainEvents().some((e) => e.t === 'missionError')).toBe(false);
    session.sim.world.over = true;
    session.sim.world.winnerTeam = 1;
    const done = finishRun(session, newSave());
    expect(done.props.won).toBe(false);
    session.dispose();
  });

  it('names the winner of a two-human battle instead of showing Defeat to player 1', () => {
    const spec = buildRun({
      t: 'startBattle',
      setup: {
        mapId: 'battle-kreios-crater', maxHits: 5, thoriumRate: 1, timeLimitSec: 0, profile: 'base',
        slots: [{ human: true, team: 0, strength: 1 }, { human: true, team: 1, strength: 1 }],
      },
    });
    if (typeof spec === 'string') throw new Error(spec);
    const session = createSession(spec);
    session.sim.world.over = true;
    session.sim.world.winnerTeam = 1;
    const done = finishRun(session, newSave());
    expect(done.props.title).toBe('Player 2 Wins');
    expect(done.props.neutral).toBe(true);
    expect(done.save.trophies.flags).toContain('battleWon');
    session.dispose();
  });

  it('keeps Victory/Defeat for one human side and names teams or a draw otherwise', () => {
    const p = (id: PlayerId, team: number, controller = 'human') => ({ id, team, controller });
    const vsCpu = [p(0, 0), p(1, 1, 'adaptive')];
    expect(battleOutcome(vsCpu, [0], 0)).toEqual({ won: true, title: 'Victory', neutral: false });
    expect(battleOutcome(vsCpu, [0], 1)).toEqual({ won: false, title: 'Defeat', neutral: false });
    expect(battleOutcome(vsCpu, [0], -1)).toMatchObject({ title: 'Draw', neutral: true });
    const teams = [p(0, 0), p(1, 1), p(2, 1, 'adaptive'), p(3, 0, 'adaptive')];
    expect(battleOutcome(teams, [0, 1], 1)).toEqual({ won: true, title: 'Team B Wins', neutral: true });
  });

  it('plays an AI-only battle to a result', () => {
    const spec = buildRun({
      t: 'startBattle',
      setup: {
        mapId: 'battle-kreios-crater', maxHits: 5, thoriumRate: 2, timeLimitSec: 0, profile: 'base',
        slots: [{ human: false, team: 0, strength: 1 }, { human: false, team: 1, strength: 1 }],
      },
    });
    if (typeof spec === 'string') throw new Error(spec);
    const session = createSession(spec);
    for (let i = 0; i < 60 * 120 && !session.sim.world.over; i++) session.sim.step([]);
    expect(session.sim.world.over).toBe(true);
    session.dispose();
  });
});
