import type { Team, UnitKind, ViewState, World } from '../types';
import { CANVAS_W, COLORS, HUD_TOP, TEAM_COLORS } from '../core/config';
import { UNIT_KINDS } from '../data/units';
import { drawCrystal, drawUnitArt } from './Art';
import { angledRectPath, clamp01, font, rgba, withGlow } from './theme';

const SIDE_W = 452;
const CENTER_W = 300;

function fmtTime(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const queueCounts: Record<UnitKind, number> = { scout: 0, tank: 0, shielded: 0 };

/** Counts queued units per kind (reuses one object; read immediately). */
export function countQueue(queue: readonly UnitKind[]): Record<UnitKind, number> {
  queueCounts.scout = 0;
  queueCounts.tank = 0;
  queueCounts.shielded = 0;
  for (const k of queue) queueCounts[k]++;
  return queueCounts;
}

/** Top HUD bar (canvas logical coords 0..CANVAS_W x 0..HUD_TOP). */
export function drawHud(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  ctx.save();
  // Bar background.
  const bg = ctx.createLinearGradient(0, 0, 0, HUD_TOP);
  bg.addColorStop(0, 'rgba(6,10,22,0.92)');
  bg.addColorStop(1, 'rgba(4,6,14,0.78)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, HUD_TOP);
  ctx.fillStyle = rgba(TEAM_COLORS[0].main, 0.5);
  ctx.fillRect(0, HUD_TOP - 1, CANVAS_W / 2, 1);
  ctx.fillStyle = rgba(TEAM_COLORS[1].main, 0.5);
  ctx.fillRect(CANVAS_W / 2, HUD_TOP - 1, CANVAS_W / 2, 1);

  drawSide(ctx, world, 0, view);
  drawSide(ctx, world, 1, view);
  drawCenter(ctx, world, view);
  ctx.restore();
}

function drawSide(ctx: CanvasRenderingContext2D, world: World, team: Team, view: ViewState): void {
  const pal = TEAM_COLORS[team];
  const player = world.players[team];
  const base = world.bases[team];
  const x0 = team === 0 ? 6 : CANVAS_W - 6 - SIDE_W;
  const dir = team === 0 ? 1 : -1;
  // Local x helper: distance from the outer edge.
  const lx = (d: number): number => (team === 0 ? x0 + d : x0 + SIDE_W - d);

  ctx.beginPath();
  angledRectPath(ctx, x0, 5, SIDE_W, HUD_TOP - 11, 9);
  ctx.fillStyle = rgba(pal.dark, 0.35);
  ctx.fill();
  ctx.strokeStyle = rgba(pal.main, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Team tag.
  const tag = team === 0 ? 'P1' : world.mode === 'single' ? 'AI' : 'P2';
  ctx.beginPath();
  angledRectPath(ctx, team === 0 ? x0 + 6 : x0 + SIDE_W - 6 - 34, 11, 34, 24, 6);
  ctx.fillStyle = pal.main;
  ctx.fill();
  ctx.fillStyle = '#02030a';
  ctx.font = font(14, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tag, lx(23), 24);

  // Money.
  drawCrystal(ctx, lx(56), 26, 0.85, team * 2, view.realTime);
  ctx.font = font(18, 700);
  ctx.fillStyle = COLORS.money;
  ctx.textAlign = team === 0 ? 'left' : 'right';
  ctx.fillText(`$ ${Math.floor(player.money)}`, lx(70), 24);

  // Base HP bar.
  const barW = 150;
  const barX = team === 0 ? lx(158) : lx(158) - barW;
  const frac = clamp01(base.hp / base.maxHp);
  ctx.font = font(9, 600);
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = team === 0 ? 'left' : 'right';
  ctx.fillText('BASE INTEGRITY', lx(158), 15);
  ctx.textAlign = team === 0 ? 'right' : 'left';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(`${Math.ceil(base.hp)}`, team === 0 ? barX + barW : barX, 15);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, 22, barW, 10);
  const lowHp = frac < 0.3;
  const barColor = lowHp ? (Math.sin(view.realTime * 10) > 0 ? COLORS.warning : pal.main) : pal.main;
  const fillW = barW * frac;
  ctx.fillStyle = barColor;
  ctx.fillRect(team === 0 ? barX : barX + barW - fillW, 22, fillW, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(team === 0 ? barX : barX + barW - fillW, 22, fillW, 3);
  if (base.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${clamp01(base.hitFlash * 3)})`;
    ctx.fillRect(barX, 22, barW, 10);
  }
  // Segment ticks.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  for (let i = 1; i < 10; i++) ctx.fillRect(barX + (barW * i) / 10, 22, 1, 10);
  ctx.strokeStyle = rgba(pal.main, 0.6);
  ctx.strokeRect(barX - 0.5, 21.5, barW + 1, 11);

  // Queue.
  const counts = countQueue(player.queue);
  ctx.font = font(9, 600);
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = team === 0 ? 'left' : 'right';
  ctx.fillText(`NEXT WAVE · ${player.queue.length}`, lx(326), 15);
  let qx = 334;
  for (const kind of UNIT_KINDS) {
    const n = counts[kind];
    ctx.globalAlpha = n > 0 ? 1 : 0.3;
    ctx.save();
    ctx.translate(lx(qx), 29);
    drawUnitArt(ctx, kind, team, dir === 1 ? 0 : Math.PI, view.realTime, null, 5.5);
    ctx.restore();
    ctx.font = font(11, 700);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = team === 0 ? 'left' : 'right';
    ctx.fillText(`${n}`, lx(qx + 10), 29);
    qx += 38;
  }
  ctx.globalAlpha = 1;
}

function drawCenter(ctx: CanvasRenderingContext2D, world: World, view: ViewState): void {
  const cx = CANVAS_W / 2;
  const x0 = cx - CENTER_W / 2;
  ctx.beginPath();
  angledRectPath(ctx, x0, 3, CENTER_W, HUD_TOP - 7, 12);
  ctx.fillStyle = 'rgba(10,16,32,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,200,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const interval = world.level.waveInterval;
  const frac = clamp01(world.waveTimer / interval);
  const urgent = world.waveTimer <= 3;
  const accent = urgent ? COLORS.warning : '#e6f1ff';

  // Progress ring.
  const rx = cx - 62;
  const ry = 24;
  ctx.beginPath();
  ctx.arc(rx, ry, 16, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.stroke();
  withGlow(ctx, urgent ? COLORS.warning : '#19d3ff', 8, () => {
    ctx.beginPath();
    ctx.arc(rx, ry, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - frac));
    ctx.strokeStyle = urgent ? COLORS.warning : '#7fe8ff';
    ctx.stroke();
  });
  ctx.font = font(13, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.fillText(`${world.waveNumber + 1}`, rx, ry + 1);

  ctx.textAlign = 'left';
  ctx.font = font(9, 600);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`WAVE ${world.waveNumber + 1} INBOUND`, cx - 38, 14);
  ctx.font = font(22, 800);
  ctx.fillStyle = accent;
  const pulse = urgent ? 0.7 + 0.3 * Math.sin(view.realTime * 12) : 1;
  ctx.globalAlpha = pulse;
  ctx.fillText(fmtTime(world.waveTimer), cx - 39, 32);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'right';
  ctx.font = font(9, 600);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(world.mode === 'single' ? 'LEVEL' : 'VERSUS', x0 + CENTER_W - 16, 14);
  ctx.font = font(16, 800);
  ctx.fillStyle = world.mode === 'single' ? '#ffd166' : COLORS.text;
  ctx.fillText(world.mode === 'single' ? `${world.level.level}` : '1 v 1', x0 + CENTER_W - 16, 31);

  // Meteor warning strip (just below the HUD, over the map).
  if (world.meteorTimer < 3 && world.winner === null) {
    const blink = 0.55 + 0.45 * Math.sin(view.realTime * 14);
    const w = 300;
    ctx.globalAlpha = blink;
    ctx.beginPath();
    angledRectPath(ctx, cx - w / 2, HUD_TOP + 6, w, 22, 8);
    ctx.fillStyle = 'rgba(60,8,16,0.8)';
    ctx.fill();
    ctx.strokeStyle = COLORS.warning;
    ctx.stroke();
    ctx.font = font(12, 800);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd0d8';
    ctx.fillText(`⚠ METEOR SHOWER INBOUND · ${Math.max(0, world.meteorTimer).toFixed(1)}s`, cx, HUD_TOP + 17.5);
    ctx.globalAlpha = 1;
  }
}
