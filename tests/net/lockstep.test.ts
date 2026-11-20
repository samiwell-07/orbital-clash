import { describe, expect, it } from 'vitest';
import { Lockstep } from '@/net/lockstep';
import type { Intent, PlayerId } from '@/types';

const owners = new Map<PlayerId, number>([[0, 0], [1, 1]]);
const move = (player: PlayerId): Intent => ({ t: 'move', player, ax: 1, ay: 0 });

describe('Lockstep', () => {
  it('runs the first `delay` steps empty, then waits for every participant and merges in peer order', () => {
    const ls = new Lockstep({ me: 1, participants: [1, 0], owners, delay: 2 });
    expect(ls.needsLocal()).toBe(true);
    expect(ls.pushLocal([move(1)])).toBe(2);
    expect(ls.needsLocal()).toBe(false);
    expect(ls.take()).toEqual([]);
    expect(ls.pushLocal([])).toBe(3);
    expect(ls.take()).toEqual([]);
    expect(ls.canStep()).toBe(false);
    expect(ls.waitingOn()).toEqual([0]);
    ls.receive(0, 2, [move(0)]);
    expect(ls.canStep()).toBe(true);
    expect(ls.take()).toEqual([move(0), move(1)]);
    expect(ls.step).toBe(3);
  });

  it('drops intents for players the sender does not own and keeps at most one pause per step', () => {
    const ls = new Lockstep({ me: 0, participants: [0, 1], owners, delay: 0 });
    ls.pushLocal([{ t: 'pause' }, move(0)]);
    ls.receive(1, 0, [move(0), { t: 'pause' }, { t: 'drop', player: 1 }]);
    expect(ls.take()).toEqual([{ t: 'pause' }, move(0), { t: 'drop', player: 1 }]);
  });

  it('a departed peer stops blocking; spectators step without sending', () => {
    const spectator = new Lockstep({ me: 2, participants: [0, 1], owners, delay: 1 });
    expect(spectator.needsLocal()).toBe(false);
    spectator.take();
    spectator.receive(0, 1, [move(0)]);
    spectator.receive(1, 1, [move(1)]);
    spectator.receive(0, 2, [move(0)]);
    expect(spectator.take()).toEqual([move(0), move(1)]);
    expect(spectator.canStep()).toBe(false);
    spectator.peerLeft(1);
    expect(spectator.take()).toEqual([move(0)]);
    expect(spectator.waitingOn()).toEqual([0]);
  });
});
