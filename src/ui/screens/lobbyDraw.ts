import { PALETTE_SIZE, paletteColor } from '../../config/playerColors';
import { PLAYER_COLOR_NAMES } from '../../types';
import { COLORS, drawText, glowText, hex, measure, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawBackdrop, drawPanel } from '../widgets/panel';
import { drawHeader } from './common';
import { lobbyColorFree, lobbyDeviceLabel, type LobbyRules, type LobbySeat } from './lobbyState';
import type { ScreenCtx } from './types';

/** What the lobby draws: the host's live LobbyState or a LobbyView received over the network. */
export interface LobbyViewLike {
  title: string;
  subtitle?: string;
  rules: LobbyRules;
  seats: readonly LobbySeat[];
  countdown: number | null;
}

/** Online status shown on the lobby: headline top-right (room code), detail line under the cards. */
export interface LobbyOnlineBanner {
  headline: string;
  detail?: string;
  error?: boolean;
}

export interface LobbyDrawOptions {
  /** Text after the device label on a seat card ('Online', 'You', 'Host'), or null. 'You' is highlighted. */
  seatTag?: (seat: LobbySeat) => string | null;
  /** Adds the "Y / △ Host online" hint. */
  hostHint?: boolean;
  /** Extra hint (e.g. leave the room) appended to the pad hints. */
  extraHint?: [string, string];
  online?: LobbyOnlineBanner | null;
  shipPreview?: ScreenCtx['shipPreview'];
}

const colorOf = (i: number): string => hex(paletteColor(i));

function drawShipSilhouette(g: Ctx, cx: number, cy: number, r: number, color: string, now: number): void {
  g.save();
  g.translate(cx, cy);
  g.rotate(Math.sin(now * 0.8) * 0.18);
  g.beginPath();
  g.moveTo(0, -r);
  g.lineTo(r * 0.72, r * 0.72);
  g.lineTo(0, r * 0.36);
  g.lineTo(-r * 0.72, r * 0.72);
  g.closePath();
  const grad = g.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, rgba(color, 0.95));
  grad.addColorStop(1, rgba(color, 0.35));
  g.fillStyle = grad;
  g.shadowColor = color;
  g.shadowBlur = r * 0.35;
  g.fill();
  g.shadowBlur = 0;
  g.lineWidth = 3;
  g.strokeStyle = '#ffffff';
  g.globalAlpha = 0.6;
  g.stroke();
  g.restore();
}

function drawJoinedCard(g: Ctx, r: Rect, i: number, view: LobbyViewLike, now: number, preview: CanvasImageSource | null, tag: string | null): void {
  const seat = view.seats[i];
  const color = colorOf(seat.colorIndex);
  drawPanel(g, r, { chamfer: 18, alpha: 0.9, edge: color, glow: seat.ready ? color : rgba(color, 0.5), lineWidth: seat.ready ? 3 : 2 });
  const cx = r.x + r.w / 2;
  glowText(g, `P${i + 1}`, cx, r.y + 58, { size: 56, color, glow: color, align: 'center', weight: 800, spacing: 4 });
  const label = tag ? `${lobbyDeviceLabel(seat.device)} · ${tag}` : lobbyDeviceLabel(seat.device);
  drawText(g, label, cx, r.y + 106, { size: 18, color: tag === 'You' ? '#fff' : COLORS.dim, align: 'center', weight: tag === 'You' ? 700 : 600 });
  const s = Math.min(r.w - 60, r.h * 0.44);
  const box = { x: cx - s / 2, y: r.y + 130, w: s, h: s };
  const halo = g.createRadialGradient(cx, box.y + s / 2, 0, cx, box.y + s / 2, s * 0.55);
  halo.addColorStop(0, rgba(color, 0.22));
  halo.addColorStop(1, rgba(color, 0));
  g.fillStyle = halo;
  g.fillRect(box.x, box.y, box.w, box.h);
  if (preview) g.drawImage(preview, box.x, box.y, box.w, box.h);
  else drawShipSilhouette(g, cx, box.y + s / 2, s * 0.32, color, now);
  let y = box.y + s + 40;
  const name = PLAYER_COLOR_NAMES[seat.colorIndex] ?? `Colour ${seat.colorIndex + 1}`;
  drawText(g, name.toUpperCase(), cx, y, { size: 28, color, align: 'center', weight: 700, spacing: 3 });
  if (!seat.ready) {
    const half = measure(g, name.toUpperCase(), 28, 700, 3) / 2 + 34;
    const pulse = 0.6 + 0.4 * Math.sin(now * 5);
    drawText(g, '◀', cx - half, y, { size: 24, color: '#fff', align: 'center', alpha: pulse });
    drawText(g, '▶', cx + half, y, { size: 24, color: '#fff', align: 'center', alpha: pulse });
  }
  y += 40;
  const dot = Math.min(13, (r.w - 60) / (PALETTE_SIZE * 3));
  const step = dot * 2.8;
  const x0 = cx - (step * (PALETTE_SIZE - 1)) / 2;
  for (let c = 0; c < PALETTE_SIZE; c++) {
    const free = lobbyColorFree(view.rules, view.seats, c, i);
    g.save();
    g.globalAlpha = c === seat.colorIndex ? 1 : free ? 0.75 : 0.18;
    g.fillStyle = colorOf(c);
    g.beginPath();
    g.arc(x0 + c * step, y, dot, 0, Math.PI * 2);
    g.fill();
    if (c === seat.colorIndex) {
      g.lineWidth = 2.5;
      g.strokeStyle = '#ffffff';
      g.beginPath();
      g.arc(x0 + c * step, y, dot + 5, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
  const by = r.y + r.h - 44;
  if (seat.ready) glowText(g, 'READY', cx, by, { size: 34, color: COLORS.ok, glow: COLORS.ok, align: 'center', weight: 800, spacing: 6 });
  else drawText(g, 'Choose colour · A / ✕ to ready', cx, by, { size: 18, color: COLORS.text, align: 'center', weight: 600 });
}

function drawEmptyCard(g: Ctx, r: Rect, i: number, now: number, required: boolean): void {
  drawPanel(g, r, { chamfer: 18, alpha: 0.6, edge: rgba(COLORS.dim, 0.45) });
  const cx = r.x + r.w / 2;
  drawText(g, `P${i + 1}`, cx, r.y + 58, { size: 56, color: rgba(COLORS.dim, 0.35), align: 'center', weight: 800, spacing: 4 });
  const cy = r.y + r.h * 0.48;
  const pulse = 0.55 + 0.45 * Math.sin(now * 3);
  drawText(g, 'Press A / ✕ to join', cx, cy, { size: 24, color: COLORS.text, align: 'center', weight: 700, alpha: pulse });
  drawText(g, 'or E / U on keyboard', cx, cy + 38, { size: 18, color: COLORS.dim, align: 'center', weight: 500 });
  if (!required) drawText(g, 'Optional', cx, r.y + r.h - 44, { size: 16, color: rgba(COLORS.dim, 0.7), align: 'center', weight: 600, spacing: 3 });
}

function drawHints(g: Ctx, h: number, opts: LobbyDrawOptions): void {
  const hints: [string, string][] = [['A / ✕', 'Join · Ready'], ['◀ ▶', 'Colour'], ['B / ○', 'Leave · Not ready']];
  if (opts.hostHint) hints.push(['Y / △', 'Host online']);
  if (opts.extraHint) hints.push(opts.extraHint);
  let x = 70;
  const y = h - 66;
  for (const [key, label] of hints) {
    const kw = Math.max(34, measure(g, key, 15, 700) + 22);
    g.save();
    g.fillStyle = 'rgba(11,12,16,0.9)';
    g.strokeStyle = COLORS.cyan;
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(x, y - 15, kw, 30, 8);
    g.fill();
    g.stroke();
    g.restore();
    drawText(g, key, x + kw / 2, y + 1, { size: 15, color: COLORS.cyan, align: 'center', weight: 700 });
    drawText(g, label, x + kw + 12, y + 1, { size: 17, color: COLORS.dim, weight: 500 });
    x += kw + 12 + measure(g, label, 17, 500) + 34;
  }
  const kb = 'Keyboard:  E / U join · ready    A D / J L colour    Q / O leave' + (opts.hostHint ? '    R / H host online' : '');
  drawText(g, kb, 70, h - 26, { size: 15, color: rgba(COLORS.dim, 0.8), weight: 500 });
}

/** Whole lobby: header, one card per seat slot, status line, online banner, hints and the countdown overlay. */
export function drawLobbyView(g: Ctx, size: { w: number; h: number }, now: number, view: LobbyViewLike, opts: LobbyDrawOptions = {}): void {
  const { w, h } = size;
  const { minPlayers, maxPlayers } = view.rules;
  drawHeader(g, w, view.title, view.subtitle);
  const n = Math.max(1, maxPlayers);
  const gap = 30;
  const top = 190;
  const cardH = Math.max(320, Math.min(640, h - top - 190));
  const cardW = Math.min(400, (w - 140 - gap * (n - 1)) / n);
  const x0 = (w - (cardW * n + gap * (n - 1))) / 2;
  for (let i = 0; i < n; i++) {
    const r = { x: x0 + i * (cardW + gap), y: top, w: cardW, h: cardH };
    const seat = view.seats[i];
    if (seat) drawJoinedCard(g, r, i, view, now, opts.shipPreview?.(seat.colorIndex, now) ?? null, opts.seatTag?.(seat) ?? null);
    else drawEmptyCard(g, r, i, now, i < minPlayers);
  }
  const joined = view.seats.length;
  const sy = top + cardH + 40;
  if (joined < minPlayers) {
    drawText(g, `Waiting for ${minPlayers} player${minPlayers === 1 ? '' : 's'}  (${joined} / ${minPlayers} joined)`, w / 2, sy, { size: 22, color: COLORS.thorium, align: 'center', weight: 600 });
  } else if (view.countdown === null) {
    drawText(g, 'Waiting for everyone to ready up', w / 2, sy, { size: 22, color: COLORS.dim, align: 'center', weight: 600 });
  }
  const online = opts.online;
  if (online) {
    glowText(g, online.headline, w - 70, 78, { size: 34, color: online.error ? COLORS.danger : '#fff', glow: online.error ? COLORS.danger : COLORS.cyan, align: 'right', weight: 800, spacing: 4 });
    if (online.detail) drawText(g, online.detail, w / 2, sy + 42, { size: 20, color: online.error ? COLORS.danger : COLORS.cyan, align: 'center', weight: 600 });
  }
  drawHints(g, h, opts);
  if (view.countdown !== null) {
    drawBackdrop(g, { x: 0, y: 0, w, h }, 0.45);
    glowText(g, 'STARTING IN', w / 2, h / 2 - 110, { size: 38, color: '#fff', glow: COLORS.cyan, align: 'center', weight: 700, spacing: 10 });
    glowText(g, String(Math.max(1, Math.ceil(view.countdown - 1e-6))), w / 2, h / 2 + 30, { size: 180, color: '#fff', glow: COLORS.cyan, align: 'center', weight: 800 });
    drawText(g, 'B / ○ to cancel', w / 2, h / 2 + 170, { size: 20, color: COLORS.dim, align: 'center', weight: 600 });
  }
}
