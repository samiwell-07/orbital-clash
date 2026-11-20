import type { DeviceFrame, Difficulty, Intent } from '../types';
import type { Command } from '../ui/screens/types';
import type { LobbyRules, LobbySeat } from '../ui/screens/lobbyState';

/**
 * Online play over the local network. A relay (server/netRelay.ts, mounted on the Vite dev/preview
 * server at NET_PATH) groups sockets into rooms by a 4-digit code and forwards game messages.
 * The host is always peer 0; peer ids are never reused within a room.
 */
export const NET_PATH = '/net';
export const ROOM_CODE_LENGTH = 4;
export const MAX_ROOM_PEERS = 8;
/** Max encoded size of one client message, enforced by the relay. */
export const MAX_MESSAGE_BYTES = 64 * 1024;

export type StartCmd = Extract<Command, { t: 'startCampaign' | 'startBattle' }>;

/** What remote players see of the host's lobby (host -> clients, sent on every change). */
export interface LobbyView {
  code: string;
  title: string;
  subtitle?: string;
  rules: LobbyRules;
  seats: LobbySeat[];
  countdown: number | null;
}

/** Messages between game clients, relayed verbatim. */
export type GameMsg =
  /** host -> clients: the lobby changed. */
  | { t: 'lobby'; view: LobbyView }
  /** client -> host: this client's device frames that have an edge (peer is filled in by the host from `from`). */
  | { t: 'frames'; frames: DeviceFrame[] }
  /** host -> clients: start this match. Every peer builds the identical run from these fields. */
  | { t: 'start'; cmd: StartCmd; difficulty: Difficulty; seed: number }
  /**
   * lockstep: the sender's intents for simulation step `step` (one message per step, possibly empty).
   * `match` = the start seed, so packets still in flight from a previous match are ignored after a restart.
   */
  | { t: 'input'; match: number; step: number; intents: Intent[] }
  /** lockstep: world hash after `step`, for desync detection. */
  | { t: 'hash'; match: number; step: number; hash: number }
  /** host -> clients: the host closed the room (backed out of the lobby or quit). */
  | { t: 'closed' };

/** Client -> relay. */
export type ClientMsg =
  | { t: 'host' }
  | { t: 'join'; code: string }
  /** Relay to every other peer in the room, or only to `to`. */
  | { t: 'msg'; data: GameMsg; to?: number };

/** Relay -> client. */
export type ServerMsg =
  /** Sent on connect. `urls` = http://<lan-ip>:<port>/ addresses other machines can open. */
  | { t: 'welcome'; urls: string[] }
  | { t: 'hosted'; code: string; peer: number }
  /** `peers` = everyone in the room including you, ascending. */
  | { t: 'joined'; code: string; peer: number; peers: number[] }
  | { t: 'peerJoined'; peer: number }
  /** Sent after every message that peer sent, so all peers agree on its last input. */
  | { t: 'peerLeft'; peer: number }
  | { t: 'error'; reason: string }
  | { t: 'msg'; from: number; data: GameMsg };
