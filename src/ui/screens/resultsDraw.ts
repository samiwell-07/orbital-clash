import { NAME_MAX } from '../../meta/leaderboard';
import { COLORS, drawText, glowText, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { formatTimeTenths } from '../format';
import { drawPanel } from '../widgets/panel';
import type { NameEntry } from './nameEntry';
import type { ResultsProps } from './types';

export const RANK_COLORS: Record<string, string> = { S: '#ffd23c', A: '#66ff9a', B: '#38e8ff', C: '#e9ecef', D: '#9aa0aa' };

export function drawStats(g: Ctx, r: Rect, p: ResultsProps, now: number): void {
  drawPanel(g, r, { chamfer: 16, alpha: 0.9, edge: p.won ? COLORS.cyan : COLORS.danger });
  if (p.rank) {
    const col = RANK_COLORS[p.rank] ?? '#fff';
    glowText(g, p.rank, r.x + 150, r.y + r.h * 0.42, { size: 190 + 6 * Math.sin(now * 3), color: col, glow: col, align: 'center', weight: 900 });
    drawText(g, 'RANK', r.x + 150, r.y + 54, { size: 18, color: COLORS.dim, align: 'center', spacing: 6, weight: 700 });
  }
  const lines: [string, string, string?][] = [['TIME', formatTimeTenths(p.timeSec)]];
  if (p.penaltySec > 0) lines.push(['PENALTIES', `+${Math.round(p.penaltySec)}s`, COLORS.danger]);
  if (p.parTimeSec !== undefined) lines.push(['PAR TIME', formatTimeTenths(p.parTimeSec)]);
  if (p.score !== undefined) lines.push(['SCORE', String(p.score), COLORS.thorium]);
  if (p.difficulty) lines.push(['DIFFICULTY', p.difficulty.toUpperCase()]);
  const x = r.x + (p.rank ? 330 : 60);
  lines.forEach(([k, v, c], i) => {
    const y = r.y + 70 + i * 60;
    drawText(g, k, x, y, { size: 17, color: COLORS.dim, spacing: 4, weight: 700 });
    drawText(g, v, r.x + r.w - 50, y, { size: 32, color: c ?? '#fff', align: 'right', weight: 700 });
    g.fillStyle = rgba('#ffffff', 0.08);
    g.fillRect(x, y + 28, r.x + r.w - 50 - x, 1);
  });
  if (p.newBestTime) glowText(g, 'NEW BEST TIME', r.x + 150, r.y + r.h - 34, { size: 17, color: COLORS.ok, glow: COLORS.ok, align: 'center', spacing: 3, weight: 700 });
}

export function drawNameEntry(g: Ctx, r: Rect, e: NameEntry, now: number): void {
  drawPanel(g, r, { chamfer: 14, alpha: 0.92, edge: COLORS.thorium });
  drawText(g, 'NEW HIGH SCORE — ENTER YOUR NAME', r.x + r.w / 2, r.y + 36, { size: 18, color: COLORS.thorium, align: 'center', spacing: 4, weight: 700 });
  const cw = 56, total = NAME_MAX * cw + 100;
  const x0 = r.x + (r.w - total) / 2;
  for (let i = 0; i < NAME_MAX; i++) {
    const sel = e.pos === i;
    const cx = x0 + i * cw;
    drawPanel(g, { x: cx, y: r.y + 62, w: cw - 8, h: 68 }, { chamfer: 8, edge: sel ? COLORS.cyan : COLORS.panelEdge, glow: sel ? COLORS.cyan : undefined, alpha: 0.9 });
    drawText(g, e.chars[i] === ' ' ? '·' : e.chars[i], cx + (cw - 8) / 2, r.y + 98, { size: 40, color: sel ? '#fff' : COLORS.text, align: 'center', weight: 700 });
    if (sel) drawText(g, '▼', cx + (cw - 8) / 2, r.y + 50 - 2 * Math.sin(now * 8), { size: 14, color: COLORS.cyan, align: 'center' });
  }
  const okSel = e.pos === NAME_MAX;
  drawPanel(g, { x: x0 + NAME_MAX * cw + 8, y: r.y + 62, w: 84, h: 68 }, { chamfer: 8, edge: okSel ? COLORS.ok : COLORS.panelEdge, glow: okSel ? COLORS.ok : undefined, alpha: 0.9 });
  drawText(g, 'OK', x0 + NAME_MAX * cw + 50, r.y + 98, { size: 28, color: e.valid ? (okSel ? '#fff' : COLORS.ok) : COLORS.dim, align: 'center', weight: 700 });
}
