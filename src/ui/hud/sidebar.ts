import { STORAGE_CAP } from '../../config/constants';
import type { Player, World } from '../../types';
import { COLORS, drawText, rgba, type Ctx } from '../theme';
import { formatTime, sumStored } from '../format';
import type { Rect } from '../layout';
import { drawBar, hpColor } from '../widgets/bar';
import { drawDigits, digitsWidth } from '../widgets/digits';
import { drawPlayerGlyph } from '../widgets/glyph';
import { drawIcon } from '../widgets/icon';
import { drawPanel } from '../widgets/panel';
import { popScale, type PanelState } from './state';

/** Timer plate: counts up in campaign/untimed battle, down in timed battle. */
export function drawTimer(ctx: Ctx, r: Rect, world: World, s: number, now: number): void {
  const limit = world.settings.timeLimitSec;
  const timed = world.settings.mode === 'battle' && limit > 0;
  const shown = timed ? Math.max(0, limit - world.timeSec) : world.timeSec;
  const text = formatTime(shown);
  const overtime = timed && shown <= 0;
  const low = timed && shown <= 30;
  const blink = overtime ? Math.sin(now * 8) > 0 : true;
  drawPanel(ctx, r, { fill: COLORS.plate, alpha: 0.9, chamfer: 12 * s });
  let h = Math.min(r.h * 0.66, 66 * s);
  while (digitsWidth(text, h) > r.w - 28 * s && h > 10) h *= 0.92;
  const color = low ? (blink ? COLORS.danger : '#7a2a2a') : '#e9ecef';
  drawDigits(ctx, text, r.x + r.w / 2, r.y + (r.h - h) / 2 - (overtime ? 5 * s : 0), h, {
    align: 'center', color, ghost: 0.07, glow: low ? rgba(COLORS.danger, 0.7) : undefined,
  });
  if (overtime) drawText(ctx, 'OVERTIME', r.x + r.w / 2, r.y + r.h - 12 * s, { size: 11 * s, color: COLORS.danger, align: 'center', spacing: 2 * s });
}

interface PanelProps {
  world: World;
  player: Player;
  state: PanelState;
  r: Rect;
  s: number;
  now: number;
  flash: number;
}

function numberIn(ctx: Ctx, text: string, r: Rect, color: string, scale = 1): void {
  const h = r.h * 0.72 * scale;
  drawDigits(ctx, text, r.x + r.w - 8 * (r.h / 24), r.y + (r.h - h) / 2, h, { align: 'right', color, ghost: 0.0, outline: 'rgba(0,0,0,0.95)' });
}

/** One player's panel: glyph, green hits bar with shield, yellow thorium counter, cyan army bar with sword. */
export function drawPlayerPanel(ctx: Ctx, p: PanelProps): void {
  const { r, s, state, player } = p;
  const human = player.controller === 'human';
  const pad = 8 * s;
  drawPanel(ctx, r, { chamfer: 12 * s, edge: player.alive ? undefined : '#3a1a1a' });
  ctx.save();
  if (!player.alive) ctx.globalAlpha = 0.5;
  const gs = Math.min(r.h - 2 * pad, r.w * 0.28);
  drawPlayerGlyph(ctx, { x: r.x + pad, y: r.y + (r.h - gs) / 2, w: gs, h: gs }, player.id, {
    enemy: !human, team: player.team, alive: player.alive, flash: p.flash,
  });
  const cx = r.x + pad * 2 + gs;
  const cw = r.x + r.w - pad - cx;
  const rows = human ? 3 : 2;
  const rowH = Math.min(26 * s, (r.h - pad * 2 - 4 * s * (rows - 1)) / rows);
  const gap = human ? (r.h - pad * 2 - rowH * rows) / Math.max(1, rows - 1) : 10 * s;
  const y0 = r.y + (r.h - (rowH * rows + gap * (rows - 1))) / 2;
  const rowRect = (i: number): Rect => ({ x: cx, y: y0 + i * (rowH + gap), w: cw, h: rowH });
  const icon = rowH * 0.95;

  const hpRow = rowRect(0);
  const bar = { x: hpRow.x + icon + 4 * s, y: hpRow.y, w: hpRow.w - icon - 4 * s, h: rowH };
  drawIcon(ctx, 'shield', hpRow.x + icon / 2, hpRow.y + rowH / 2, icon, COLORS.hp);
  drawBar(ctx, bar, state.hpFrac, { fill: hpColor(state.hpFrac), track: COLORS.hpTrack, ghost: state.ghost, flash: p.flash });
  numberIn(ctx, String(Math.max(0, Math.ceil(player.hits))), bar, '#f4fff4');

  let i = 1;
  if (human) {
    const t = rowRect(i++);
    const plate = { x: t.x + icon + 4 * s, y: t.y, w: t.w - icon - 4 * s, h: rowH };
    drawIcon(ctx, 'thorium', t.x + icon / 2, t.y + rowH / 2, icon * 0.95, COLORS.thorium);
    drawBar(ctx, plate, 1, { fill: '#5a4708', track: '#2a2204' });
    const k = popScale(state, p.now);
    ctx.save();
    ctx.translate(plate.x + plate.w, plate.y + rowH / 2);
    ctx.scale(k, k);
    ctx.translate(-(plate.x + plate.w), -(plate.y + rowH / 2));
    numberIn(ctx, String(Math.round(state.thorium)), plate, COLORS.thorium);
    ctx.restore();
  }
  const u = rowRect(i);
  const ubar = { x: u.x + icon + 4 * s, y: u.y, w: u.w - icon - 4 * s, h: rowH };
  const units = sumStored(player.stored);
  const full = units >= STORAGE_CAP;
  const pulse = full ? 0.5 + 0.5 * Math.sin(p.now * 6) : 0;
  drawIcon(ctx, 'sword', u.x + icon / 2, u.y + rowH / 2, icon, COLORS.units);
  drawBar(ctx, ubar, state.units / STORAGE_CAP, { fill: COLORS.units, track: COLORS.unitsTrack, flash: pulse * 0.6 });
  numberIn(ctx, String(Math.round(state.units)), ubar, '#eaffff');
  ctx.restore();
}
