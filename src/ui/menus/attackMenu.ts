import { COLORS, drawText, glowText, playerColor, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { clampRect } from '../layout';
import type { Pips } from '../format';
import { drawIcon } from '../widgets/icon';
import { drawPlayerGlyph } from '../widgets/glyph';
import { slotAngle, type AttackSlot } from './attackUnits';

const PIP_COLORS = { white: '#f4f6ff', blue: '#4aa8ff', red: '#ff4a4a' } as const;

export function pipsSize(pips: Pips, s: number): { w: number; h: number } {
  const rows = [pips.red, pips.blue, pips.white].filter((n) => n > 0);
  return { w: Math.max(0, ...rows) * 8.5 * s, h: rows.length * 8.5 * s };
}

/** Rows of pips: red (100) on top, blue (10), white (1) below. Centred on (cx, cy). */
export function drawPips(ctx: Ctx, pips: Pips, cx: number, cy: number, s: number): void {
  const rows: [number, string][] = [[pips.red, PIP_COLORS.red], [pips.blue, PIP_COLORS.blue], [pips.white, PIP_COLORS.white]];
  const step = 8.5 * s;
  const used = rows.filter(([n]) => n > 0);
  used.forEach(([n, color], r) => {
    const y = cy + (r - (used.length - 1) / 2) * step;
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * step;
      ctx.beginPath();
      ctx.arc(x, y, 3.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;
      ctx.fill();
    }
  });
  ctx.shadowBlur = 0;
}

export interface AttackMenuView {
  slots: readonly AttackSlot[];
  /** Sector under the stick, -1 none. */
  hover: number;
  locked: boolean;
  player: number;
  target: number;
  /** Battle with several enemies: show the LB / L1 hint. */
  cycleHint: boolean;
  enemyTarget: boolean;
}

export const ATTACK_RADIUS = 138;

/** Missile button hold: a ring around the ship that fills over the charge time, then the silos fire. */
export function drawMissileCharge(ctx: Ctx, at: { x: number; y: number }, charge: number, s: number): void {
  const r = 30 * s;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 4 * s;
  ctx.strokeStyle = 'rgba(11,12,16,0.7)';
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = COLORS.danger;
  ctx.shadowColor = COLORS.danger;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, charge));
  ctx.stroke();
  ctx.restore();
  drawText(ctx, 'MISSILE', at.x, at.y - r - 10 * s, { size: 11 * s, color: COLORS.danger, align: 'center', spacing: 1.5 * s, weight: 700 });
}

/** RS / R3 radial: unit icons around a centre target glyph, pips below each icon, yellow lock bar on a locked pick. */
export function drawAttackMenu(ctx: Ctx, center: { x: number; y: number }, bounds: Rect, v: AttackMenuView, s: number, now: number): void {
  const R = ATTACK_RADIUS * s;
  const ext = R + 130 * s;
  const c = clampRect(center.x - ext, center.y - ext, ext * 2, ext * 2, bounds);
  const cx = c.x + ext, cy = c.y + ext;
  const col = playerColor(v.player);
  ctx.save();
  const bg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, ext);
  bg.addColorStop(0, 'rgba(6,10,20,0.9)');
  bg.addColorStop(0.7, 'rgba(6,10,20,0.55)');
  bg.addColorStop(1, 'rgba(6,10,20,0)');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(cx, cy, ext, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(col, 0.35);
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawPlayerGlyph(ctx, { x: cx - 34 * s, y: cy - 34 * s, w: 68 * s, h: 68 * s }, v.target, { enemy: v.enemyTarget });
  drawIcon(ctx, 'target', cx + 30 * s, cy - 30 * s, 20 * s, COLORS.danger);
  if (v.cycleHint) drawText(ctx, 'LB / L1  CHANGE TARGET', cx, cy + 52 * s, { size: 11 * s, color: COLORS.cyan, align: 'center', spacing: 1.5 * s, weight: 700 });

  v.slots.forEach((sl, i) => {
    const a = slotAngle(i, v.slots.length);
    const dx = Math.sin(a), dy = -Math.cos(a);
    const sx = cx + dx * R, sy = cy + dy * R;
    const active = sl.selected || v.hover === i;
    ctx.save();
    ctx.globalAlpha = sl.locked ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 34 * s, 0, Math.PI * 2);
    ctx.fillStyle = active ? rgba(col, 0.35) : 'rgba(11,12,16,0.9)';
    ctx.fill();
    ctx.lineWidth = active ? 3.5 * s : 2 * s;
    ctx.strokeStyle = active ? col : '#2b2f3a';
    ctx.shadowColor = col;
    ctx.shadowBlur = active ? 14 : 0;
    ctx.stroke();
    ctx.restore();
    drawIcon(ctx, sl.kind, sx, sy, 38 * s, sl.locked ? COLORS.dim : active ? '#fff' : col);
    if (sl.locked) drawIcon(ctx, 'lock', sx + 22 * s, sy + 22 * s, 18 * s, COLORS.lock);
    if (active && v.locked) {
      ctx.save();
      ctx.strokeStyle = COLORS.lock;
      ctx.lineWidth = 6 * s;
      ctx.lineCap = 'round';
      ctx.shadowColor = COLORS.lock;
      ctx.shadowBlur = 10 + 4 * Math.sin(now * 6);
      ctx.beginPath();
      ctx.arc(sx, sy, 42 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (!sl.locked) {
      const sz = pipsSize(sl.pips, s);
      drawPips(ctx, sl.pips, sx + dx * (38 * s + sz.w / 2 + 4 * s), sy + dy * (38 * s + sz.h / 2 + 4 * s), s);
    }
  });
  const hov = v.slots[v.hover] ?? v.slots.find((sl) => sl.selected);
  if (hov) {
    const txt = hov.lockReason ?? `${hov.name}  ×${hov.count}`;
    drawText(ctx, txt, cx, cy + 74 * s, { size: 13 * s, color: hov.lockReason ? COLORS.lock : '#fff', align: 'center', weight: 700 });
  }
  if (v.locked) glowText(ctx, 'ATTACK LOCKED', cx, cy - 56 * s, { size: 13 * s, color: COLORS.lock, glow: COLORS.lock, align: 'center', spacing: 3 * s, weight: 700 });
}
