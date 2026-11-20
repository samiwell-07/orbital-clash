import { describe, expect, it } from 'vitest';
import { registerAllSystems } from '@/app/registerSystems';
import { buildRun, nextAreaCommand, type StartCommand } from '@/app/runSpec';
import { createSession } from '@/app/session';
import { battleOutcome, finishRun } from '@/app/runEnd';
import { newSave } from '@/meta';
import { resolvePaletteId } from '@/render/terrain/palettes';
import { createKeyboard } from '@/input/keyboard';
import type { PlayerId, Seat } from '@/types';

registerAllSystems();

describe('app glue', () => {
  it('builds a campaign run from lobby seats: humans 0 and 2, their devices and colours', () => {
    const seats = [{ device: 'pad1' as const, colorIndex: 4 }, { device: 'pad0' as const, colorIndex: 0 }];
    const spec = buildRun({ t: 'startCampaign', cometId: 'kreios', index: 0, resurgence: false, difficulty: 'normal', seats });
    if (typeof spec === 'string') throw new Error(spec);
    expect(spec.humans).toEqual([0, 2]);
    expect(spec.bindings).toEqual([{ player: 0, device: 'pad1', peer: 0 }, { player: 2, device: 'pad0', peer: 0 }]);
    const colours = Object.fromEntries(spec.options.slots.map((s) => [s.id, s.colorIndex]));
    expect(colours).toEqual({ 0: 4, 1: undefined, 2: 0 });
    expect(spec.mission?.id).toBeTruthy();
  });

  it('builds a battle run: seats go to the human slots in order, CPUs keep default colours', () => {
    const spec = buildRun({
      t: 'startBattle',
      seats: [{ device: 'kb1', colorIndex: 6 }],
      setup: {
        mapId: 'battle-kreios-crater', maxHits: 5, thoriumRate: 1, timeLimitSec: 0, profile: 'base',
        slots: [{ human: true, team: 0, strength: 1 }, { human: false, team: 1, strength: 1 }],
      },
    });

    if (typeof spec === 'string') throw new Error(spec);
    expect(spec.bindings).toEqual([{ player: 0, device: 'kb1', peer: 0 }]);
    const session = createSession(spec);
    expect(session.sim.world.players.slice(0, 2).map((p) => p.colorIndex)).toEqual([6, 1]);
    session.dispose();
  });
  it('routes the fourth campaign controller independently and records a four-player victory', () => {
    const seats: Seat[] = (['pad0', 'pad1', 'pad2', 'pad3'] as const).map((device, i) => ({ device, colorIndex: i + 2 }));
    const pads = seats.map(() => ({
      connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    }));
    const spec = buildRun({ t: 'startCampaign', cometId: 'gaia', index: 0, resurgence: false, difficulty: 'expert', seats });
    if (typeof spec === 'string') throw new Error(spec);
    const session = createSession(spec, { getGamepads: () => pads, keyboard: createKeyboard(null) });
    try {
      const world = session.sim.world;
      const starts = spec.humans.map(id => world.players[id].ship.x);
      pads[3].axes[0] = 1;
      for (let i = 0; i < 10; i++) session.frame(1 / 60);
      expect(spec.humans.slice(0, 3).map(id => world.players[id].ship.x)).toEqual(starts.slice(0, 3));
      expect(world.players[4].ship.x).toBeGreaterThan(starts[3]);
      expect(world.players[4].colorIndex).toBe(seats[3].colorIndex);
      world.players[1].hits = world.players[1].maxHits;
      session.sim.step([]);
      expect(session.sim.drainEvents().filter(e => e.t === 'missionError')).toEqual([]);
      const result = finishRun(session, newSave());
      expect(result.save.lastPlayed).toMatchObject({ difficulty: 'expert', coopPlayers: 4 });
      expect(nextAreaCommand(spec.command, result.save)).toEqual({ ...spec.command, index: 1 });
    } finally {
      session.dispose();
    }
  });

  it('launches and scores the expansion with its own worlds, including both Resurgences', () => {
    const seats = [{ device: 'kb1' as const, colorIndex: 2 }];
    let save = newSave();
    for (const cometId of ['gaia', 'kronos'] as const) {
      for (let i = 0; i < 8; i++) {
        const resurgence = i === 7;
        const index = resurgence ? 0 : i;
        const cmd: StartCommand = { t: 'startCampaign', cometId, index, resurgence, difficulty: 'normal', seats };
        const spec = buildRun(cmd);
        if (typeof spec === 'string') throw new Error(spec);
        const session = createSession(spec);
        try {
          const world = session.sim.world;
          expect(world.settings).toMatchObject({ comet: cometId, profile: 'bionic', mission: { comet: cometId, index, resurgence } });
          expect(resolvePaletteId(world)).toBe(cometId);
          world.players[1].hits = world.players[1].maxHits;
          session.sim.step([]);
          expect(session.sim.drainEvents().filter((e) => e.t === 'missionError')).toEqual([]);
          const done = finishRun(session, save);
          save = done.save;
          expect(done.props).toMatchObject({ won: true, boardKey: `${cometId}:${resurgence ? 'r' : 'a'}${index}:normal` });
          expect(save.lastPlayed).toMatchObject({ cometId, index, resurgence });
          const next = nextAreaCommand(cmd, save);
          expect(done.props.hasNext).toBe(next !== null);
          if (resurgence || (cometId === 'kronos' && index === 6)) expect(next).toBeNull();
          else expect(next).toEqual({ ...cmd, cometId: index === 6 ? 'kronos' : cometId, index: (index + 1) % 7 });
        } finally {
          session.dispose();
        }
      }
    }
  });

  it('reports an invalid battle setup as a message instead of throwing', () => {
    const res = buildRun({
      t: 'startBattle',
      seats: [],
      setup: { mapId: 'battle-kreios-crater', slots: [{ human: true, team: 0, strength: 1 }], maxHits: 10, thoriumRate: 1, timeLimitSec: 0, profile: 'base' },
    });
    expect(typeof res).toBe('string');
  });

  it('runs a campaign session for a few seconds and finishes a lost run cleanly', () => {
    const spec = buildRun({ t: 'startCampaign', cometId: 'kreios', index: 0, resurgence: false, difficulty: 'normal', seats: [{ device: 'kb1', colorIndex: 0 }] });
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
      seats: [{ device: 'pad0', colorIndex: 0 }, { device: 'pad1', colorIndex: 1 }],
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

  it('auto-pauses once when a bound controller unplugs, and lets the others resume without it', () => {
    const pad = () => ({ connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
    const pads = [pad(), pad()];
    const spec = buildRun({
      t: 'startBattle',
      seats: [{ device: 'pad0', colorIndex: 0 }, { device: 'pad1', colorIndex: 1 }],
      setup: {
        mapId: 'battle-kreios-crater', maxHits: 5, thoriumRate: 1, timeLimitSec: 0, profile: 'base',
        slots: [{ human: true, team: 0, strength: 1 }, { human: true, team: 1, strength: 1 }],
      },
    });
    if (typeof spec === 'string') throw new Error(spec);
    const session = createSession(spec, { getGamepads: () => pads, keyboard: createKeyboard(null) });
    session.frame(1 / 60);
    expect(session.sim.world.paused).toBe(false);
    expect(session.pauseNotice()).toBeNull();
    pads[1].connected = false;
    session.frame(1 / 60);
    expect(session.sim.world.paused).toBe(true);
    expect(session.pauseNotice()).toContain('P2 controller disconnected');
    session.sim.step(session.input.setPaused(false));
    for (let i = 0; i < 5; i++) session.frame(1 / 60);
    expect(session.sim.world.paused).toBe(false);
    session.dispose();
  });

  it('plays an AI-only battle to a result', () => {
    const spec = buildRun({
      t: 'startBattle',
      seats: [],
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
