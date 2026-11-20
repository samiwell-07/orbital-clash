import type { GameMsg } from './protocol';
import type { NetEvent, NetRoom, NetStatus } from './types';

export interface LoopbackHub {
  /** Opens the room (code '1000') as host = peer 0. */
  host(): NetRoom;
  /** Joins the room; a wrong code (or no host) gives a closed room with an error. */
  join(code: string): NetRoom;
  /** Delivers every queued message / peer event in send order (including ones queued while flushing). */
  flush(): void;
  /** Queued deliveries not yet flushed. */
  pending(): number;
}

const CODE = '1000';

interface Member {
  peer: number;
  status: NetStatus;
  error: string | null;
  peers: number[];
  listeners: Set<(e: NetEvent) => void>;
}

/** In-memory relay test double with the real relay's semantics; nothing is delivered until flush(). */
export function createLoopbackHub(): LoopbackHub {
  const members = new Map<number, Member>();
  const queue: { to: number; e: NetEvent }[] = [];
  let nextPeer = 0;
  let open = false;

  const deliver = (m: Member, e: NetEvent): void => {
    if (e.t === 'peerJoined' && !m.peers.includes(e.peer)) m.peers = [...m.peers, e.peer].sort((a, b) => a - b);
    if (e.t === 'peerLeft') m.peers = m.peers.filter((p) => p !== e.peer);
    for (const fn of [...m.listeners]) fn(e);
  };

  const makeRoom = (m: Member, role: 'host' | 'client'): NetRoom => ({
    role,
    get status() {
      return m.status;
    },
    get code() {
      return m.peer >= 0 ? CODE : null;
    },
    get me() {
      return m.peer;
    },
    get peers() {
      return m.peers;
    },
    urls: [],
    get error() {
      return m.error;
    },
    send(data: GameMsg, to?: number) {
      if (m.status !== 'open') return;
      // Serialise like the wire does so tests catch shared references / non-JSON data.
      const copy = JSON.parse(JSON.stringify(data)) as GameMsg;
      for (const p of members.keys()) {
        if (p === m.peer || (to !== undefined && p !== to)) continue;
        queue.push({ to: p, e: { t: 'msg', from: m.peer, data: copy } });
      }
    },
    listen(fn) {
      m.listeners.add(fn);
      return () => {
        m.listeners.delete(fn);
      };
    },
    close() {
      if (m.status === 'closed') return;
      m.status = 'closed';
      if (!members.delete(m.peer)) return;
      for (const p of members.keys()) queue.push({ to: p, e: { t: 'peerLeft', peer: m.peer } });
      if (m.peer === 0) open = false;
    },
  });

  const enter = (role: 'host' | 'client'): NetRoom => {
    const peer = nextPeer++;
    const m: Member = { peer, status: 'open', error: null, peers: [...members.keys(), peer].sort((a, b) => a - b), listeners: new Set() };
    for (const p of members.keys()) queue.push({ to: p, e: { t: 'peerJoined', peer } });
    members.set(peer, m);
    return makeRoom(m, role);
  };

  return {
    host() {
      if (open) throw new Error('loopback room already hosted');
      open = true;
      return enter('host');
    },
    join(code) {
      if (!open || code !== CODE) {
        const m: Member = { peer: -1, status: 'closed', error: 'No room with that code', peers: [], listeners: new Set() };
        return makeRoom(m, 'client');
      }
      return enter('client');
    },
    flush() {
      while (queue.length > 0) {
        const { to, e } = queue.shift()!;
        const m = members.get(to);
        if (m) deliver(m, e);
      }
    },
    pending: () => queue.length,
  };
}
