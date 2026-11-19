import type { Intent, PlayerId } from '@/types';
import { createSim } from '@/sim/core';
import { createInput } from '@/input';
import { MAX_STEPS_PER_FRAME, TICK_DT } from '@/config/constants';
import { Lockstep, DEFAULT_INPUT_DELAY } from '@/net/lockstep';
import { worldHash } from '@/net/worldHash';
import type { NetRoom } from '@/net/types';
import type { RunSpec } from './runSpec';
import { CONTINUOUS, missingNotice, sessionInputOptions, type Session, type SessionIo } from './session';

/** Steps between world-hash exchanges. */
export const HASH_EVERY = 60;
/** Extra steps per frame a machine that fell behind the others may run to catch up. */
const CATCH_UP_STEPS = 2;
/** Max owed time kept while stalled, so a resumed peer does not burst forever. */
const MAX_BACKLOG = MAX_STEPS_PER_FRAME * TICK_DT;
const WAIT_BANNER_SEC = 0.5;
const LEFT_BANNER_SEC = 5;

export interface NetSessionOptions {
  /** Input delay in lockstep steps (default 4 = 67 ms). */
  delay?: number;
  /** Match id shared by all peers (the start seed); input/hash packets from other matches are ignored. */
  match?: number;
}

/**
 * Online session: every machine runs the full simulation in deterministic lockstep. Local input is sent as
 * one packet per step for `step + delay`; a step runs only when every live participant's packet is here.
 */
export function createNetSession(spec: RunSpec, room: NetRoom, io: SessionIo = {}, opts: NetSessionOptions = {}): Session {
  const sim = createSim(spec.options);
  const w = sim.world;
  const me = room.me;
  const humans = spec.humans;
  const bindings = spec.bindings.length > 0 ? spec.bindings : humans.map((player) => ({ player, device: 'kb1' as const, peer: 0 }));
  const owners = new Map<PlayerId, number>(bindings.map((b) => [b.player, b.peer]));
  const participants = [...new Set(bindings.map((b) => b.peer))].sort((a, b) => a - b);
  const local = bindings.filter((b) => b.peer === me);
  const localPlayers = local.map((b) => b.player);
  const input = createInput(
    sessionInputOptions(w, localPlayers, spec.bindings.length > 0 ? new Map(local.map((b) => [b.player, b.device])) : undefined, io),
  );
  const match = opts.match ?? 0;
  const ls = new Lockstep({ me, participants, owners, delay: opts.delay ?? DEFAULT_INPUT_DELAY });
  for (const p of participants) if (!room.peers.includes(p)) ls.peerLeft(p);

  /** Edge intents not yet sent (submitted, or polled in frames that sent no packet). */
  const pending: Intent[] = [];
  let fresh: Intent[] = [];
  let freshSent = true;
  let acc = 0;
  let clock = 0;
  let waiting = false;
  let stalledSec = 0;
  let lastPaused = w.paused;
  let wasMissing = new Set<PlayerId>();
  const departures: { peer: number; at: number }[] = [];
  const myHashes = new Map<number, number>();
  const theirHashes = new Map<number, Map<number, number>>();
  let desyncPeer: number | null = null;

  const names = (peers: readonly number[]): string => {
    const out: string[] = [];
    for (const p of peers) {
      const own = bindings.filter((b) => b.peer === p).map((b) => `P${humans.indexOf(b.player) + 1}`);
      out.push(...(own.length > 0 ? own : [`peer ${p}`]));
    }
    return out.join(', ');
  };

  const checkHash = (peer: number, step: number, hash: number): void => {
    const mine = myHashes.get(step);
    if (mine === undefined) {
      if (!theirHashes.has(step)) theirHashes.set(step, new Map());
      theirHashes.get(step)!.set(peer, hash);
      return;
    }
    if (mine !== hash && desyncPeer === null) desyncPeer = peer;
  };

  const unsubscribe = room.listen((e) => {
    if (e.t === 'msg') {
      const d = e.data;
      if ((d.t === 'input' || d.t === 'hash') && d.match !== match) return;
      if (d.t === 'input') ls.receive(e.from, d.step, d.intents);
      else if (d.t === 'hash' && typeof d.hash === 'number') checkHash(e.from, d.step, d.hash);
    } else if (e.t === 'peerLeft') {
      if (participants.includes(e.peer) && !ls.hasLeft(e.peer)) departures.push({ peer: e.peer, at: clock });
      ls.peerLeft(e.peer);
    }
  });

  const sendLocal = (): void => {
    while (ls.needsLocal()) {
      const intents = [...pending, ...(freshSent ? fresh.filter((i) => CONTINUOUS.has(i.t)) : fresh)];
      pending.length = 0;
      freshSent = true;
      const step = ls.pushLocal(intents);
      room.send({ t: 'input', match, step, intents });
    }
  };

  const runStep = (): void => {
    const step = ls.step;
    sim.step(ls.take());
    // Mirror pause changes from any peer into the local pause menu (its intents are moot: the sim is paused).
    if (w.paused !== lastPaused) {
      lastPaused = w.paused;
      input.setPaused(w.paused);
    }
    if ((step + 1) % HASH_EVERY === 0) {
      const hash = worldHash(w);
      myHashes.set(step, hash);
      myHashes.delete(step - HASH_EVERY * 10);
      room.send({ t: 'hash', match, step, hash });
      const theirs = theirHashes.get(step);
      theirHashes.delete(step);
      if (theirs) for (const [peer, h] of theirs) checkHash(peer, step, h);
    }
  };

  /** Pause intents carry the state this machine wants (set, not toggle), so near-simultaneous presses don't cancel. */
  const stampPause = (list: Intent[]): void => {
    for (let i = 0; i < list.length; i++) if (list[i].t === 'pause') list[i] = { t: 'pause', on: input.isPaused() };
  };

  return {
    spec, sim, input,
    frame(dt) {
      if (!(dt > 0)) dt = 0;
      clock += dt;
      const polled = input.poll(dt);
      const missing = new Set(input.missing());
      if ([...missing].some((p) => !wasMissing.has(p)) && !w.over) polled.push(...input.setPaused(true));
      wasMissing = missing;
      stampPause(polled);
      // Edge intents of a frame that never got to send a packet (stalled / no step owed) must not be lost.
      if (!freshSent) for (const it of fresh) if (!CONTINUOUS.has(it.t)) pending.push(it);
      fresh = polled;
      freshSent = false;

      acc += dt;
      let steps = 0;
      let extra = 0;
      for (;;) {
        const owed = acc >= TICK_DT - 1e-9 && steps < MAX_STEPS_PER_FRAME;
        if (!owed && (extra >= CATCH_UP_STEPS || ls.readyDepth(ls.delay + 3) <= ls.delay + 1)) break;
        sendLocal();
        if (!ls.canStep()) {
          waiting = true;
          break;
        }
        waiting = false;
        runStep();
        steps++;
        if (owed) acc = Math.max(0, acc - TICK_DT);
        else extra++;
      }
      acc = Math.min(acc, MAX_BACKLOG);
      stalledSec = waiting ? stalledSec + dt : 0;
      return Math.min(acc / TICK_DT, 1);
    },
    submit(intents) {
      const list = [...intents];
      stampPause(list);
      pending.push(...list);
    },
    pauseNotice: () => missingNotice(input.missing(), humans),
    banner() {
      if (waiting && stalledSec > WAIT_BANNER_SEC) {
        const who = ls.waitingOn();
        if (who.length > 0) return `Waiting for ${names(who)}…`;
      }
      const recent = departures.filter((d) => clock - d.at < LEFT_BANNER_SEC);
      if (recent.length > 0) return `${names(recent.map((d) => d.peer))} left the game`;
      if (desyncPeer !== null) return `Out of sync with ${names([desyncPeer])}`;
      return null;
    },
    dispose() {
      unsubscribe();
      input.dispose();
    },
  };
}
