import type { GameMsg } from './protocol';

export type NetRole = 'host' | 'client';
export type NetStatus = 'connecting' | 'open' | 'closed';

export type NetEvent =
  | { t: 'msg'; from: number; data: GameMsg }
  | { t: 'peerJoined'; peer: number }
  | { t: 'peerLeft'; peer: number }
  | { t: 'status'; status: NetStatus };

/** One machine's membership in an online room (src/net/room.ts implements it over a WebSocket). */
export interface NetRoom {
  readonly role: NetRole;
  readonly status: NetStatus;
  /** Room code once hosted/joined, else null. */
  readonly code: string | null;
  /** Own peer id (host = 0); -1 until the relay answers. */
  readonly me: number;
  /** Everyone currently in the room including me, ascending. */
  readonly peers: readonly number[];
  /** LAN addresses other machines can open (from the relay's welcome). */
  readonly urls: readonly string[];
  /** Last error (bad code, room full, connection lost...), else null. */
  readonly error: string | null;
  /** Relays to every other peer, or only `to`. Dropped silently unless open. */
  send(data: GameMsg, to?: number): void;
  /** Subscribe to messages / peer changes / status; returns an unsubscribe function. */
  listen(fn: (e: NetEvent) => void): () => void;
  close(): void;
}

/** Shell hooks the screens use to host or join a room (ScreenCtx.net). */
export interface NetHooks {
  /** The open room, if any. */
  room(): NetRoom | null;
  /** Open a room as host (no-op when one is already open). */
  host(): void;
  /** Join a room by code (closes any open room first). */
  join(code: string): void;
  /** Close the room (the host also tells everyone the room closed). */
  leave(): void;
}
