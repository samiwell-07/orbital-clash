import type { GameMode, Rect, Team, ViewState, World } from '../types';
import { CANVAS_W, COLORS, HUD_BOTTOM, HUD_TOP, MAP_H, TEAM_COLORS } from '../core/config';
import { TOWER_DEFS } from '../data/towers';
import { SLOT_ACTIONS, UNIT_DEFS } from '../data/units';
import { drawDrone, drawTowerArt, drawUnitArt } from './Art';
import { countQueue } from './Hud';
import { angledRectPath, font, rgba, withGlow } from './theme';

const PANEL_Y = HUD_TOP + MAP_H;
const SLOT_W = 70;
const SLOT_H = 46;
const SLOT_GAP = 5;
const GROUP_GAP = 10;
const SLOT_Y = PANEL_Y + 6;
const EDGE = 56;
const SLOTS_W = SLOT_ACTIONS.length * SLOT_W + (SLOT_ACTIONS.length - 1) * SLOT_GAP + GROUP_GAP;
const HALF = CANVAS_W / 2;

const P1_KEYS = ['1', '2', '3', '4', '5', '6', '7'];
const P2_KEYS = ['N1·U', 'N2·I', 'N3·O', 'N4·P', 'N5·J', 'N6·K', 'N7·L'];
const SHORT_NAMES: Record<string, string> = {
  laser: 'LASER',
  cannon: 'CANNON',
  cryo: 'CRYO',
  refinery: 'REFINERY',
  scout: 'SCOUT',
  tank: 'TANK',
  shielded: 'AEGIS',
};

/** Shared layout: canvas-logical rect of slot `slot` (0..6) in `team`'s half. */
export function buildSlotRect(team: Team, slot: number): Rect {
  const start = team === 0 ? EDGE : HALF + (HALF - EDGE - SLOTS_W);
  const x = start + slot * (SLOT_W + SLOT_GAP) + (slot >= 4 ? GROUP_GAP : 0);
  return { x, y: SLOT_Y, w: SLOT_W, h: SLOT_H };
}

/**
 * Hit-test the bottom build/send panel at canvas logical coords.
 * Returns the team panel and slot index (0..6, see SLOT_ACTIONS) or null.
 * In 'single' mode only team 0's panel is interactive.
 */
export function hitTestBuildMenu(x: number, y: number, mode: GameMode): { team: Team; slot: number } | null {
  if (y < SLOT_Y || y > SLOT_Y + SLOT_H) return null;
  const teams: Team[] = mode === 'single' ? [0] : [0, 1];
  for (const team of teams) {
    for (let i = 0; i < SLOT_ACTIONS.length; i++) {
      const r = buildSlotRect(team, i);
      if (x >= r.x && x <= r.x + r.w) return { team, slot: i };
    }
  }
  return null;
}

/** Bottom build/send panel. */
export function drawBuildMenu(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  ctx.save();
  const bg = ctx.createLinearGradient(0, PANEL_Y, 0, PANEL_Y + HUD_BOTTOM);
  bg.addColorStop(0, 'rgba(6,10,22,0.82)');
  bg.addColorStop(1, 'rgba(3,5,12,0.94)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, PANEL_Y, CANVAS_W, HUD_BOTTOM);
  ctx.fillStyle = rgba(TEAM_COLORS[0].main, 0.5);
  ctx.fillRect(0, PANEL_Y, HALF, 1);
  ctx.fillStyle = rgba(TEAM_COLORS[1].main, 0.5);
  ctx.fillRect(HALF, PANEL_Y, HALF, 1);
  ctx.fillStyle = 'rgba(160,200,255,0.18)';
  ctx.fillRect(HALF - 0.5, PANEL_Y + 6, 1, HUD_BOTTOM - 12);

  drawHalf(ctx, world, view, 0);
  if (world.mode === 'single') drawAiPanel(ctx, world, view);
  else drawHalf(ctx, world, view, 1);
  ctx.restore();
}

function drawHalf(ctx: CanvasRenderingContext2D, world: World, view: ViewState, team: Team): void {
  const pal = TEAM_COLORS[team];
  const player = world.players[team];
  const counts = countQueue(player.queue);
  const keys = team === 0 ? P1_KEYS : P2_KEYS;

  // Team badge.
  const bx = team === 0 ? 8 : CANVAS_W - 8 - 40;
  ctx.beginPath();
  angledRectPath(ctx, bx, SLOT_Y, 40, SLOT_H, 7);
  ctx.fillStyle = rgba(pal.main, 0.16);
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(15, 800);
  ctx.fillStyle = pal.main;
  ctx.fillText(team === 0 ? 'P1' : 'P2', bx + 20, SLOT_Y + 18);
  ctx.font = font(6, 600);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('ARSENAL', bx + 20, SLOT_Y + 34);

  for (let i = 0; i < SLOT_ACTIONS.length; i++) {
    const action = SLOT_ACTIONS[i]!;
    const r = buildSlotRect(team, i);
    const cost = action.type === 'build' ? TOWER_DEFS[action.kind].levels[0].cost : UNIT_DEFS[action.kind].cost;
    const affordable = player.money >= cost;
    const selected = action.type === 'build' && player.selectedTower === action.kind;

    ctx.globalAlpha = affordable ? 1 : 0.42;
    ctx.beginPath();
    angledRectPath(ctx, r.x, r.y, r.w, r.h, 7);
    ctx.fillStyle = selected ? rgba(pal.main, 0.22) : action.type === 'send' ? 'rgba(40,16,24,0.55)' : 'rgba(14,20,36,0.75)';
    ctx.fill();
    if (selected) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * (0.75 + 0.25 * Math.sin(view.realTime * 6));
      withGlow(ctx, pal.main, 10, () => {
        ctx.beginPath();
        angledRectPath(ctx, r.x, r.y, r.w, r.h, 7);
        ctx.strokeStyle = pal.bright;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
      ctx.globalAlpha = a;
    } else {
      ctx.strokeStyle = rgba(pal.main, action.type === 'send' ? 0.3 : 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (action.type === 'send') {
      ctx.fillStyle = rgba(COLORS.warning, 0.6);
      ctx.fillRect(r.x + 8, r.y, r.w - 16, 1.5);
    }

    // Icon.
    ctx.save();
    ctx.translate(r.x + 18, r.y + 19);
    if (action.type === 'build') {
      ctx.scale(0.62, 0.62);
      drawTowerArt(ctx, action.kind, team, 0, team === 0 ? -0.5 : Math.PI + 0.5, view.realTime, 0, false);
    } else {
      drawUnitArt(ctx, action.kind, team, team === 0 ? 0 : Math.PI, view.realTime, null, action.kind === 'tank' ? 7 : 8);
    }
    ctx.restore();

    // Hotkey.
    ctx.font = font(8, 700);
    const kw = Math.max(13, ctx.measureText(keys[i]!).width + 6);
    ctx.fillStyle = selected ? pal.main : 'rgba(255,255,255,0.1)';
    ctx.fillRect(r.x + r.w - kw - 4, r.y + 4, kw, 11);
    ctx.fillStyle = selected ? '#02030a' : COLORS.text;
    ctx.textAlign = 'center';
    ctx.fillText(keys[i]!, r.x + r.w - kw / 2 - 4, r.y + 10);

    // Cost.
    ctx.font = font(11, 700);
    ctx.textAlign = 'right';
    ctx.fillStyle = affordable ? COLORS.money : COLORS.warning;
    ctx.fillText(`$${cost}`, r.x + r.w - 5, r.y + 25);

    // Name.
    ctx.font = font(8, 600);
    ctx.textAlign = 'center';
    ctx.fillStyle = selected ? pal.bright : COLORS.textDim;
    ctx.fillText(SHORT_NAMES[action.kind] ?? action.kind, r.x + r.w / 2, r.y + r.h - 7);

    // Queue badge.
    if (action.type === 'send') {
      const n = counts[action.kind];
      if (n > 0) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(r.x + 5, r.y + 5, 8, 0, Math.PI * 2);
        ctx.fillStyle = pal.main;
        ctx.fill();
        ctx.strokeStyle = '#02030a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#02030a';
        ctx.font = font(9, 800);
        ctx.fillText(`${n}`, r.x + 5, r.y + 5.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Key hints.
  const first = buildSlotRect(team, 0);
  const last = buildSlotRect(team, SLOT_ACTIONS.length - 1);
  ctx.font = font(8, 600);
  ctx.textAlign = 'center';
  ctx.fillStyle = rgba(pal.bright, 0.6);
  const hint =
    team === 0
      ? 'WASD move · SPACE act · R up · F sell'
      : 'ARROWS · ENTER · NUM+ / [ up · NUM- / ] sell';
  ctx.fillText(hint, (first.x + last.x + last.w) / 2, PANEL_Y + HUD_BOTTOM - 9);
}

function drawAiPanel(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  const pal = TEAM_COLORS[1];
  const player = world.players[1];
  const x = HALF + 16;
  const w = HALF - 24;
  const y = SLOT_Y;
  const h = HUD_BOTTOM - 14;
  ctx.beginPath();
  angledRectPath(ctx, x, y, w, h, 10);
  ctx.fillStyle = rgba(pal.dark, 0.35);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.main, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();

  drawDrone(ctx, x + 36, y + h / 2 + 12, 1, view.realTime, player.cursor.carryingRockId !== null);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(14, 800);
  ctx.fillStyle = pal.main;
  ctx.fillText('AI COMMANDER', x + 70, y + 16);
  ctx.font = font(9, 600);
  ctx.fillStyle = COLORS.textDim;
  const dots = '.'.repeat(1 + (Math.floor(view.realTime * 3) % 3));
  const status =
    world.winner !== null ? 'OFFLINE' : player.cursor.carryingRockId !== null ? 'HAULING THORIUM' : `ANALYZING${dots}`;
  ctx.fillText(`STATUS · ${status}`, x + 70, y + 36);

  let towers = 0;
  for (const t of world.towers) if (t.team === 1) towers++;
  let units = 0;
  for (const u of world.units) if (u.team === 1 && u.alive) units++;
  const stats: [string, string, string][] = [
    ['THREAT LV', `${world.level.level}`, '#ffd166'],
    ['THORIUM', `$${Math.floor(player.money)}`, COLORS.money],
    ['TOWERS', `${towers}`, COLORS.text],
    ['QUEUED', `${player.queue.length}`, COLORS.text],
    ['IN FIELD', `${units}`, COLORS.text],
  ];
  let sx = x + 262;
  for (const [label, value, color] of stats) {
    ctx.font = font(8, 600);
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(label, sx, y + 16);
    ctx.font = font(16, 800);
    ctx.fillStyle = color;
    ctx.fillText(value, sx, y + 35);
    sx += 72;
  }
}
