import type { CometId, Difficulty } from '../../types';
import { boardKey, getBoard, LEADERBOARD_SIZE } from '../../meta/leaderboard';
import { COMET_ORDER, EXPANSION_ORDER, AREAS_PER_COMET } from '../../meta/saveSchema';
import { COLORS, drawText, rgba } from '../theme';
import { formatTime, humanize } from '../format';
import { Form, type Row } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { drawPanel } from '../widgets/panel';
import { drawFooter, drawHeader } from './common';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from './settings';
import type { Screen } from './types';

const AREA_OPTIONS = [...Array.from({ length: AREAS_PER_COMET }, (_, i) => `Area ${i + 1}`), 'Resurgence'];
const COMETS = [...COMET_ORDER, ...EXPANSION_ORDER];

export function leaderboardKeyFor(comet: number, area: number, diff: number): string {
  const id = COMETS[comet] as CometId;
  const resurgence = area >= AREAS_PER_COMET;
  return boardKey(id, resurgence ? 0 : area, DIFFICULTY_ORDER[diff] as Difficulty, resurgence);
}

const rows = (): Row[] => [
  { k: 'choice', id: 'comet', label: 'Comet', options: COMETS.map(humanize), index: 0 },
  { k: 'choice', id: 'area', label: 'Area', options: AREA_OPTIONS, index: 0 },
  { k: 'choice', id: 'diff', label: 'Difficulty', options: DIFFICULTY_LABELS, index: 2 },
];

export function createLeaderboardsScreen(): Screen {
  const form = new Form(rows());
  return {
    id: 'leaderboards',
    update(nav, dt) {
      const ev = form.handle(nav, dt);
      return ev.back ? { t: 'pop' } : null;
    },
    draw(g, size, now, ctx) {
      drawHeader(g, size.w, 'Leaderboards', 'Top 10 per area and difficulty — only Normal is ranked');
      drawForm(g, form, { x: 70, y: 190, w: 520, h: 360 }, now, { rowH: 56, gap: 10 });
      const board = getBoard(ctx.data.save.leaderboards, leaderboardKeyFor(form.value('comet'), form.value('area'), form.value('diff')));
      const r = { x: 640, y: 190, w: size.w - 710, h: size.h - 330 };
      drawPanel(g, r, { chamfer: 14, alpha: 0.9 });
      drawText(g, 'RANK   PILOT', r.x + 30, r.y + 34, { size: 15, color: COLORS.dim, spacing: 3, weight: 700 });
      drawText(g, 'TIME', r.x + r.w - 220, r.y + 34, { size: 15, color: COLORS.dim, spacing: 3, weight: 700, align: 'right' });
      drawText(g, 'SCORE', r.x + r.w - 30, r.y + 34, { size: 15, color: COLORS.dim, spacing: 3, weight: 700, align: 'right' });
      const rh = (r.h - 70) / LEADERBOARD_SIZE;
      for (let i = 0; i < LEADERBOARD_SIZE; i++) {
        const e = board[i];
        const y = r.y + 62 + i * rh;
        if (i % 2 === 0) { g.fillStyle = rgba('#ffffff', 0.04); g.fillRect(r.x + 12, y, r.w - 24, rh); }
        const cy = y + rh / 2;
        drawText(g, String(i + 1).padStart(2, '0'), r.x + 30, cy, { size: 22, color: i < 3 ? COLORS.thorium : COLORS.dim, weight: 700 });
        if (!e) { drawText(g, '— — —', r.x + 120, cy, { size: 20, color: '#444b58' }); continue; }
        g.fillStyle = 'rgba(56,232,255,0.15)';
        g.beginPath(); g.roundRect(r.x + 90, cy - 13, 44, 26, 6); g.fill();
        drawText(g, e.flag, r.x + 112, cy, { size: 14, color: COLORS.cyan, align: 'center', weight: 700 });
        drawText(g, e.name, r.x + 154, cy, { size: 22, color: '#fff', weight: 600 });
        drawText(g, formatTime(e.timeSec), r.x + r.w - 220, cy, { size: 20, color: COLORS.text, align: 'right' });
        drawText(g, String(e.score), r.x + r.w - 30, cy, { size: 22, color: COLORS.thorium, align: 'right', weight: 700 });
      }
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'adjust', label: 'Change' }, { key: 'back', label: 'Back' }]);
    },
  };
}
