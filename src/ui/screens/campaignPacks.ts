import { MAX_COOP_PLAYERS } from '../../config/constants';
import { Form } from '../menus/form';
import { COLORS, drawText, glowText } from '../theme';
import { drawButton } from '../widgets/button';
import { createCampaignScreen } from './campaign';
import { drawFooter, drawHeader } from './common';
import { difficultyBlurb } from './briefing';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from './settings';
import type { OnlineOption } from './battle';
import type { Screen, ScreenCtx } from './types';

export function createCampaignPacks(opts: OnlineOption = {}): Screen {
  let form: Form | null = null;
  const setup = (ctx: ScreenCtx): Form => form ??= new Form([
    { k: 'choice', id: 'campaign', label: 'Campaign', options: ['Original', 'Expansion'], index: 0 },
    { k: 'choice', id: 'players', label: 'Number of Players', options: Array.from({ length: MAX_COOP_PLAYERS }, (_, i) => String(i + 1)), index: 0 },
    { k: 'choice', id: 'difficulty', label: 'Difficulty', options: DIFFICULTY_LABELS, index: DIFFICULTY_ORDER.indexOf(ctx.data.save.settings.defaultDifficulty) },
    { k: 'button', id: 'continue', label: 'Continue', icon: 'arrow' },
  ]);
  return {
    id: 'campaign-packs',
    update(nav, dt, ctx) {
      const f = setup(ctx);
      const ev = f.handle(nav, dt);
      if (ev.back) return { t: 'pop' };
      if (ev.activated === 'continue') return { t: 'push', screen: createCampaignScreen({
        ...opts, expansion: f.value('campaign') === 1,
        players: f.value('players') + 1, difficulty: DIFFICULTY_ORDER[f.value('difficulty')],
      }) };
      return null;
    },
    draw(g, size, now, ctx) {
      const f = setup(ctx);
      drawHeader(g, size.w, opts.online ? 'Online Campaign' : 'Campaign', 'Choose your campaign, players and difficulty');
      f.rows.forEach((row, i) => {
        const y = 270 + i * 145;
        const focused = f.index === i;
        if (row.k === 'choice') {
          drawText(g, row.label, size.w / 2, y, { size: 32, color: focused ? '#fff' : COLORS.text, align: 'center', weight: 700 });
          const step = row.id === 'difficulty' ? 230 : 190;
          row.options.forEach((label, index) => {
            const x = size.w / 2 + (index - (row.options.length - 1) / 2) * step;
            const selected = row.index === index;
            const text = { size: selected ? 28 : 23, color: selected ? COLORS.cyan : COLORS.dim, align: 'center' as const, weight: selected ? 800 : 600 };
            if (selected) glowText(g, label, x, y + 56, { ...text, glow: COLORS.cyan });
            else drawText(g, label, x, y + 56, text);
            if (focused && selected) drawText(g, '<', x - step / 2 + 12, y + 56, { size: 24, color: COLORS.cyan, align: 'center' });
          });
        } else if (row.k === 'button') {
          drawButton(g, { x: (size.w - 330) / 2, y: y - 10, w: 330, h: 64 }, row.label, { selected: focused, nowSec: now });
        }
      });
      const info = f.value('campaign') === 1 ? 'Gaia and Kronos · 14 areas and 2 Resurgence missions' : 'Kreios, Hathor, Aether and Helios';
      drawText(g, info, size.w / 2, 825, { size: 23, align: 'center', color: COLORS.text });
      drawText(g, difficultyBlurb(f.value('difficulty')), size.w / 2, 870, { size: 19, align: 'center', color: COLORS.dim });
      drawText(g, 'These settings apply to every mission in this campaign run.', size.w / 2, 910, { size: 19, align: 'center', color: COLORS.dim });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'adjust', label: 'Change' }, { key: 'confirm', label: 'Confirm' }, { key: 'back', label: 'Back' }]);
    },
  };
}
