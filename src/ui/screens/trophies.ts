import { TROPHIES } from '../../meta/trophies';
import { COLORS, drawText, rgba } from '../theme';
import { clamp } from '../format';
import { drawIcon } from '../widgets/icon';
import { drawPanel } from '../widgets/panel';
import { drawFooter, drawHeader } from './common';
import type { Screen } from './types';

const VISIBLE = 7;

export function createTrophiesScreen(): Screen {
  let index = 0;
  return {
    id: 'trophies',
    update(nav) {
      if (nav.back) return { t: 'pop' };
      if (nav.up) index = clamp(index - 1, 0, TROPHIES.length - 1);
      if (nav.down) index = clamp(index + 1, 0, TROPHIES.length - 1);
      return null;
    },
    draw(g, size, now, ctx) {
      const unlocked = new Set(ctx.data.save.trophies.unlocked);
      drawHeader(g, size.w, 'Trophies', `${unlocked.size} of ${TROPHIES.length} unlocked`);
      const first = clamp(index - Math.floor(VISIBLE / 2), 0, Math.max(0, TROPHIES.length - VISIBLE));
      const rh = 92, w = Math.min(size.w - 200, 1100);
      TROPHIES.slice(first, first + VISIBLE).forEach((t, i) => {
        const got = unlocked.has(t.id);
        const sel = first + i === index;
        const r = { x: (size.w - w) / 2, y: 186 + i * (rh + 8), w, h: rh };
        drawPanel(g, r, { chamfer: 14, edge: sel ? COLORS.cyan : got ? '#6a5a1a' : COLORS.panelEdge, glow: sel ? rgba(COLORS.cyan, 0.35 + 0.1 * Math.sin(now * 5)) : undefined, alpha: 0.88 });
        drawIcon(g, got ? 'trophy' : 'lock', r.x + 56, r.y + rh / 2, 46, got ? COLORS.thorium : '#555b6b');
        drawText(g, t.name, r.x + 112, r.y + rh * 0.36, { size: 26, color: got ? '#fff' : COLORS.dim, weight: 700 });
        drawText(g, t.description, r.x + 112, r.y + rh * 0.68, { size: 18, color: got ? COLORS.text : '#667', weight: 500 });
        if (got) drawText(g, 'UNLOCKED', r.x + r.w - 28, r.y + rh / 2, { size: 15, color: COLORS.ok, align: 'right', spacing: 3, weight: 700 });
      });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Scroll' }, { key: 'back', label: 'Back' }]);
    },
  };
}
