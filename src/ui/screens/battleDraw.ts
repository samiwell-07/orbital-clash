import { COLORS, drawText, paletteCss, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawIcon } from '../widgets/icon';
import { drawPanel } from '../widgets/panel';
import { drawPlayerGlyph } from '../widgets/glyph';
import { drawMapPreview } from '../widgets/mapPreview';
import { TEAM_NAMES } from './battleForm';
import type { BattleConfig, BattleMapSummary } from './types';

/** Mini terrain preview ('#' cliff, 'o' crater), thorium symbols and name. */
export function drawMapCard(ctx: Ctx, r: Rect, map: BattleMapSummary | undefined, now: number): void {
  drawPanel(ctx, r, { chamfer: 14, alpha: 0.9 });
  if (!map) return drawText(ctx, 'No maps available', r.x + r.w / 2, r.y + r.h / 2, { size: 20, color: COLORS.dim, align: 'center' });
  const side = Math.min(r.w - 48, r.h - 130);
  if (map.rows?.length) drawMapPreview(ctx, r.x + (r.w - side) / 2, r.y + 24, side, map.rows, map.palette);
  drawText(ctx, map.name, r.x + 24, r.y + r.h - 82, { size: 28, color: '#fff', weight: 700 });
  drawText(ctx, `Up to ${map.maxPlayers} players`, r.x + 24, r.y + r.h - 46, { size: 16, color: COLORS.dim });
  drawText(ctx, 'THORIUM', r.x + r.w - 190, r.y + r.h - 82, { size: 13, color: COLORS.dim, spacing: 3, weight: 700 });
  for (let i = 0; i < 3; i++) {
    const on = i < map.thoriumLevel;
    ctx.globalAlpha = on ? 1 : 0.22;
    drawIcon(ctx, 'thorium', r.x + r.w - 168 + i * 44, r.y + r.h - 48 + Math.sin(now * 3 + i) * (on ? 1.5 : 0), 34, COLORS.thorium);
    ctx.globalAlpha = 1;
  }
}

/** Slot summary: glyph per slot grouped by team name, so allies are obvious. */
export function drawSlotSummary(ctx: Ctx, r: Rect, cfg: BattleConfig): void {
  drawPanel(ctx, r, { chamfer: 14, alpha: 0.9 });
  const n = cfg.slots.length;
  const w = Math.min(120, (r.w - 40) / n);
  cfg.slots.forEach((s, i) => {
    const x = r.x + 20 + i * w;
    drawPlayerGlyph(ctx, { x, y: r.y + 18, w: w - 14, h: w - 14 }, i, { enemy: !s.human, team: s.team });
    drawText(ctx, TEAM_NAMES[s.team] ?? `Team ${s.team + 1}`, x + (w - 14) / 2, r.y + w + 14, { size: 14, color: paletteCss(s.team), align: 'center', weight: 700 });
    drawText(ctx, `${Math.round(s.strength * 100)}%`, x + (w - 14) / 2, r.y + w + 36, { size: 14, color: COLORS.dim, align: 'center' });
  });
}
