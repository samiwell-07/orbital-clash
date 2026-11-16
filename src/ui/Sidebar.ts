import type { BuildAction, GameMode, PlayerState, ResearchKind, Tower, UnitKind, ViewState, World } from '../types';
import { CANVAS_H, COLORS, MAX_QUEUE, PALETTES, RESEARCH_BAR_MAX, SELL_REFUND, SIDEBAR_W, paletteOf } from '../core/config';
import type { TeamPalette } from '../core/config';
import { P1_BINDINGS, P2_BINDINGS } from '../data/controls';
import type { KeyBinding } from '../data/controls';
import { TOWER_DEFS, upgradeCost } from '../data/towers';
import { RESEARCH_DEFS, UNIT_DEFS } from '../data/units';
import { blit, crystalSprite, drawTowerIcon, unitSprite } from './Art';
import { angledRectPath, clamp01, font, polygonPath, rgba } from './theme';

// ---------------------------------------------------------------- Layout (shared by drawing and hit testing)

const PAD = 8;
const TIMER_Y = 6;
const TIMER_H = 42;
const BLOCK_Y = 54;
const BLOCK_H = 112;
const BLOCK_GAP = 6;
const MENU_Y = BLOCK_Y + BLOCK_H * 2 + BLOCK_GAP + 8;
const HEAD_H = 16;
const ROW_H = 22;

interface SideRow {
  y: number;
  h: number;
  header: string | null;
  slot: KeyBinding | null;
  p2: KeyBinding | null;
}

function groupOf(a: BuildAction): string {
  switch (a.type) {
    case 'build':
      return 'TOWERS';
    case 'upgrade':
    case 'sell':
      return 'TOWER OPS';
    case 'send':
    case 'launch':
      return 'ATTACK';
    case 'research':
      return 'RESEARCH';
  }
}

function sameAction(a: BuildAction, b: BuildAction): boolean {
  if (a.type !== b.type) return false;
  if ('kind' in a && 'kind' in b) return a.kind === b.kind;
  return true;
}

let rowsCache: SideRow[] | null = null;

function layoutRows(): SideRow[] {
  if (rowsCache) return rowsCache;
  const rows: SideRow[] = [];
  let y = MENU_Y;
  let group = '';
  for (const slot of P1_BINDINGS.slots) {
    const gname = groupOf(slot.action);
    if (gname !== group) {
      group = gname;
      rows.push({ y, h: HEAD_H, header: gname, slot: null, p2: null });
      y += HEAD_H;
    }
    const p2 = P2_BINDINGS.slots.find((s) => sameAction(s.action, slot.action)) ?? null;
    rows.push({ y, h: ROW_H, header: null, slot, p2 });
    y += ROW_H;
  }
  rowsCache = rows;
  return rows;
}

/** P1's action for a click at canvas logical (x, y), or null. `mode` is reserved. */
export function hitTestSidebar(x: number, y: number, _mode: GameMode): BuildAction | null {
  if (x < PAD || x > SIDEBAR_W - PAD) return null;
  for (const row of layoutRows()) {
    if (row.slot && y >= row.y && y < row.y + row.h) return row.slot.action;
  }
  return null;
}

// ---------------------------------------------------------------- Static panel cache

let panel: HTMLCanvasElement | null = null;
let panelScale = 0;

function buildPanel(scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(SIDEBAR_W * scale);
  c.height = Math.round(CANVAS_H * scale);
  const g = c.getContext('2d');
  if (!g) return c;
  g.scale(scale, scale);
  const grad = g.createLinearGradient(0, 0, SIDEBAR_W, 0);
  grad.addColorStop(0, '#16171f');
  grad.addColorStop(0.5, '#1e2029');
  grad.addColorStop(1, '#101117');
  g.fillStyle = grad;
  g.fillRect(0, 0, SIDEBAR_W, CANVAS_H);
  // Brushed metal streaks.
  for (let y = 0; y < CANVAS_H; y += 3) {
    g.fillStyle = `rgba(255,255,255,${0.012 + ((y * 7919) % 13) * 0.0016})`;
    g.fillRect(0, y, SIDEBAR_W, 1);
  }
  // Bevels.
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(0, 0, 2, CANVAS_H);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(SIDEBAR_W - 5, 0, 5, CANVAS_H);
  g.save();
  g.shadowColor = COLORS.circuit;
  g.shadowBlur = 8;
  g.fillStyle = rgba(COLORS.circuit, 0.8);
  g.fillRect(SIDEBAR_W - 4, 0, 1.5, CANVAS_H);
  g.restore();
  // Timer bezel.
  bezel(g, PAD, TIMER_Y, SIDEBAR_W - PAD * 2 - 4, TIMER_H);
  // Menu bezel.
  const rows = layoutRows();
  const last = rows[rows.length - 1]!;
  bezel(g, PAD - 3, MENU_Y - 4, SIDEBAR_W - PAD * 2 + 2, last.y + last.h - MENU_Y + 8);
  // Rivets.
  g.fillStyle = 'rgba(0,0,0,0.6)';
  for (const y of [3, CANVAS_H - 6]) {
    for (const x of [4, SIDEBAR_W - 12]) g.fillRect(x, y, 3, 3);
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (const y of [3, CANVAS_H - 6]) {
    for (const x of [4, SIDEBAR_W - 12]) g.fillRect(x, y, 1.5, 1.5);
  }
  return c;
}

function bezel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.beginPath();
  angledRectPath(g, x, y, w, h, 6);
  g.fillStyle = 'rgba(4,5,10,0.75)';
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.lineWidth = 2;
  g.stroke();
  g.beginPath();
  angledRectPath(g, x + 1, y + 1, w - 2, h - 2, 5);
  g.strokeStyle = rgba(COLORS.circuit, 0.22);
  g.lineWidth = 1;
  g.stroke();
}

// ---------------------------------------------------------------- Drawing

const SHORT_TOWER: Record<string, string> = { laser: 'LASER', cannon: 'MORTAR', cryo: 'FROST', plasma: 'PLASMA', refinery: 'HARVEST' };
const SHORT_UNIT: Record<UnitKind, string> = { scout: 'SWARMER', tank: 'JUGGER', shielded: 'AEGIS', bomber: 'BOMBER' };
const SHORT_RESEARCH: Record<ResearchKind, string> = { maxLevel3: 'TOWER LV3', swarmSpeed: 'SWARM SPD', doubleHarvest: 'DUAL CARGO' };
const TECH_CHIP: Record<ResearchKind, string> = { maxLevel3: 'LV3', swarmSpeed: 'SPD', doubleHarvest: '2×' };
const TECHS: ResearchKind[] = ['maxLevel3', 'swarmSpeed', 'doubleHarvest'];

function formatTime(t: number): string {
  const s = Math.max(0, Math.floor(t));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m < 10 ? '0' : ''}${m}:${ss < 10 ? '0' : ''}${ss}`;
}

/** Draws the full left sidebar (timer, player status blocks, build menu). Canvas logical coordinates. */
export function drawSidebar(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  const scale = Math.min(2, Math.max(1, ctx.getTransform().a));
  if (!panel || panelScale !== scale) {
    panel = buildPanel(scale);
    panelScale = scale;
    live = null;
  }
  // Text is costly to rasterize every frame: repaint an offscreen copy only when what it shows changes.
  const key = sidebarKey(world, view);
  if (!live || liveKey !== key) {
    if (!live) {
      live = document.createElement('canvas');
      live.width = Math.round(SIDEBAR_W * scale);
      live.height = Math.round(CANVAS_H * scale);
    }
    const g = live.getContext('2d');
    if (g) {
      g.setTransform(scale, 0, 0, scale, 0, 0);
      paintSidebar(g, world, view);
    }
    liveKey = key;
  }
  ctx.drawImage(live, 0, 0, SIDEBAR_W, CANVAS_H);
}

let live: HTMLCanvasElement | null = null;
let liveKey = '';

function sidebarKey(world: World, view: ViewState): string {
  const p1 = world.players[0];
  let k = `${world.mode}|${Math.floor(world.time)}|${Math.round(view.fps)}|${view.muted ? 1 : 0}|${world.level.level}`;
  let animate = false;
  for (const p of world.players) {
    const b = world.bases[p.team];
    k += `|${p.palette}${p.controller}${Math.floor(p.money)},${Math.floor(p.research)},${p.queue.length},${Math.ceil(b.hp)},${b.hitFlash > 0 ? 1 : 0}`;
    k += `${p.researched.maxLevel3 ? 1 : 0}${p.researched.swarmSpeed ? 1 : 0}${p.researched.doubleHarvest ? 1 : 0}`;
    if (p.queue.length > 0 || b.hp / b.maxHp < 0.3) animate = true;
  }
  const t = towerUnderCursor(world, p1);
  k += `|${p1.selectedTower}|${t ? `${t.id},${t.level},${t.totalSpent}` : '-'}`;
  if (animate) k += `|${Math.floor(view.realTime * 10)}`;
  return k;
}

function paintSidebar(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  ctx.drawImage(panel!, 0, 0, SIDEBAR_W, CANVAS_H);

  // Match timer.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(26, 800);
  ctx.fillStyle = rgba(COLORS.circuit, 0.25);
  ctx.fillText(formatTime(world.time), (SIDEBAR_W - 4) / 2 + 1, TIMER_Y + TIMER_H / 2 + 2);
  ctx.fillStyle = COLORS.white;
  ctx.fillText(formatTime(world.time), (SIDEBAR_W - 4) / 2, TIMER_Y + TIMER_H / 2 + 1);

  for (let t = 0; t < 2; t++) {
    drawPlayerBlock(ctx, world, world.players[t as 0 | 1], BLOCK_Y + t * (BLOCK_H + BLOCK_GAP), view);
  }
  drawMenuRows(ctx, world, view);

  // Footer hints.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(8, 600);
  ctx.fillStyle = COLORS.textDim;
  const fy = CANVAS_H - 44;
  ctx.fillText(`${P1_BINDINGS.moveLabel} move · ${P1_BINDINGS.actLabel} act`, SIDEBAR_W / 2 - 2, fy);
  if (world.mode === 'versus') ctx.fillText(`P2 ${P2_BINDINGS.moveLabel} · ${P2_BINDINGS.actLabel}`, SIDEBAR_W / 2 - 2, fy + 12);
  ctx.fillText(`ESC pause · \` mute${view.muted ? ' (OFF)' : ''}`, SIDEBAR_W / 2 - 2, fy + 24);
  ctx.fillStyle = 'rgba(125,138,166,0.55)';
  ctx.fillText(`${Math.round(view.fps)} FPS`, SIDEBAR_W / 2 - 2, fy + 36);
}

function drawPlayerBlock(ctx: CanvasRenderingContext2D, world: World, p: PlayerState, y: number, view: ViewState): void {
  const pal = paletteOf(p);
  const x = PAD - 3;
  const w = SIDEBAR_W - PAD * 2 + 2;
  const base = world.bases[p.team];
  ctx.beginPath();
  angledRectPath(ctx, x, y, w, BLOCK_H, 8);
  ctx.fillStyle = rgba(pal.dark, 0.55);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.main, base.hitFlash > 0 ? 1 : 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = pal.main;
  ctx.fillRect(x + 1, y + 10, 2, BLOCK_H - 20);

  // Badge.
  const bx = x + 22;
  const by = y + 22;
  ctx.beginPath();
  polygonPath(ctx, bx, by, 16, 6, Math.PI / 6);
  ctx.fillStyle = pal.dark;
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (p.controller === 'ai') {
    drawAiIcon(ctx, bx, by, pal);
  } else {
    ctx.font = font(20, 900);
    ctx.fillStyle = pal.bright;
    ctx.fillText(p.controller === 'p1' ? '1' : '2', bx, by + 1);
  }

  // Name + buffer.
  ctx.textAlign = 'left';
  ctx.font = font(10, 800);
  ctx.fillStyle = pal.main;
  const name = p.controller === 'ai' ? `AI · LV ${world.level.level}` : p.controller === 'p1' ? 'PLAYER 1' : 'PLAYER 2';
  ctx.fillText(name, x + 44, y + 14);
  const buf = p.queue.length;
  ctx.font = font(9, 700);
  ctx.fillStyle = buf > 0 ? COLORS.white : COLORS.textDim;
  ctx.fillText(`BUFFER ${buf}`, x + 44, y + 28);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x + 44, y + 35, w - 52, 3);
  if (buf > 0) {
    const pulse = 0.75 + 0.25 * Math.sin(view.realTime * 6);
    ctx.fillStyle = rgba(pal.main, pulse);
    ctx.fillRect(x + 44, y + 35, (w - 52) * clamp01(buf / MAX_QUEUE), 3);
  }

  // Health.
  const hpFrac = clamp01(base.hp / base.maxHp);
  const ry = y + 50;
  drawHeart(ctx, x + 11, ry);
  bar(ctx, x + 21, ry - 4, w - 62, 8, hpFrac, hpFrac < 0.3 && Math.sin(view.realTime * 10) > 0 ? COLORS.warning : COLORS.health);
  ctx.textAlign = 'right';
  ctx.font = font(10, 800);
  ctx.fillStyle = COLORS.white;
  ctx.fillText(`${Math.ceil(Math.max(0, base.hp))}`, x + w - 6, ry + 1);

  // Money.
  const my = y + 68;
  blit(ctx, crystalSprite(0), x + 11, my, 0.55);
  ctx.textAlign = 'left';
  ctx.font = font(14, 900);
  ctx.fillStyle = COLORS.money;
  ctx.fillText(`${Math.floor(p.money)}`, x + 22, my + 1);
  ctx.font = font(8, 700);
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = 'right';
  ctx.fillText('THORIUM', x + w - 6, my + 1);

  // Research.
  const rsy = y + 86;
  drawEnergyIcon(ctx, x + 11, rsy);
  bar(ctx, x + 21, rsy - 3, w - 62, 6, clamp01(p.research / RESEARCH_BAR_MAX), COLORS.research);
  ctx.textAlign = 'right';
  ctx.font = font(10, 800);
  ctx.fillStyle = COLORS.research;
  ctx.fillText(`${Math.floor(p.research)}`, x + w - 6, rsy + 1);

  // Tech chips.
  const cy = y + 101;
  const cw = (w - 16) / 3;
  ctx.font = font(8, 800);
  ctx.textAlign = 'center';
  for (let i = 0; i < TECHS.length; i++) {
    const kind = TECHS[i]!;
    const on = p.researched[kind];
    const cx0 = x + 6 + i * (cw + 2);
    ctx.beginPath();
    angledRectPath(ctx, cx0, cy - 5, cw, 11, 3);
    ctx.fillStyle = on ? COLORS.research : 'rgba(0,0,0,0.45)';
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.research, on ? 1 : 0.3);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = on ? '#04121a' : 'rgba(47,216,255,0.45)';
    ctx.fillText(TECH_CHIP[kind], cx0 + cw / 2, cy + 1);
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = rgba(color, 0.18);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * frac, h);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x, y, w * frac, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let k = x + 8; k < x + w; k += 8) ctx.fillRect(k, y, 1, h);
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.bezierCurveTo(x - 7, y - 1, x - 3.5, y - 6, x, y - 2.5);
  ctx.bezierCurveTo(x + 3.5, y - 6, x + 7, y - 1, x, y + 4);
  ctx.fillStyle = COLORS.health;
  ctx.fill();
}

function drawEnergyIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y - 6);
  ctx.lineTo(x - 3.5, y + 1);
  ctx.lineTo(x - 0.2, y + 1);
  ctx.lineTo(x - 1.5, y + 6);
  ctx.lineTo(x + 3.5, y - 1);
  ctx.lineTo(x + 0.2, y - 1);
  ctx.closePath();
  ctx.fillStyle = COLORS.research;
  ctx.fill();
}

function drawAiIcon(ctx: CanvasRenderingContext2D, x: number, y: number, pal: TeamPalette): void {
  ctx.fillStyle = pal.main;
  ctx.fillRect(x - 7, y - 5, 14, 11);
  ctx.fillRect(x - 0.75, y - 10, 1.5, 5);
  ctx.fillRect(x - 2, y - 11, 4, 2);
  ctx.fillStyle = '#1a0505';
  ctx.fillRect(x - 5, y - 2, 4, 3);
  ctx.fillRect(x + 1, y - 2, 4, 3);
  ctx.fillStyle = pal.bright;
  ctx.fillRect(x - 4, y - 1.5, 2, 2);
  ctx.fillRect(x + 2, y - 1.5, 2, 2);
  ctx.fillStyle = '#1a0505';
  ctx.fillRect(x - 4, y + 3, 8, 1.2);
}

function towerUnderCursor(world: World, p: PlayerState): Tower | null {
  const grid = world.grid;
  const { col, row } = p.cursor;
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null;
  const id = grid.cells[row * grid.cols + col]?.towerId ?? null;
  if (id === null) return null;
  for (const t of world.towers) if (t.id === id) return t.team === p.team ? t : null;
  return null;
}

function drawMenuRows(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  const p1 = world.players[0];
  const palKey = p1.palette;
  const pal = PALETTES[palKey];
  const versus = world.mode === 'versus';
  const capW = 22;
  const p1CapX = versus ? SIDEBAR_W - PAD - 4 - capW * 2 - 3 : SIDEBAR_W - PAD - 4 - capW;
  const p2CapX = SIDEBAR_W - PAD - 4 - capW;
  const costX = p1CapX - 4;
  const ownTower = towerUnderCursor(world, p1);
  const left = PAD;
  const width = SIDEBAR_W - PAD * 2 - 4;

  for (const row of layoutRows()) {
    if (row.header) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = font(8, 800);
      ctx.fillStyle = rgba(COLORS.circuit, 0.85);
      const cy = row.y + row.h / 2 + 1;
      ctx.fillText(row.header, left + 2, cy);
      const tw = ctx.measureText(row.header).width;
      ctx.fillStyle = rgba(COLORS.circuit, 0.25);
      ctx.fillRect(left + tw + 6, cy, width - tw - 8, 1);
      continue;
    }
    const slot = row.slot!;
    const a = slot.action;
    let name = '';
    let cost = '';
    let costColor: string = COLORS.money;
    let enabled = true;
    let selected = false;
    let done = false;
    switch (a.type) {
      case 'build': {
        const c = TOWER_DEFS[a.kind].levels[0].cost;
        name = SHORT_TOWER[a.kind] ?? a.kind;
        cost = `$${c}`;
        enabled = p1.money >= c;
        selected = p1.selectedTower === a.kind;
        break;
      }
      case 'upgrade': {
        name = 'UPGRADE';
        if (!ownTower) {
          cost = '—';
          costColor = COLORS.textDim;
        } else {
          const up = upgradeCost(ownTower.kind, ownTower.level);
          if (up === null) {
            cost = 'MAX';
            costColor = '#ffd166';
          } else if (ownTower.level === 1 && !p1.researched.maxLevel3) {
            cost = 'RES';
            costColor = COLORS.research;
            enabled = false;
          } else {
            cost = `$${up}`;
            enabled = p1.money >= up;
          }
        }
        break;
      }
      case 'sell':
        name = 'SELL 75%';
        if (ownTower) cost = `+$${Math.floor(ownTower.totalSpent * SELL_REFUND)}`;
        else {
          cost = '—';
          costColor = COLORS.textDim;
        }
        break;
      case 'send': {
        const def = UNIT_DEFS[a.kind];
        name = SHORT_UNIT[a.kind];
        cost = `×${def.packSize} $${def.packCost}`;
        enabled = p1.money >= def.packCost && p1.queue.length + def.packSize <= MAX_QUEUE;
        break;
      }
      case 'launch':
        name = 'LAUNCH';
        cost = `×${p1.queue.length}`;
        costColor = COLORS.white;
        enabled = p1.queue.length > 0;
        selected = enabled;
        break;
      case 'research': {
        const def = RESEARCH_DEFS[a.kind];
        name = SHORT_RESEARCH[a.kind];
        done = p1.researched[a.kind];
        cost = done ? '✓' : `${def.cost}`;
        costColor = done ? COLORS.health : COLORS.research;
        enabled = done || p1.research >= def.cost;
        break;
      }
    }

    const ry = row.y + 1;
    const rh = row.h - 2;
    const cy = row.y + row.h / 2;
    if (selected) {
      const pulse = a.type === 'launch' ? 0.5 + 0.5 * Math.sin(view.realTime * 6) : 1;
      ctx.fillStyle = rgba(pal.main, 0.18 + 0.12 * pulse);
      ctx.fillRect(left, ry, width, rh);
      ctx.fillStyle = pal.main;
      ctx.fillRect(left, ry, 2, rh);
      ctx.strokeStyle = rgba(pal.main, 0.7);
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, ry + 0.5, width - 1, rh - 1);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(left, ry, width, rh);
    }

    ctx.globalAlpha = enabled ? 1 : 0.4;
    drawSlotIcon(ctx, a, palKey, left + 11, cy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = font(9, 800);
    ctx.fillStyle = done ? COLORS.health : COLORS.white;
    ctx.fillText(name, left + 23, cy + 1);
    ctx.textAlign = 'right';
    ctx.font = font(9, 700);
    ctx.fillStyle = costColor;
    ctx.fillText(cost, costX, cy + 1);
    ctx.globalAlpha = 1;

    keycap(ctx, p1CapX, cy, capW, slot.label, pal.main);
    if (versus && row.p2) keycap(ctx, p2CapX, cy, capW, row.p2.label, paletteOf(world.players[1]).main);
  }
}

function keycap(ctx: CanvasRenderingContext2D, x: number, cy: number, w: number, label: string, color: string): void {
  const h = 14;
  ctx.fillStyle = '#0b0c11';
  ctx.fillRect(x, cy - h / 2, w, h);
  ctx.strokeStyle = rgba(color, 0.8);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, cy - h / 2 + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 1, cy - h / 2 + 1, w - 2, 2);
  ctx.textAlign = 'center';
  ctx.font = font(label.length > 2 ? 7.5 : 9, 800);
  ctx.fillStyle = COLORS.white;
  ctx.fillText(label, x + w / 2, cy + 1);
}

function drawSlotIcon(ctx: CanvasRenderingContext2D, a: BuildAction, palKey: PlayerState['palette'], x: number, y: number): void {
  const pal = PALETTES[palKey];
  switch (a.type) {
    case 'build':
      drawTowerIcon(ctx, a.kind, palKey, x, y, 18);
      return;
    case 'send': {
      const s = unitSprite(a.kind, palKey, 0);
      const vis = a.kind === 'scout' ? 8 : a.kind === 'shielded' ? 12 : a.kind === 'tank' ? 16 : 18;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      blit(ctx, s, 0, 0, 15 / vis);
      ctx.restore();
      return;
    }
    case 'launch':
      ctx.fillStyle = pal.main;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x - 6 + k * 5, y - 5);
        ctx.lineTo(x - 1 + k * 5, y);
        ctx.lineTo(x - 6 + k * 5, y + 5);
        ctx.lineTo(x - 4 + k * 5, y);
        ctx.closePath();
        ctx.fill();
      }
      return;
    case 'upgrade':
      ctx.fillStyle = '#ffd166';
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 3 - k * 5);
        ctx.lineTo(x, y - 2 - k * 5);
        ctx.lineTo(x + 5, y + 3 - k * 5);
        ctx.lineTo(x, y + 0.5 - k * 5);
        ctx.closePath();
        ctx.fill();
      }
      return;
    case 'sell':
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.money;
      ctx.fill();
      ctx.fillStyle = '#1a2405';
      ctx.fillRect(x - 3, y - 0.8, 6, 1.6);
      return;
    case 'research':
      ctx.strokeStyle = COLORS.research;
      ctx.fillStyle = COLORS.research;
      ctx.lineWidth = 1.2;
      if (a.kind === 'maxLevel3') {
        for (let k = 0; k < 3; k++) ctx.fillRect(x - 5 + k * 4, y + 3 - k * 3, 2.5, 3 + k * 3);
      } else if (a.kind === 'swarmSpeed') {
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x - 6 + k * 4, y - 4);
          ctx.lineTo(x - 2 + k * 4, y);
          ctx.lineTo(x - 6 + k * 4, y + 4);
          ctx.stroke();
        }
      } else {
        blit(ctx, crystalSprite(1), x - 3, y, 0.4);
        blit(ctx, crystalSprite(2), x + 3, y, 0.4);
      }
      return;
  }
}
