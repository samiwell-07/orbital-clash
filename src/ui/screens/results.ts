import { COLORS, drawText, glowText } from '../theme';
import { Form, buttonRows } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { drawPanel } from '../widgets/panel';
import { drawIcon } from '../widgets/icon';
import { drawFooter } from './common';
import { NameEntry } from './nameEntry';
import { drawNameEntry, drawStats, resultColor } from './resultsDraw';
import type { ResultsProps, Screen } from './types';

/** Area Complete / Victory / Defeat. Optionally asks for a leaderboard name first, then offers next/retry/quit. */
export function createResultsScreen(p: ResultsProps): Screen {
  const entry = p.qualifies && p.boardKey && p.score !== undefined ? new NameEntry() : null;
  let naming = entry !== null;
  const menu = new Form(buttonRows([
    ...(p.hasNext && p.won ? [{ id: 'next', label: 'Next Area', icon: 'arrow' }] : []),
    { id: 'retry', label: p.mode === 'battle' ? 'Rematch' : 'Retry' },
    { id: 'quit', label: 'Back to Title' },
  ]));
  let t0 = -1;
  return {
    id: 'results',
    update(nav, dt) {
      if (naming && entry) {
        if (nav.back) { naming = false; return null; }
        const name = entry.handle(nav);
        if (name && p.boardKey) {
          naming = false;
          return { t: 'submitScore', boardKey: p.boardKey, name, score: p.score ?? 0, timeSec: p.timeSec };
        }
        return null;
      }
      const ev = menu.handle({ ...nav, back: false }, dt);
      switch (ev.activated) {
        case 'next': return { t: 'nextArea' };
        case 'retry': return { t: 'restart' };
        case 'quit': return { t: 'quitToTitle' };
        default: return null;
      }
    },
    draw(g, size, now, ctx) {
      if (t0 < 0) t0 = now;
      const col = resultColor(p);
      glowText(g, p.title.toUpperCase(), size.w / 2, 110, { size: 64, color: '#fff', glow: col, align: 'center', spacing: 12, weight: 800 });
      drawStats(g, { x: size.w / 2 - 480, y: 190, w: 960, h: 380 }, p, now);
      if (naming && entry) drawNameEntry(g, { x: size.w / 2 - 480, y: 610, w: 960, h: 170 }, entry, now);
      else drawForm(g, menu, { x: size.w / 2 - 210, y: 620, w: 420, h: 300 }, now, { rowH: 56, gap: 12 });
      const toast = p.trophyNames ?? [];
      toast.forEach((name, i) => {
        const slide = Math.min(1, Math.max(0, (now - t0 - 0.4 - i * 0.3) / 0.35));
        const w = 430, x = size.w - 40 - w * (1 - Math.pow(1 - slide, 3));
        const y = 190 + i * 88;
        drawPanel(g, { x, y, w, h: 76 }, { chamfer: 12, edge: COLORS.thorium, glow: COLORS.thorium, alpha: 0.95 });
        drawIcon(g, 'trophy', x + 44, y + 38, 40, COLORS.thorium);
        drawText(g, 'TROPHY UNLOCKED', x + 84, y + 26, { size: 13, color: COLORS.thorium, spacing: 3, weight: 700 });
        drawText(g, name, x + 84, y + 52, { size: 22, color: '#fff', weight: 700 });
      });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, naming
        ? [{ key: 'move', label: 'Letter / Slot' }, { key: 'confirm', label: 'Next' }, { key: 'back', label: 'Skip' }]
        : [{ key: 'move', label: 'Select' }, { key: 'confirm', label: 'Confirm' }]);
    },
  };
}
