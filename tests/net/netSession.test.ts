import { describe, expect, it } from 'vitest';
import { registerAllSystems } from '@/app/registerSystems';
import { buildRun, type RunSpec, type StartCommand } from '@/app/runSpec';
import { createNetSession } from '@/app/netSession';
import { createLoopbackHub } from '@/net/loopback';
import { worldHash } from '@/net/worldHash';
import { createKeyboard } from '@/input/keyboard';
import { PAD } from '@/input/bindings';
import type { GamepadLike } from '@/input/gamepad';

registerAllSystems();

const CMD: StartCommand = {
  t: 'startBattle',
  seats: [{ device: 'pad0', colorIndex: 0, peer: 0 }, { device: 'pad0', colorIndex: 1, peer: 1 }],
  setup: {
    mapId: 'battle-kreios-crater', maxHits: 5, thoriumRate: 1, timeLimitSec: 0, profile: 'base',
    slots: [{ human: true, team: 0, strength: 1 }, { human: true, team: 1, strength: 1 }],
  },
};

function spec(): RunSpec {
  const s = buildRun(CMD, 'normal', 1234);
  if (typeof s === 'string') throw new Error(s);
  return s;
}

function fakePad() {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  const axes = [0, 0, 0, 0];
  const pad: GamepadLike = { connected: true, axes, buttons };
  const set = (i: number, v: boolean): void => {
    buttons[i] = { pressed: v, value: v ? 1 : 0 };
  };
  return { pad, set, axes };
}

/** Host (peer 0, P1) and client (peer 1, P2) on the loopback relay, each with its own pad0. */
function pair() {
  const hub = createLoopbackHub();
  const hostRoom = hub.host();
  const clientRoom = hub.join('1000');
  hub.flush();
  const pads = [fakePad(), fakePad()];
  const a = createNetSession(spec(), hostRoom, { getGamepads: () => [pads[0].pad], keyboard: createKeyboard(null) });
  const b = createNetSession(spec(), clientRoom, { getGamepads: () => [pads[1].pad], keyboard: createKeyboard(null) });
  const run = (frames: number, flush = true): void => {
    for (let i = 0; i < frames; i++) {
      a.frame(1 / 60);
      b.frame(1 / 60);
      if (flush) hub.flush();
    }
  };
  return { hub, hostRoom, clientRoom, pads, a, b, run };
}

describe('online lockstep session', () => {
  it('keeps both worlds identical while one player moves', () => {
    const { pads, a, b, run } = pair();
    const x0 = a.sim.world.players[0].ship.x;
    pads[0].axes[0] = 1;
    run(240);
    expect(a.sim.world.tick).toBeGreaterThan(200);
    expect(b.sim.world.tick).toBe(a.sim.world.tick);
    expect(a.sim.world.players[0].ship.x).toBeGreaterThan(x0 + 1);
    expect(worldHash(b.sim.world)).toBe(worldHash(a.sim.world));
    expect(a.banner()).toBeNull();
    expect(b.banner()).toBeNull();
  });

  it('stalls while the other side is silent, says who it waits for, then catches up', () => {
    const { pads, a, b, run } = pair();
    pads[1].axes[1] = 1;
    run(60, false);
    expect(a.sim.world.tick).toBeLessThanOrEqual(4);
    expect(a.banner()).toBe('Waiting for P2…');
    run(120);
    expect(a.banner()).toBeNull();
    expect(a.sim.world.tick).toBe(b.sim.world.tick);
    expect(a.sim.world.tick).toBeGreaterThan(100);
    expect(worldHash(a.sim.world)).toBe(worldHash(b.sim.world));
  });

  it('a pause from one peer pauses both machines and their pause menus', () => {
    const { pads, a, b, run } = pair();
    run(30);
    pads[1].set(PAD.START, true);
    run(1);
    pads[1].set(PAD.START, false);
    run(10);
    expect(a.sim.world.paused).toBe(true);
    expect(b.sim.world.paused).toBe(true);
    expect(a.input.isPaused()).toBe(true);
    const tick = a.sim.world.tick;
    a.submit(a.input.setPaused(false));
    run(10);
    expect(b.sim.world.paused).toBe(false);
    expect(b.input.isPaused()).toBe(false);
    expect(a.sim.world.tick).toBeGreaterThan(tick);
    expect(worldHash(a.sim.world)).toBe(worldHash(b.sim.world));
  });

  it('two players pausing at almost the same time stays paused', () => {
    const { pads, a, b, run } = pair();
    run(30);
    pads[0].set(PAD.START, true);
    a.frame(1 / 60);
    pads[1].set(PAD.START, true);
    run(1);
    pads[0].set(PAD.START, false);
    pads[1].set(PAD.START, false);
    run(10);
    expect(a.sim.world.paused).toBe(true);
    expect(b.sim.world.paused).toBe(true);
    expect(a.input.isPaused()).toBe(true);
    expect(b.input.isPaused()).toBe(true);
  });

  it('lets the remaining player continue after a peer leaves', () => {
    const { hub, clientRoom, a, b, run } = pair();
    run(30);
    b.dispose();
    clientRoom.close();
    hub.flush();
    const tick = a.sim.world.tick;
    for (let i = 0; i < 60; i++) a.frame(1 / 60);
    expect(a.sim.world.tick).toBeGreaterThan(tick + 50);
    expect(a.banner()).toBe('P2 left the game');
  });

  it('ignores input still in flight from a previous match', () => {
    const hub = createLoopbackHub();
    const hostRoom = hub.host();
    const clientRoom = hub.join('1000');
    hub.flush();
    const pads = [fakePad(), fakePad()];
    const io = (i: number) => ({ getGamepads: () => [pads[i].pad], keyboard: createKeyboard(null) });
    const a = createNetSession(spec(), hostRoom, io(0), { match: 2 });
    clientRoom.send({ t: 'input', match: 1, step: 4, intents: [{ t: 'move', player: 1, ax: 1, ay: 0 }] }, 0);
    hub.flush();
    const b = createNetSession(spec(), clientRoom, io(1), { match: 2 });
    for (let i = 0; i < 30; i++) {
      a.frame(1 / 60);
      b.frame(1 / 60);
      hub.flush();
    }
    expect(a.sim.world.tick).toBeGreaterThan(20);
    expect(worldHash(a.sim.world)).toBe(worldHash(b.sim.world));
  });
});
