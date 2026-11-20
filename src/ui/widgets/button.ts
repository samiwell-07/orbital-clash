import { chamferPath, COLORS, drawText, glowText, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawIcon } from './icon';
import { drawPanel } from './panel';

export interface ButtonOpts {
  selected?: boolean;
  enabled?: boolean;
  nowSec?: number;
  icon?: string;
  accent?: string;
  size?: number;
}

/** Menu button: dark plate; the selected one glows cyan and pulses gently. */
export function drawButton(ctx: Ctx, r: Rect, label: string, o: ButtonOpts = {}): void {
  const accent = o.accent ?? COLORS.cyan;
  const on = o.enabled !== false;
  const pulse = o.selected ? 0.75 + 0.25 * Math.sin((o.nowSec ?? 0) * 5) : 0;
  drawPanel(ctx, r, {
    chamfer: 12,
    fill: o.selected ? '#0d2a33' : COLORS.panel,
    alpha: o.selected ? 0.95 : 0.82,
    edge: o.selected ? accent : COLORS.panelEdge,
    glow: o.selected ? rgba(accent, 0.55 * pulse) : undefined,
  });
  const size = o.size ?? r.h * 0.42;
  const tx = o.icon ? r.x + r.h * 1.1 : r.x + r.w / 2;
  if (o.icon) drawIcon(ctx, o.icon, r.x + r.h * 0.55, r.y + r.h / 2, r.h * 0.5, on ? accent : COLORS.dim);
  const color = !on ? '#555b6b' : o.selected ? '#ffffff' : COLORS.text;
  const t = { size, color, align: o.icon ? 'left' : 'center', spacing: size * 0.08 } as const;
  if (o.selected && on) glowText(ctx, label, tx, r.y + r.h / 2 + 1, { ...t, glow: accent });
  else drawText(ctx, label, tx, r.y + r.h / 2 + 1, t);
  if (o.selected) {
    ctx.save();
    ctx.fillStyle = accent;
    chamferPath(ctx, r.x - 10, r.y + r.h / 2 - 7, 6, 14, 2);
    ctx.fill();
    ctx.restore();
  }
}
