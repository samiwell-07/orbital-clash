import { MAX_ROOM_PEERS, ROOM_CODE_LENGTH } from '../src/net/protocol';

/** Socket-free room bookkeeping for the LAN relay. Clients are identified by an opaque id. */
export const MAX_ROOMS = 200;

export interface Member<C> {
  client: C;
  peer: number;
}

interface Room<C> {
  code: string;
  nextPeer: number;
  members: Member<C>[];
}

export type HostResult = { code: string; peer: number } | { error: string };
export type JoinResult = { code: string; peer: number; peers: number[] } | { error: string };

export class RoomRegistry<C = unknown> {
  private readonly rooms = new Map<string, Room<C>>();
  private readonly byClient = new Map<C, Room<C>>();

  constructor(private readonly rng: () => number = Math.random) {}

  get roomCount(): number {
    return this.rooms.size;
  }

  host(client: C): HostResult {
    if (this.byClient.has(client)) return { error: 'Already in a room' };
    if (this.rooms.size >= MAX_ROOMS) return { error: 'Server is full' };
    const code = this.newCode();
    if (code === null) return { error: 'Server is full' };
    const room: Room<C> = { code, nextPeer: 1, members: [{ client, peer: 0 }] };
    this.rooms.set(code, room);
    this.byClient.set(client, room);
    return { code, peer: 0 };
  }

  join(client: C, code: string): JoinResult {
    if (this.byClient.has(client)) return { error: 'Already in a room' };
    const room = this.rooms.get(code);
    if (!room) return { error: `No room with code ${code}` };
    if (room.members.length >= MAX_ROOM_PEERS) return { error: 'Room is full' };
    const peer = room.nextPeer++;
    room.members.push({ client, peer });
    this.byClient.set(client, room);
    return { code, peer, peers: room.members.map((m) => m.peer).sort((a, b) => a - b) };
  }

  /** The other members of the client's room, e.g. to tell them about a join. */
  others(client: C): Member<C>[] {
    const room = this.byClient.get(client);
    return room ? room.members.filter((m) => m.client !== client) : [];
  }

  peerOf(client: C): number | null {
    const room = this.byClient.get(client);
    return room?.members.find((m) => m.client === client)?.peer ?? null;
  }

  /** Removes the client from its room. Returns its peer id and who must be told, or null if it was in no room. */
  leave(client: C): { peer: number; notify: Member<C>[] } | null {
    const room = this.byClient.get(client);
    if (!room) return null;
    this.byClient.delete(client);
    const idx = room.members.findIndex((m) => m.client === client);
    const [me] = room.members.splice(idx, 1);
    if (room.members.length === 0) this.rooms.delete(room.code);
    return { peer: me.peer, notify: room.members.slice() };
  }

  /** Recipients of a relayed message: everyone else in the room, or only peer `to` (if it is in the room). */
  targets(client: C, to?: number): Member<C>[] {
    const room = this.byClient.get(client);
    if (!room) return [];
    return room.members.filter((m) => m.client !== client && (to === undefined || m.peer === to));
  }

  private newCode(): string | null {
    const min = 10 ** (ROOM_CODE_LENGTH - 1);
    const span = 10 ** ROOM_CODE_LENGTH - min;
    for (let i = 0; i < 100; i++) {
      const code = String(min + Math.min(span - 1, Math.floor(this.rng() * span)));
      if (!this.rooms.has(code)) return code;
    }
    for (let n = min; n < min + span; n++) {
      if (!this.rooms.has(String(n))) return String(n);
    }
    return null;
  }
}
