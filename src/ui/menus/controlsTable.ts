import { BINDING_ROWS } from '../../input/bindings';
import type { ControlsDisplay } from '../../meta/settings';
import { COLORS, drawText, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawPanel } from '../widgets/panel';

/** Controls reference built from the input layer's BINDING_ROWS; the preferred device columns are highlighted. */
export function drawControlsTable(ctx: Ctx, r: Rect, prefer: ControlsDisplay): void {
  drawPanel(ctx, r, { chamfer: 14, alpha: 0.9 });
  const pad = r.w * 0.025;
  const cols = [r.x + pad, r.x + r.w * 0.36, r.x + r.w * 0.52, r.x + r.w * 0.68, r.x + r.w * 0.84];
  const heads = ['ACTION', 'XBOX', 'PLAYSTATION', 'PLAYER 1 KEYS', 'PLAYER 2 KEYS'];
  const padCol = (i: number): boolean => i === 1 || i === 2;
  const rowH = (r.h - pad * 2 - r.h * 0.07) / BINDING_ROWS.length;
  const size = Math.min(rowH * 0.5, r.w * 0.0118);
  const preferred = (i: number): boolean => (padCol(i) && prefer === 'gamepad') || (i >= 3 && prefer === 'keyboard');
  heads.forEach((h, i) => drawText(ctx, h, cols[i], r.y + pad + size, {
    size: size * 0.9, spacing: 2, weight: 700, color: preferred(i) ? COLORS.cyan : COLORS.dim,
  }));
  BINDING_ROWS.forEach((row, n) => {
    const y = r.y + pad + r.h * 0.07 + n * rowH;
    if (n % 2 === 0) {
      ctx.fillStyle = rgba('#ffffff', 0.035);
      ctx.fillRect(r.x + pad * 0.5, y, r.w - pad, rowH);
    }
    const cy = y + rowH / 2;
    drawText(ctx, row.action, cols[0], cy, { size, color: COLORS.text, weight: 500 });
    [row.xbox, row.ps, row.p1, row.p2].forEach((txt, i) => {
      drawText(ctx, txt, cols[i + 1], cy, { size, color: preferred(i + 1) ? COLORS.cyan : COLORS.text, weight: 600 });
    });
  });
}
