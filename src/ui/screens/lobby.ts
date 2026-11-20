import { DEVICE_IDS, type DeviceFrame, type Seat } from '../../types';
import type { LobbyView } from '../../net/protocol';
import type { NetEvent, NetRoom } from '../../net/types';
import { drawLobbyView, type LobbyOnlineBanner } from './lobbyDraw';
import { LobbyState, type LobbyRules } from './lobbyState';
import type { Command, Screen, ScreenCtx } from './types';

export interface LobbyOptions {
  title: string;
  subtitle?: string;
  rules: LobbyRules;
  onStart: (seats: Seat[]) => Command;
  /** Open the room online as soon as the lobby appears (Multiplayer → Create Lobby). */
  autoHost?: boolean;
}

export interface LobbyScreen extends Screen {
  readonly state: LobbyState;
}

/** The room this machine hosts, unless it has closed. */
function hostRoom(ctx: ScreenCtx): NetRoom | null {
  const room = ctx.net?.room() ?? null;
  return room && room.role === 'host' && room.status !== 'closed' ? room : null;
}

/** A remote peer's lobby frames, trusted only as far as their shape; `peer` is always the sender. */
function remoteFrames(raw: unknown, from: number): DeviceFrame[] {
  if (!Array.isArray(raw)) return [];
  const out: DeviceFrame[] = [];
  for (const f of raw.slice(0, DEVICE_IDS.length * 4) as Partial<DeviceFrame>[]) {
    if (!f || typeof f !== 'object' || !DEVICE_IDS.includes(f.id as DeviceFrame['id'])) continue;
    out.push({
      id: f.id as DeviceFrame['id'],
      connected: f.connected === true,
      confirm: f.confirm === true,
      back: f.back === true,
      left: f.left === true,
      right: f.right === true,
      start: false,
      peer: from,
    });
  }
  return out;
}

function onlineBanner(ctx: ScreenCtx): LobbyOnlineBanner | null {
  const room = ctx.net?.room() ?? null;
  if (!room || room.role !== 'host') return null;
  if (room.status === 'closed' || room.error) return { headline: 'ONLINE', detail: room.error ?? 'The room closed', error: true };
  if (room.status === 'connecting' || !room.code) return { headline: 'ONLINE', detail: 'Opening room…' };
  const remote = room.peers.filter((p) => p !== room.me).length;
  const url = room.urls[0];
  const join = url ? `Friends open ${url} → Multiplayer → Join Lobby` : 'Friends choose Multiplayer → Join Lobby';
  return { headline: `ONLINE  Code ${room.code}`, detail: `${join}  ·  ${remote} remote player${remote === 1 ? '' : 's'} connected` };
}

/**
 * Pre-match join lobby: each player joins with their own device, picks a colour and readies up.
 * Alt (Y / △, keyboard R / H) on a local device opens the lobby online: remote players' device frames
 * arrive as {t:'frames'} and the lobby view is broadcast as {t:'lobby'} whenever it changes.
 */
export function createLobbyScreen(opts: LobbyOptions): LobbyScreen {
  const state = new LobbyState(opts.rules);
  let attached: NetRoom | null = null;
  let unlisten: (() => void) | null = null;
  let queue: DeviceFrame[] = [];
  let lastKey: string | null = null;
  // Auto-hosting is tried once; if it fails the banner shows why and Y / R can retry.
  let autoHostPending = opts.autoHost === true;
  const view = (code: string): LobbyView => ({
    code,
    title: opts.title,
    ...(opts.subtitle !== undefined ? { subtitle: opts.subtitle } : {}),
    rules: opts.rules,
    seats: state.seats.map((s) => ({ ...s })),
    countdown: state.countdown,
  });

  const sendView = (room: NetRoom, to?: number): void => {
    if (room.status === 'open' && room.code) room.send({ t: 'lobby', view: view(room.code) }, to);
  };

  const detach = (): void => {
    unlisten?.();
    unlisten = null;
    attached = null;
    queue = [];
    lastKey = null;
  };

  const attach = (room: NetRoom | null): void => {
    if (room === attached) return;
    detach();
    if (!room) return;
    attached = room;
    unlisten = room.listen((e: NetEvent) => {
      if (e.t === 'peerJoined') sendView(room, e.peer);
      else if (e.t === 'peerLeft') {
        queue = queue.filter((f) => f.peer !== e.peer);
        state.dropPeer(e.peer);
      } else if (e.t === 'msg' && e.data.t === 'frames' && e.from !== 0) {
        const frames = remoteFrames(e.data.frames, e.from);
        // An empty batch is a client asking for the current view (it may have missed the one sent on join).
        if (frames.length === 0) sendView(room, e.from);
        else queue.push(...frames);
      }
    });
  };

  const broadcast = (room: NetRoom): void => {
    if (room.status !== 'open' || !room.code) return;
    const key = JSON.stringify({ s: state.seats, c: state.countdown === null ? null : Math.ceil(state.countdown) });
    if (key === lastKey) return;
    lastKey = key;
    sendView(room);
  };

  return {
    id: 'lobby',
    state,
    update(nav, dt, ctx) {
      if (!ctx.devices) return nav.back ? { t: 'pop' } : null;
      // A successful start replaces the screen stack, so still being updated means the start failed.
      state.abortStart();
      if (autoHostPending && ctx.net) {
        autoHostPending = false;
        if (!ctx.net.room()) ctx.net.host();
      }
      const room = hostRoom(ctx);
      attach(room);
      if (!room) for (const p of new Set(state.seats.map((s) => s.peer).filter((p) => p !== 0))) state.dropPeer(p);
      const local = ctx.devices();
      if (ctx.net && !room && local.some((f) => f.alt && f.connected)) ctx.net.host();
      const frames = queue.length > 0 ? [...local, ...queue.splice(0)] : local;
      const ev = state.update(frames, dt);
      if (ev === 'back') {
        if (ctx.net?.room()?.role === 'host') ctx.net.leave();
        detach();
        return { t: 'pop' };
      }
      if (ev === 'start') {
        detach();
        return opts.onStart(state.toSeats());
      }
      if (room) broadcast(room);
      return null;
    },
    draw(g, size, now, ctx) {
      const hosting = hostRoom(ctx) !== null;
      drawLobbyView(g, size, now, { ...opts, seats: state.seats, countdown: state.countdown }, {
        seatTag: (s) => (s.peer !== 0 ? 'Online' : null),
        hostHint: !!ctx.net && !hosting,
        online: onlineBanner(ctx),
        shipPreview: ctx.shipPreview,
      });
    },
  };
}
