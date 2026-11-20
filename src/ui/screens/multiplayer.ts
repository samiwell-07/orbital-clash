import { COLORS, drawText, wrapText } from '../theme';
import { Form, buttonRows } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { createBattleScreen } from './battle';
import { createCampaignPacks } from './campaignPacks';
import { drawFooter, drawHeader } from './common';
import { createJoinOnlineScreen, NEEDS_DEV_SERVER } from './joinOnline';
import type { Screen, ScreenCtx } from './types';

const ITEMS = [
  { id: 'createBattle', label: 'Create Battle Lobby', icon: 'sword', blurb: 'Host a battle: set up the map and players, then share the room code.' },
  { id: 'createCoop', label: 'Create Co-op Lobby', icon: 'comet', blurb: 'Host a campaign area and play it together in co-op.' },
  { id: 'join', label: 'Join Lobby', icon: 'target', blurb: "Enter the 4-digit room code shown in your friend's lobby." },
  { id: 'back', label: 'Back', icon: undefined, blurb: '' },
] as const;

/** Online play hub: host a Battle or Co-op lobby (opened online right away), or join one by its room code. */
export function createMultiplayerScreen(): Screen {
  let form: Form | null = null;
  let online = false;
  const sync = (ctx: ScreenCtx): Form => {
    const has = !!ctx.net;
    if (!form || has !== online) {
      online = has;
      const rows = buttonRows(ITEMS.map(({ id, label, icon }) => ({ id, label, icon, enabled: id === 'back' || has })));
      if (form) form.setRows(rows);
      else form = new Form(rows);
    }
    return form;
  };
  return {
    id: 'multiplayer',
    update(nav, dt, ctx) {
      const ev = sync(ctx).handle(nav, dt);
      if (ev.back || ev.activated === 'back') return { t: 'pop' };
      switch (ev.activated) {
        case 'createBattle': return { t: 'push', screen: createBattleScreen({ online: true }) };
        case 'createCoop': return { t: 'push', screen: createCampaignPacks({ online: true }) };
        case 'join': return { t: 'push', screen: createJoinOnlineScreen() };
        default: return null;
      }
    },
    draw(g, size, now, ctx) {
      const f = sync(ctx);
      drawHeader(g, size.w, 'Multiplayer', 'Play online with friends on the same network');
      const bw = 520;
      const x = (size.w - bw) / 2;
      const y = size.h * 0.3;
      drawForm(g, f, { x, y, w: bw, h: 4 * 70 }, now, { rowH: 58, gap: 12 });
      const ty = y + 4 * 70 + 50;
      if (!ctx.net) {
        drawText(g, NEEDS_DEV_SERVER, size.w / 2, ty, { size: 24, color: COLORS.thorium, align: 'center', weight: 700 });
      } else {
        const blurb = ITEMS.find((i) => i.id === f.current?.id)?.blurb ?? '';
        for (const [i, l] of wrapText(g, blurb, bw + 300, 20).entries()) drawText(g, l, size.w / 2, ty + i * 30, { size: 20, color: COLORS.text, align: 'center', weight: 500 });
        drawText(g, 'Friends open the address shown in your lobby, then choose Multiplayer → Join Lobby', size.w / 2, ty + 74, { size: 17, color: COLORS.dim, align: 'center', weight: 500 });
      }
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'confirm', label: 'Confirm' }, { key: 'back', label: 'Back' }]);
    },
  };
}
