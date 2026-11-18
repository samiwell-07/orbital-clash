import { BINDING_ROWS } from '../../input/bindings';
import type { ControlsDisplay } from '../../meta/settings';
import { COLORS, drawText, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawPanel } from '../widgets/panel';

/** Controls reference built from the input layer's BINDING_ROWS; the preferred device column is highlighted. */
export function drawControlsTable(ctx: Ctx, r: Rect, prefer: ControlsDisplay): void {
  drawPanel(ctx, r, { chamfer: 14, alpha: 0.9 });
  const pad = r.w * 0.025;
  const cols = [r.x + pad, r.x + r.w * 0.42, r.x + r.w * 0.62, r.x + r.w * 0.81];
  const heads = ['ACTION', 'GAMEPAD', 'PLAYER 1 KEYS', 'PLAYER 2 KEYS'];
  const rowH = (r.h - pad * 2 - r.h * 0.07) / BINDING_ROWS.length;
  const size = Math.min(rowH * 0.5, r.w * 0.0125);
  heads.forEach((h, i) => drawText(ctx, h, cols[i], r.y + pad + size, {
    size: size * 0.9, spacing: 2, weight: 700,
    color: (i === 1 && prefer === 'gamepad') || (i >= 2 && prefer === 'keyboard') ? COLORS.cyan : COLORS.dim,
  }));
  BINDING_ROWS.forEach((row, n) => {
    const y = r.y + pad + r.h * 0.07 + n * rowH;
    if (n % 2 === 0) {
      ctx.fillStyle = rgba('#ffffff', 0.035);
      ctx.fillRect(r.x + pad * 0.5, y, r.w - pad, rowH);
    }
    const cy = y + rowH / 2;
    drawText(ctx, row.action, cols[0], cy, { size, color: COLORS.text, weight: 500 });
    drawText(ctx, row.pad, cols[1], cy, { size, color: prefer === 'gamepad' ? COLORS.cyan : COLORS.text, weight: 600 });
    drawText(ctx, row.p1, cols[2], cy, { size, color: prefer === 'keyboard' ? COLORS.cyan : COLORS.text, weight: 600 });
    drawText(ctx, row.p2, cols[3], cy, { size, color: prefer === 'keyboard' ? COLORS.cyan : COLORS.text, weight: 600 });
  });
}
