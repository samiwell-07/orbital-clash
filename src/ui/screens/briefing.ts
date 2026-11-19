import { DIFFICULTY_MULT, MAX_COOP_PLAYERS } from '../../config/constants';
import { createLobbyScreen } from './lobby';
import { researchDef } from '../../data';
import { getArea } from '../../meta/save';
import { RANKED_DIFFICULTY } from '../../meta/rank';
import { COLORS, drawText, wrapText, rgba } from '../theme';
import { formatTime, humanize, pct } from '../format';
import { Form } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { drawIcon } from '../widgets/icon';
import { drawPanel } from '../widgets/panel';
import { areaNumber } from './campaignNav';
import { drawFooter } from './common';
import { COMET_COLORS } from './campaignDraw';
import { DIFFICULTY_LABELS, DIFFICULTY_ORDER } from './settings';
import type { AreaSummary, Screen, ScreenCtx } from './types';

export function difficultyBlurb(i: number): string {
  const m = DIFFICULTY_MULT[DIFFICULTY_ORDER[i]];
  const penalty = m.penaltyPerHit > 0 ? `+${m.penaltyPerHit}s per hit taken` : 'no time penalties';
  const ranked = DIFFICULTY_ORDER[i] === RANKED_DIFFICULTY ? ' · ranked' : ' · unranked';
  return `Enemy ${pct(m.enemy)} · Thorium ${pct(m.thorium)} · ${penalty}${ranked}`;
}

export function createBriefingScreen(area: AreaSummary): Screen {
  let form: Form | null = null;
  const build = (ctx: ScreenCtx): Form => {
    const save = ctx.data.save;
    const rec = getArea(save, area.cometId, area.index, area.resurgence);
    const d = DIFFICULTY_ORDER.indexOf(rec?.lastDifficulty ?? save.settings.defaultDifficulty);
    return new Form([
      { k: 'choice', id: 'difficulty', label: 'Difficulty', options: DIFFICULTY_LABELS, index: Math.max(0, d) },
      { k: 'button', id: 'start', label: 'Launch Mission', icon: 'arrow' },
      { k: 'button', id: 'back', label: 'Back' },
    ]);
  };
  return {
    id: 'briefing',
    update(nav, dt, ctx) {
      form ??= build(ctx);
      const ev = form.handle(nav, dt);
      if (ev.back || ev.activated === 'back') return { t: 'pop' };
      if (ev.activated === 'start') {
        const difficulty = DIFFICULTY_ORDER[form.value('difficulty')];
        const lobby = createLobbyScreen({
          title: area.name,
          subtitle: `Co-op · up to ${MAX_COOP_PLAYERS} players`,
          // The alien (player 1) keeps red.
          rules: { minPlayers: 1, maxPlayers: MAX_COOP_PLAYERS, takenColors: [1] },
          onStart: (seats) => ({ t: 'startCampaign', cometId: area.cometId, index: area.index, resurgence: area.resurgence, difficulty, seats }),
        });
        return { t: 'push', screen: lobby };
      }
      return null;
    },
    draw(g, size, now, ctx) {
      form ??= build(ctx);
      const accent = COMET_COLORS[area.cometId].glow;
      const left = { x: 70, y: 90, w: size.w * 0.52, h: size.h - 190 };
      drawPanel(g, left, { chamfer: 16, alpha: 0.9, edge: accent });
      const px = left.x + 40;
      drawText(g, `${humanize(area.cometId).toUpperCase()}  ·  AREA ${area.number ?? areaNumber(area)}${area.resurgence ? '  ·  RESURGENCE' : ''}`, px, left.y + 46, { size: 17, color: accent, spacing: 4, weight: 700 });
      drawText(g, area.name, px, left.y + 100, { size: 52, color: '#fff', weight: 700 });
      let y = left.y + 160;
      if (area.briefing) {
        for (const l of wrapText(g, area.briefing, left.w - 80, 20)) { drawText(g, l, px, y, { size: 20, color: COLORS.text, weight: 500 }); y += 30; }
        y += 14;
      }
      drawText(g, 'OBJECTIVES', px, y, { size: 15, color: COLORS.cyan, spacing: 4, weight: 700 });
      y += 36;
      for (const o of area.objectives) { drawText(g, `◆  ${o}`, px, y, { size: 22, color: '#fff', weight: 500 }); y += 36; }
      y += 16;
      drawText(g, `PAR TIME  ${formatTime(area.parTimeSec)}`, px, y, { size: 22, color: COLORS.thorium, weight: 700 });
      if (area.resurgence) drawText(g, 'No hints. Harder.', px + 330, y, { size: 20, color: COLORS.danger, weight: 600 });
      if (area.teaches) {
        const r = researchDef(area.teaches);
        const box = { x: px, y: left.y + left.h - 140, w: left.w - 80, h: 104 };
        drawPanel(g, box, { chamfer: 12, edge: rgba(COLORS.thorium, 0.7), alpha: 0.8 });
        drawIcon(g, 'star', box.x + 54, box.y + box.h / 2, 48, COLORS.thorium);
        drawText(g, `NEW TECH  ·  ${r?.name ?? humanize(area.teaches)}`, box.x + 110, box.y + 36, { size: 22, color: COLORS.thorium, weight: 700 });
        for (const [i, l] of wrapText(g, r?.description ?? 'Complete this area to unlock it.', box.w - 140, 17).slice(0, 2).entries()) drawText(g, l, box.x + 110, box.y + 66 + i * 24, { size: 17, color: COLORS.text, weight: 500 });
      }
      const fx = left.x + left.w + 40;
      drawForm(g, form, { x: fx, y: 130, w: size.w - fx - 70, h: 460 }, now, { rowH: 62, gap: 12 });
      drawText(g, difficultyBlurb(form.value('difficulty')), fx, 460, { size: 17, color: COLORS.dim, weight: 500 });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'adjust', label: 'Change' }, { key: 'back', label: 'Back' }]);
    },
  };
}
