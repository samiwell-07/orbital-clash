import { COLORS, drawText, playerColor, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { clampRect } from '../layout';
import { drawIcon } from '../widgets/icon';
import { drawPanel } from '../widgets/panel';
import { windowStart, type BuildItem } from './buildItems';

const MAX_ROWS = 8;

export function buildMenuSize(count: number, s: number): { w: number; h: number } {
  return { w: 268 * s, h: (66 + Math.min(count, MAX_ROWS) * 38 + 8) * s };
}

/** R1 list: icon, name and gold cost per row; locked rows show a lock, unaffordable ones are dimmed to 40 %. */
export function drawBuildMenu(
  ctx: Ctx, anchor: { x: number; y: number }, bounds: Rect, items: readonly BuildItem[],
  index: number, player: number, s: number, now: number,
): void {
  const { w, h } = buildMenuSize(items.length, s);
  const r = clampRect(anchor.x + 34 * s, anchor.y - h / 2, w, h, bounds);
  const col = playerColor(player);
  drawPanel(ctx, r, { chamfer: 12 * s, edge: col, glow: col, alpha: 0.93 });
  drawText(ctx, 'BUILD', r.x + 18 * s, r.y + 24 * s, { size: 15 * s, color: col, spacing: 4 * s, weight: 700 });
  const first = windowStart(index, items.length, MAX_ROWS);
  const rows = items.slice(first, first + MAX_ROWS);
  const rh = 38 * s;
  rows.forEach((it, i) => {
    const sel = first + i === index;
    const y = r.y + 44 * s + i * rh;
    if (sel) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.04 * Math.sin(now * 6)})`;
      ctx.fillRect(r.x + 8 * s, y, r.w - 16 * s, rh - 4 * s);
      ctx.fillStyle = col;
      ctx.fillRect(r.x + 8 * s, y, 4 * s, rh - 4 * s);
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = it.locked ? 0.55 : it.affordable ? 1 : 0.4;
    drawIcon(ctx, it.kind, r.x + 34 * s, y + rh / 2 - 2 * s, 24 * s, it.locked ? COLORS.dim : sel ? '#fff' : col);
    drawText(ctx, it.name, r.x + 54 * s, y + rh / 2 - 2 * s, { size: 15 * s, color: sel ? '#fff' : COLORS.text, weight: sel ? 700 : 500 });
    if (it.locked) drawIcon(ctx, 'lock', r.x + r.w - 26 * s, y + rh / 2 - 2 * s, 18 * s, COLORS.lock);
    else {
      drawText(ctx, String(it.cost), r.x + r.w - 40 * s, y + rh / 2 - 2 * s, { size: 15 * s, color: COLORS.thorium, align: 'right', weight: 700 });
      drawIcon(ctx, 'thorium', r.x + r.w - 26 * s, y + rh / 2 - 2 * s, 16 * s, COLORS.thorium);
    }
    ctx.restore();
  });
  if (first > 0) drawText(ctx, '▲', r.x + r.w / 2, r.y + 38 * s, { size: 10 * s, color: COLORS.dim, align: 'center' });
  if (first + MAX_ROWS < items.length) drawText(ctx, '▼', r.x + r.w / 2, r.y + r.h - 6 * s, { size: 10 * s, color: COLORS.dim, align: 'center' });
  const cur = items[index];
  if (cur && (cur.lockReason || !cur.affordable)) {
    const msg = cur.lockReason ?? `Need ${cur.shortBy} more thorium`;
    drawText(ctx, msg, r.x + r.w / 2, r.y + r.h + 18 * s, { size: 13 * s, color: cur.lockReason ? COLORS.lock : COLORS.danger, align: 'center', weight: 600 });
  }
}

/** Menu closed, empty cursor tile: small "build here" hint showing the last picked item (A / Cross quick-builds it). */
export function drawQuickBuildHint(ctx: Ctx, at: { x: number; y: number }, item: BuildItem, player: number, s: number): void {
  const col = item.locked ? COLORS.dim : playerColor(player);
  ctx.save();
  ctx.globalAlpha = item.locked ? 0.45 : item.affordable ? 0.8 : 0.5;
  drawIcon(ctx, item.kind, at.x + 10 * s, at.y, 16 * s, col);
  drawText(ctx, item.name, at.x + 22 * s, at.y, { size: 12 * s, color: COLORS.text, weight: 600 });
  ctx.restore();
}
