import { ROOM_CODE_LENGTH, type LobbyView } from '../../net/protocol';
import type { NetRoom } from '../../net/types';
import { COLORS, drawText, glowText, rgba } from '../theme';
import { drawPanel } from '../widgets/panel';
import { drawFooter, drawHeader } from './common';
import { createRemoteLobbyScreen } from './remoteLobby';
import type { Screen } from './types';

/** Seconds without an answer before "Connecting…" gives up. */
const CONNECT_TIMEOUT_SEC = 10;
export const NEEDS_DEV_SERVER = 'Online play needs the dev server (npm run dev)';

/**
 * Client side of online play: enter the host's 4-digit room code, then join its lobby.
 * Keyboard: type digits, Backspace deletes (and leaves when empty), Enter joins.
 * Pad: ▲ ▼ change the digit under the cursor, ◀ ▶ move it, A / ✕ joins, B / ○ deletes / leaves.
 */
export function createJoinOnlineScreen(): Screen {
  const code: string[] = [];
  let cursor = 0;
  let phase: 'edit' | 'connecting' = 'edit';
  let error: string | null = null;
  let waited = 0;
  let attached: NetRoom | null = null;
  let unlisten: (() => void) | null = null;
  // The host answers a join with its lobby view, possibly before the remote lobby screen subscribes.
  let view: LobbyView | null = null;

  const detach = (): void => {
    unlisten?.();
    unlisten = null;
    attached = null;
  };

  const setDigit = (d: string): void => {
    code[cursor] = d;
    error = null;
  };

  return {
    id: 'joinOnline',
    update(nav, dt, ctx) {
      const net = ctx.net;
      if (!net) return nav.back ? { t: 'pop' } : null;
      if (phase === 'connecting') {
        const room = net.room();
        if (room && room !== attached) {
          detach();
          attached = room;
          unlisten = room.listen((e) => {
            if (e.t === 'msg' && e.data.t === 'lobby') view = e.data.view;
          });
        }
        if (room && room.role === 'client' && room.status === 'open' && room.me >= 0) {
          detach();
          return { t: 'replace', screen: createRemoteLobbyScreen(view) };
        }
        waited += dt;
        const failed = room ? room.status === 'closed' || room.error !== null : false;
        if (failed || waited >= CONNECT_TIMEOUT_SEC || nav.back) {
          error = nav.back && !failed ? null : room?.error ?? 'No answer from the host';
          phase = 'edit';
          detach();
          net.leave();
        }
        return null;
      }
      for (const ch of ctx.text?.() ?? '') {
        if (ch >= '0' && ch <= '9') {
          setDigit(ch);
          cursor = Math.min(cursor + 1, ROOM_CODE_LENGTH - 1);
        }
      }
      if (nav.up !== nav.down) setDigit(String((Number(code[cursor] ?? '0') + (nav.up ? 1 : 9)) % 10));
      if (nav.left) cursor = Math.max(0, cursor - 1);
      if (nav.right) cursor = Math.min(cursor + 1, code.length, ROOM_CODE_LENGTH - 1);
      if (nav.back) {
        if (code.length === 0) return { t: 'pop' };
        code.pop();
        cursor = Math.min(code.length, ROOM_CODE_LENGTH - 1);
        error = null;
      } else if (nav.confirm) {
        if (code.length === ROOM_CODE_LENGTH) {
          phase = 'connecting';
          error = null;
          waited = 0;
          view = null;
          net.join(code.join(''));
        } else {
          error = `Enter all ${ROOM_CODE_LENGTH} digits of the room code`;
        }
      }
      return null;
    },
    draw(g, size, now, ctx) {
      const { w, h } = size;
      drawHeader(g, w, 'Join Online', "Enter the room code shown in the host's lobby");
      const bw = 130;
      const bh = 160;
      const gap = 28;
      const x0 = (w - (bw * ROOM_CODE_LENGTH + gap * (ROOM_CODE_LENGTH - 1))) / 2;
      const y = h * 0.3;
      const editing = phase === 'edit' && !!ctx.net;
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        const r = { x: x0 + i * (bw + gap), y, w: bw, h: bh };
        const sel = editing && i === cursor;
        drawPanel(g, r, { chamfer: 14, alpha: 0.9, edge: sel ? COLORS.cyan : rgba(COLORS.dim, 0.5), glow: sel ? COLORS.cyan : undefined, lineWidth: sel ? 3 : 2 });
        const d = code[i];
        if (d !== undefined) glowText(g, d, r.x + bw / 2, y + bh / 2 + 4, { size: 96, color: '#fff', glow: COLORS.cyan, align: 'center', weight: 800 });
        else if (sel) drawText(g, '_', r.x + bw / 2, y + bh / 2 + 4, { size: 80, color: COLORS.cyan, align: 'center', weight: 700, alpha: 0.5 + 0.5 * Math.sin(now * 6) });
        if (sel) {
          drawText(g, '▲', r.x + bw / 2, y - 26, { size: 22, color: COLORS.dim, align: 'center' });
          drawText(g, '▼', r.x + bw / 2, y + bh + 28, { size: 22, color: COLORS.dim, align: 'center' });
        }
      }
      const sy = y + bh + 110;
      if (!ctx.net) drawText(g, NEEDS_DEV_SERVER, w / 2, sy, { size: 26, color: COLORS.thorium, align: 'center', weight: 700 });
      else if (phase === 'connecting') {
        glowText(g, 'Connecting…', w / 2, sy, { size: 30, color: '#fff', glow: COLORS.cyan, align: 'center', weight: 700, alpha: 0.6 + 0.4 * Math.sin(now * 4) });
      } else if (error) drawText(g, error, w / 2, sy, { size: 24, color: COLORS.danger, align: 'center', weight: 700 });
      else drawText(g, 'Type the digits, or use ▲ ▼ to change a digit and ◀ ▶ to move', w / 2, sy, { size: 20, color: COLORS.dim, align: 'center', weight: 500 });
      drawText(g, 'The host opens the room with Y / △ (keyboard R) in any lobby', w / 2, sy + 44, { size: 17, color: rgba(COLORS.dim, 0.8), align: 'center', weight: 500 });
      drawFooter(g, h, ctx.data.save.settings.controlsDisplay, [{ key: 'confirm', label: 'Join' }, { key: 'move', label: 'Digit' }, { key: 'back', label: 'Delete · Back' }]);
    },
  };
}
