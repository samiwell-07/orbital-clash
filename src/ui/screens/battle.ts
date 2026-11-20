import { Form } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { drawFooter, drawHeader } from './common';
import { drawMapCard, drawSlotSummary } from './battleDraw';
import { battleRows, clampValues, readValues, toConfig, valuesFromSetup, type BattleValues } from './battleForm';
import { createLobbyScreen } from './lobby';
import type { Screen, ScreenCtx } from './types';

export interface OnlineOption {
  /** Reached from Multiplayer → Create Lobby: the lobby opens the online room straight away. */
  online?: boolean;
}

export function createBattleScreen(opts: OnlineOption = {}): Screen {
  let values: BattleValues | null = null;
  let form: Form | null = null;
  const init = (ctx: ScreenCtx): void => {
    const { maps, save } = ctx.data;
    values = valuesFromSetup(save.settings.lastBattle, maps);
    // Online, leave a seat for at least one friend by default.
    if (opts.online) values = clampValues({ ...values, humans: Math.max(2, values.humans) }, maps);
    form = new Form(battleRows(values, maps));
  };
  return {
    id: 'battle',
    update(nav, dt, ctx) {
      if (!form || !values) init(ctx);
      const f = form as Form;
      const maps = ctx.data.maps;
      const ev = f.handle(nav, dt);
      if (ev.back || ev.activated === 'back') return { t: 'pop' };
      if (ev.activated === 'start') {
        const setup = toConfig(values as BattleValues, maps);
        const humans = setup.slots.filter((s) => s.human).length;
        // CPU slots keep their default colour (= player id), so humans can't pick those.
        const cpuColors = setup.slots.flatMap((s, i) => (s.human ? [] : [i]));
        const lobby = createLobbyScreen({
          title: opts.online ? 'Online Battle' : 'Battle',
          subtitle: `${humans} human player${humans === 1 ? '' : 's'} · ${setup.slots.length - humans} CPU`,
          rules: { minPlayers: humans, maxPlayers: humans, takenColors: cpuColors },
          onStart: (seats) => ({ t: 'startBattle', setup, seats }),
          autoHost: opts.online,
        });
        return { t: 'push', screen: lobby };
      }
      if (ev.changed) {
        values = readValues(f, values as BattleValues, maps);
        f.setRows(battleRows(values, maps));
      }
      return null;
    },
    draw(g, size, now, ctx) {
      if (!form || !values) init(ctx);
      const f = form as Form;
      const maps = ctx.data.maps;
      drawHeader(g, size.w, opts.online ? 'Online Battle' : 'Battle', opts.online ? 'Set up the match, then open the lobby: friends join with its room code' : 'Build a base, out-produce your rivals, smash theirs');
      const fw = Math.min(700, size.w * 0.5);
      drawForm(g, f, { x: 70, y: 180, w: fw, h: size.h - 290 }, now, { rowH: 50, gap: 8 });
      const rx = 70 + fw + 50, rw = size.w - rx - 70;
      drawMapCard(g, { x: rx, y: 180, w: rw, h: 420 }, maps[(values as BattleValues).map], now);
      drawSlotSummary(g, { x: rx, y: 620, w: rw, h: 220 }, toConfig(values as BattleValues, maps));
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'adjust', label: 'Change' }, { key: 'back', label: 'Back' }]);
    },
  };
}
