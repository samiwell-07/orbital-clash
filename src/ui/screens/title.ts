import { COLORS, drawText } from '../theme';
import { Form, buttonRows } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { drawFooter } from './common';
import { createBattleScreen } from './battle';
import { createCampaignScreen } from './campaign';
import { createControlsScreen } from './controls';
import { createLeaderboardsScreen } from './leaderboards';
import { drawLogo } from './logo';
import { createSettingsScreen } from './settings';
import { createTrophiesScreen } from './trophies';
import type { Screen } from './types';

const ITEMS = [
  { id: 'campaign', label: 'Campaign', icon: 'comet' },
  { id: 'battle', label: 'Battle', icon: 'sword' },
  { id: 'settings', label: 'Settings', icon: 'cross' },
  { id: 'controls', label: 'Controls', icon: 'target' },
  { id: 'leaderboards', label: 'Leaderboards', icon: 'star' },
  { id: 'trophies', label: 'Trophies', icon: 'trophy' },
  { id: 'quit', label: 'Quit', icon: 'arrow' },
];

export function createTitleScreen(): Screen {
  const form = new Form(buttonRows(ITEMS));
  return {
    id: 'title',
    update(nav, dt) {
      const ev = form.handle(nav, dt);
      switch (ev.activated) {
        case 'campaign': return { t: 'push', screen: createCampaignScreen() };
        case 'battle': return { t: 'push', screen: createBattleScreen() };
        case 'settings': return { t: 'push', screen: createSettingsScreen() };
        case 'controls': return { t: 'push', screen: createControlsScreen() };
        case 'leaderboards': return { t: 'push', screen: createLeaderboardsScreen() };
        case 'trophies': return { t: 'push', screen: createTrophiesScreen() };
        case 'quit': return { t: 'quit' };
        default: return null;
      }
    },
    draw(g, size, now, ctx) {
      drawLogo(g, size.w / 2, size.h * 0.24, size.w / 1920 * 1.05, now);
      const bw = 400;
      drawForm(g, form, { x: (size.w - bw) / 2, y: size.h * 0.5, w: bw, h: size.h * 0.46 }, now, { rowH: 50, gap: 9 });
      drawText(g, 'v1.0  ·  an original homage to the PS3 classic', size.w / 2, size.h - 92, { size: 14, color: COLORS.dim, align: 'center' });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'confirm', label: 'Confirm' }]);
    },
  };
}
