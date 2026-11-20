import { COMET_ORDER, EXPANSION_ORDER, AREAS_PER_COMET } from '../../meta/saveSchema';
import type { CometId, Difficulty } from '../../types';
import { getArea, isAreaUnlocked, isCometUnlocked } from '../../meta/save';
import { researchDef } from '../../data';
import { COLORS, drawText, rgba } from '../theme';
import { formatTime, humanize } from '../format';
import { drawPanel } from '../widgets/panel';
import { drawMapPreview } from '../widgets/mapPreview';
import { createBriefingScreen } from './briefing';
import { drawFooter, drawHeader } from './common';
import { drawComet, drawNode, COMET_COLORS } from './campaignDraw';
import { findArea, moveCursor, nodeAt, placeholderArea, resurgenceIndices, rowLengths, areaNumber, type MapCursor } from './campaignNav';
import type { OnlineOption } from './battle';
import type { Screen } from './types';

export interface CampaignOptions extends OnlineOption {
  expansion?: boolean;
  difficulty?: Difficulty;
  players?: number;
}

export function createCampaignScreen(opts: CampaignOptions = {}): Screen {
  const order: readonly CometId[] = opts.expansion ? EXPANSION_ORDER : COMET_ORDER;
  let cursor: MapCursor = { row: 0, col: 0 };
  let started = false;
  return {
    id: opts.expansion ? 'campaign-expansion' : 'campaign',
    update(nav, _dt, ctx) {
      const { save, areas } = ctx.data;
      if (!started) {
        started = true;
        const lp = save.lastPlayed;
        if (lp && order.includes(lp.cometId)) cursor = { row: order.indexOf(lp.cometId), col: lp.resurgence ? AREAS_PER_COMET : lp.index };
      }
      if (nav.back) return { t: 'pop' };
      cursor = moveCursor(cursor, (nav.right ? 1 : 0) - (nav.left ? 1 : 0), (nav.down ? 1 : 0) - (nav.up ? 1 : 0), rowLengths(areas, order));
      if (nav.confirm) {
        const n = nodeAt(cursor, areas, order);
        if (ctx.data.unlockMaps || isAreaUnlocked(save, n.cometId, n.index, n.resurgence)) {
          return { t: 'push', screen: createBriefingScreen(findArea(areas, n) ?? placeholderArea(n), opts) };
        }
      }
      return null;
    },
    draw(g, size, now, ctx) {
      const { save, areas } = ctx.data;
      drawHeader(g, size.w, opts.expansion ? 'Campaign · Expansion' : opts.online ? 'Online Co-op' : 'Campaign', opts.expansion ? 'Gaia and Kronos · Areas 29–42 and two Resurgence missions' : opts.online ? 'Pick an area, then open the lobby: friends join with its room code' : 'Take control of four comets');
      const rowH = 150, top = 190, x0 = 295, previewSide = 320;
      order.forEach((id, row) => {
        const cy = top + (row + 0.5) * (opts.expansion ? 240 : rowH);
        const open = ctx.data.unlockMaps || isCometUnlocked(save, id);
        const colors = COMET_COLORS[id];
        drawComet(g, id, 150, cy - 8, 44, !open, now);
        drawText(g, humanize(id), 150, cy + 58, { size: 22, color: open ? '#fff' : COLORS.dim, align: 'center', spacing: 4, weight: 700 });
        const total = AREAS_PER_COMET + resurgenceIndices(areas, id).length;
        const step = (size.w - x0 - previewSide - 155) / (total - 0.4);
        g.strokeStyle = rgba(colors.glow, 0.3);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x0, cy);
        g.lineTo(x0 + step * (total - 1) + 24, cy);
        g.stroke();
        for (let col = 0; col < total; col++) {
          const n = nodeAt({ row, col }, areas, order);
          const x = x0 + col * step + (n.resurgence ? 24 : 0);
          const selected = cursor.row === row && cursor.col === col;
          const locked = !ctx.data.unlockMaps && !isAreaUnlocked(save, id, n.index, n.resurgence);
          const rec = getArea(save, id, n.index, n.resurgence);
          const rows = opts.expansion ? findArea(areas, n)?.rows : undefined;
          if (rows?.length) {
            const side = Math.min(115, step - 10);
            drawMapPreview(g, x - side / 2, cy - side / 2, side, rows, id);
            if (selected) {
              g.strokeStyle = COLORS.cyan;
              g.lineWidth = 5;
              g.strokeRect(x - side / 2 - 3, cy - side / 2 - 3, side + 6, side + 6);
            }
            drawText(g, n.resurgence ? 'R' : String(areaNumber(n)), x, cy + side / 2 + 25,
              { size: 22, color: selected ? COLORS.cyan : '#fff', align: 'center', weight: 700 });
            continue;
          }
          drawNode(g, {
            x, y: cy, label: n.resurgence ? 'R' : String(areaNumber(n)),
            locked, rank: rec?.bestRank ?? null, selected, resurgence: n.resurgence, accent: colors.glow,
          }, now);
        }
      });
      const n = nodeAt(cursor, areas, order);
      const area = findArea(areas, n) ?? placeholderArea(n);
      if (area.rows?.length) {
        const x = size.w - previewSide - 70;
        drawText(g, 'MAP PREVIEW', x, top + 76, { size: 20, color: COLORS.cyan, spacing: 3, weight: 700 });
        drawMapPreview(g, x, top + 105, previewSide, area.rows, area.cometId);
      }
      const rec = getArea(save, n.cometId, n.index, n.resurgence);
      const locked = !ctx.data.unlockMaps && !isAreaUnlocked(save, n.cometId, n.index, n.resurgence);
      const r = { x: 70, y: top + 4 * rowH + 12, w: size.w - 140, h: 128 };
      drawPanel(g, r, { chamfer: 14, alpha: 0.9, edge: COMET_COLORS[n.cometId].glow });
      drawText(g, n.resurgence ? 'RESURGENCE' : `AREA ${areaNumber(n)}`, r.x + 30, r.y + 34, { size: 15, color: COLORS.cyan, spacing: 4, weight: 700 });
      drawText(g, area.name, r.x + 30, r.y + 74, { size: 34, color: '#fff', weight: 700 });
      const teach = area.teaches ? `Teaches: ${researchDef(area.teaches)?.name ?? humanize(area.teaches)}` : n.resurgence ? 'No hints — harder' : '';
      drawText(g, locked ? 'Locked — complete the previous area' : teach, r.x + 30, r.y + 106, { size: 18, color: locked ? COLORS.lock : COLORS.units, weight: 500 });
      if (rec) {
        drawText(g, `BEST  ${formatTime(rec.bestTimeSec)}   RANK ${rec.bestRank}   SCORE ${rec.bestScore}`, r.x + r.w - 30, r.y + 52, { size: 22, color: COLORS.thorium, align: 'right', weight: 700 });
        drawText(g, `Completed ${rec.completions}×`, r.x + r.w - 30, r.y + 90, { size: 16, color: COLORS.dim, align: 'right' });
      }
      drawFooter(g, size.h, save.settings.controlsDisplay, [{ key: 'move', label: 'Choose area' }, { key: 'confirm', label: 'Briefing' }, { key: 'back', label: 'Back' }]);
    },
  };
}
