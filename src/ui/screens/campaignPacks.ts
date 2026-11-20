import { Form, buttonRows } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { COLORS, drawText } from '../theme';
import { createCampaignScreen } from './campaign';
import { drawFooter, drawHeader } from './common';
import type { Screen } from './types';

export function createCampaignPacks(): Screen {
  const form = new Form(buttonRows([
    { id: 'original', label: 'Original', icon: 'comet' },
    { id: 'expansion', label: 'Expansion', icon: 'comet' },
  ]));
  return {
    id: 'campaign-packs',
    update(nav, dt) {
      const ev = form.handle(nav, dt);
      if (ev.back) return { t: 'pop' };
      if (ev.activated === 'original') return { t: 'push', screen: createCampaignScreen() };
      if (ev.activated === 'expansion') return { t: 'push', screen: createCampaignScreen({ expansion: true }) };
      return null;
    },
    draw(g, size, now, ctx) {
      drawHeader(g, size.w, 'Campaign', 'Choose a campaign');
      drawForm(g, form, { x: (size.w - 580) / 2, y: 370, w: 580, h: 220 }, now, { rowH: 74, gap: 18 });
      const info = form.current?.id === 'expansion' ? 'Gaia and Kronos · 14 areas and 2 Resurgence missions' : 'Kreios, Hathor, Aether and Helios';
      drawText(g, info, size.w / 2, 620, { size: 25, align: 'center', color: COLORS.text });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'confirm', label: 'Open' }, { key: 'back', label: 'Back' }]);
    },
  };
}
