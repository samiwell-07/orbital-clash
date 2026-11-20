import type { HudApi, InputApi, PlayerId, Player, SimEvent, World } from '../../types';
import type { VideoLayout } from '../../meta/settings';
import { buildItemsFor } from '../menus/buildItems';
import { attackSlotsFor, targetCandidates } from '../menus/attackUnits';
import { drawBuildMenu, drawQuickBuildHint } from '../menus/buildMenu';
import { drawAttackMenu, drawMissileCharge } from '../menus/attackMenu';
import { PauseMenu } from '../menus/pauseMenu';
import type { Command } from '../screens/types';
import { autoMode, clampRect, computeHudLayout, fitProjection, type HudLayout, type Rect } from '../layout';
import { slideOffset, newPanelState, updatePanelState, type PanelState } from './state';
import { drawPlayerPanel, drawTimer } from './sidebar';
import { drawBanners, drawObjectives, drawWordmark } from './banner';
import { currentHint, MessageFeed } from './messages';
import { cardSize, drawStructureCard } from './tooltip';
import { structureAt, structureCard } from './card';
import type { Ctx } from '../theme';

export interface HudOptions {
  /** Which layout to use (settings.videoLayout); defaults to the canvas aspect. */
  layout?: () => VideoLayout;
  /** Tile -> canvas pixel projection from the renderer camera; defaults to the map fitted into the play area. */
  project?: (x: number, y: number) => { x: number; y: number } | null;
  controlsDisplay?: () => 'gamepad' | 'keyboard';
  /** Extra warning on the pause overlay (e.g. a disconnected controller). */
  pauseNotice?: () => string | null;
}

export interface Hud extends HudApi {
  /**
   * Feed this frame's drained SimEvents (messages, denials, tech unlocks, base-hit warnings, mission errors).
   * world (else the last drawn one) tells human tech unlocks from alien ones.
   */
  pushEvents(events: readonly SimEvent[], nowSec?: number, world?: World): void;
  /** Command produced by the pause menu (resume/restart/quitToTitle), if any. Call after draw. */
  takeCommand(): Command | null;
  reset(): void;
}

function panelOrder(world: World): Player[] {
  const active = world.players.filter((p) => p.controller !== 'none');
  const ai = active.filter((p) => p.controller !== 'human');
  const humans = active.filter((p) => p.controller === 'human');
  return [...ai, ...humans];
}

export function createHud(opts: HudOptions = {}): Hud {
  const feed = new MessageFeed();
  const pause = new PauseMenu();
  const states = new Map<PlayerId, PanelState>();
  let lastWorld: World | null = null;
  let lastNow = 0;
  let startSec = 0;
  let pending: Command | null = null;
  let wasPaused = false;

  const reset = (): void => {
    feed.clear();
    pause.reset();
    states.clear();
    pending = null;
    lastWorld = null;
  };

  const anchorFor = (world: World, layout: HudLayout) => {
    const fit = fitProjection(layout.play, world.grid.w, world.grid.h);
    return (x: number, y: number) => opts.project?.(x, y) ?? fit(x, y);
  };

  function drawHumanOverlays(ctx: Ctx, world: World, input: InputApi, layout: HudLayout, now: number): void {
    const project = anchorFor(world, layout);
    const bounds: Rect = layout.play;
    for (const p of world.players) {
      if (p.controller !== 'human' || !p.alive) continue;
      const ui = input.ui(p.id);
      const ship = project(p.ship.x, p.ship.y);
      if (ui.missileCharge > 0) drawMissileCharge(ctx, ship, ui.missileCharge, layout.s);
      if (ui.menu === 'build') {
        drawBuildMenu(ctx, ship, bounds, buildItemsFor(world, p.id), ui.buildIndex, p.id, layout.s, now);
      } else if (ui.attackShown) {
        const origin = p.baseBuilt ? project(p.baseTx + 0.5, p.baseTy + 0.5) : ship;
        const enemies = targetCandidates(world, p.id);
        drawAttackMenu(ctx, origin, bounds, {
          slots: attackSlotsFor(world, p.id), hover: ui.attackIndex, locked: p.attack.locked, player: p.id,
          target: p.attack.targetPlayer, cycleHint: world.settings.mode === 'battle' && enemies.length > 1,
          enemyTarget: world.players[p.attack.targetPlayer]?.controller !== 'human',
        }, layout.s, now);
      } else if (ui.menu === 'none') {
        const st = structureAt(world, p.ship.cursorTx, p.ship.cursorTy);
        if (!st) {
          const item = p.baseBuilt ? buildItemsFor(world, p.id)[ui.buildIndex] : undefined;
          if (item) drawQuickBuildHint(ctx, project(p.ship.cursorTx + 1.1, p.ship.cursorTy + 0.5), item, p.id, layout.s);
          continue;
        }
        const card = structureCard(world, st, p.id);
        const size = cardSize(card, layout.s);
        const at = project(st.tx + 1.2, st.ty + 0.5);
        const r = clampRect(at.x + 8 * layout.s, at.y - size.h / 2, size.w, size.h, bounds);
        drawStructureCard(ctx, r, card, layout.s);
      }
    }
  }

  return {
    pushEvents(events, nowSec, world) {
      const w = world ?? lastWorld;
      feed.push(events, nowSec ?? lastNow, (owner) => !w || w.players[owner]?.controller === 'human');
    },

    takeCommand() {
      const c = pending;
      pending = null;
      return c;
    },

    reset,

    draw(ctx, world, input, nowSec) {
      const w = ctx.canvas.width, h = ctx.canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (world !== lastWorld || nowSec < lastNow) {
        if (world !== lastWorld) states.clear();
        lastWorld = world;
        startSec = nowSec;
      }
      const dt = Math.min(0.1, Math.max(0, nowSec - lastNow));
      lastNow = nowSec;

      const shown = panelOrder(world);
      const layout = computeHudLayout(w, h, opts.layout?.() ?? autoMode(w, h), shown.length);
      const s = layout.s;

      drawTimer(ctx, layout.timer, world, s, nowSec);
      shown.forEach((player, i) => {
        let st = states.get(player.id);
        if (!st) states.set(player.id, (st = newPanelState(player)));
        updatePanelState(st, player, dt, nowSec);
        const r = layout.panels[i];
        const dx = layout.mode === '16:9' ? slideOffset(nowSec, startSec, i, 320 * s) : 0;
        const dy = layout.mode === '4:3' ? -slideOffset(nowSec, startSec, i, 140 * s) : 0;
        ctx.save();
        ctx.translate(dx, dy);
        drawPlayerPanel(ctx, { world, player, state: st, r, s, now: nowSec, flash: feed.hitFlash(player.id, nowSec) });
        ctx.restore();
      });

      const mission = world.settings.mission;
      if (mission) drawObjectives(ctx, layout.objectives, s, mission.objectives);
      if (layout.wordmark) drawWordmark(ctx, layout.wordmark, s);
      const hint = mission ? currentHint(world.timeSec, mission.hints, mission.resurgence) : null;
      drawBanners(ctx, layout.banner, s, nowSec, feed.active(nowSec), hint);

      const paused = world.paused || world.players.some((p) => p.controller === 'human' && input.ui(p.id).menu === 'pause');
      if (!paused) {
        if (wasPaused) pause.reset();
        drawHumanOverlays(ctx, world, input, layout, nowSec);
      } else {
        const cmd = pause.update(input.nav(), dt);
        if (cmd) pending = cmd;
        pause.draw(ctx, { x: 0, y: 0, w, h }, s, nowSec, opts.controlsDisplay?.() ?? 'gamepad', opts.pauseNotice?.() ?? null);
      }
      wasPaused = paused;
    },
  };
}
