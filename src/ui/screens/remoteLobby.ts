import type { DeviceFrame, DeviceId } from '../../types';
import type { LobbyView } from '../../net/protocol';
import type { NetRoom } from '../../net/types';
import { COLORS, drawText, glowText } from '../theme';
import { drawHeader } from './common';
import { drawLobbyView } from './lobbyDraw';
import type { Screen } from './types';

/** How long "The host closed the room" stays up before the screen pops. */
export const ROOM_CLOSED_NOTICE_SEC = 2;
export const HOST_CLOSED_TEXT = 'The host closed the room';

const hasEdge = (f: DeviceFrame): boolean => f.confirm || f.back || f.left || f.right || f.alt === true;

/**
 * A client's view of the host's lobby: renders the {t:'lobby'} views the host broadcasts and forwards this
 * machine's lobby input as {t:'frames'} to the host (peer 0), which owns the seats. The host's {t:'start'}
 * is handled by the shell. When the room closes, shows HOST_CLOSED_TEXT (or the room error) for
 * ROOM_CLOSED_NOTICE_SEC, then pops.
 */
export function createRemoteLobbyScreen(initial: LobbyView | null = null): Screen {
  let view: LobbyView | null = initial;
  let attached: NetRoom | null = null;
  let unlisten: (() => void) | null = null;
  let hostClosed = false;
  let notice: string | null = null;
  let closing = 0;
  const wasConnected = new Map<DeviceId, boolean>();

  const detach = (): void => {
    unlisten?.();
    unlisten = null;
    attached = null;
  };

  const attach = (room: NetRoom | null): void => {
    if (room === attached) return;
    detach();
    if (!room) return;
    attached = room;
    unlisten = room.listen((e) => {
      if (e.t !== 'msg' || e.from !== 0) return;
      if (e.data.t === 'lobby') view = e.data.view;
      else if (e.data.t === 'closed') hostClosed = true;
      else if (e.data.t === 'start') detach();
    });
    // An empty frames batch asks the host for its current view, in case the one sent on join was missed.
    if (!view && room.status === 'open') room.send({ t: 'frames', frames: [] }, 0);
  };

  return {
    id: 'remoteLobby',
    update(nav, dt, ctx) {
      const net = ctx.net;
      if (!net) return { t: 'pop' };
      if (notice !== null) {
        closing += dt;
        return closing >= ROOM_CLOSED_NOTICE_SEC ? { t: 'pop' } : null;
      }
      const room = net.room();
      attach(room);
      if (!room || room.status === 'closed' || hostClosed) {
        notice = hostClosed || !room?.error ? HOST_CLOSED_TEXT : room.error;
        detach();
        net.leave();
        return null;
      }
      const frames = ctx.devices?.() ?? [];
      const out: DeviceFrame[] = [];
      for (const f of frames) {
        const was = wasConnected.get(f.id) ?? false;
        wasConnected.set(f.id, f.connected);
        if (f.connected ? hasEdge(f) : was) {
          out.push({ id: f.id, connected: f.connected, confirm: f.confirm, back: f.back, left: f.left, right: f.right, start: false, alt: f.alt === true });
        }
      }
      const seated = !!view && view.seats.some((s) => s.peer === room.me);
      if (!seated && (nav.back || frames.some((f) => f.connected && f.back))) {
        detach();
        net.leave();
        return { t: 'pop' };
      }
      if (out.length > 0 && room.status === 'open') room.send({ t: 'frames', frames: out }, 0);
      return null;
    },
    draw(g, size, now, ctx) {
      const { w, h } = size;
      if (notice !== null) {
        drawHeader(g, w, 'Online Lobby');
        glowText(g, notice, w / 2, h / 2, { size: 44, color: '#fff', glow: COLORS.danger, align: 'center', weight: 700 });
        drawText(g, 'Returning to the menu…', w / 2, h / 2 + 64, { size: 20, color: COLORS.dim, align: 'center', weight: 500 });
        return;
      }
      if (!view) {
        drawHeader(g, w, 'Online Lobby');
        glowText(g, "Waiting for the host's lobby…", w / 2, h / 2, { size: 34, color: '#fff', glow: COLORS.cyan, align: 'center', weight: 700, alpha: 0.6 + 0.4 * Math.sin(now * 4) });
        drawText(g, 'B / ○ or Backspace to leave', w / 2, h / 2 + 60, { size: 20, color: COLORS.dim, align: 'center', weight: 500 });
        return;
      }
      const me = ctx.net?.room()?.me ?? -1;
      const seated = view.seats.some((s) => s.peer === me);
      drawLobbyView(g, size, now, view, {
        seatTag: (s) => (s.peer === me ? 'You' : s.peer === 0 ? 'Host' : 'Online'),
        online: {
          headline: `ONLINE  Code ${view.code}`,
          detail: seated ? 'Connected to the host' : 'Connected to the host  ·  B / ○ with no seat leaves the room',
        },
        shipPreview: ctx.shipPreview,
      });
    },
  };
}
