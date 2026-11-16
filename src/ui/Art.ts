import type { Team, TowerKind, UnitKind } from '../types';
import { COLORS, TEAM_COLORS } from '../core/config';
import { UNIT_DEFS } from '../data/units';
import { drawGlow, polygonPath, roundRectPath } from './theme';

/** Shared entity art (map entities and build-menu icons). All functions draw around the origin unless noted. */

function mixHex(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const r = Math.round(((na >> 16) & 255) * (1 - t) + ((nb >> 16) & 255) * t);
  const g = Math.round(((na >> 8) & 255) * (1 - t) + ((nb >> 8) & 255) * t);
  const bl = Math.round((na & 255) * (1 - t) + (nb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Body colors for slowed units (blue-white tint, still team-recognisable). */
export const SLOW_TINT: Record<Team, string> = {
  0: mixHex(TEAM_COLORS[0].main, '#e6fbff', 0.55),
  1: mixHex(TEAM_COLORS[1].main, '#dff6ff', 0.6),
};

const PLATE_FILL = '#121826';
const METAL = '#2a3346';
const METAL_LIGHT = '#3e4a63';

// ---------------------------------------------------------------- Towers

/** Draws a tower centered at the origin, sized for a 40 px tile. */
export function drawTowerArt(
  ctx: CanvasRenderingContext2D,
  kind: TowerKind,
  team: Team,
  level: number,
  angle: number,
  time: number,
  flash: number,
  pips = true,
): void {
  const pal = TEAM_COLORS[team];
  // Base plate.
  ctx.beginPath();
  roundRectPath(ctx, -16, -16, 32, 32, 6);
  ctx.fillStyle = PLATE_FILL;
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = pal.dark;
  ctx.fillRect(-12, -12, 24, 24);

  switch (kind) {
    case 'laser':
      drawLaser(ctx, team, level, angle, flash);
      break;
    case 'cannon':
      drawCannon(ctx, team, level, angle, flash);
      break;
    case 'cryo':
      drawCryo(ctx, team, level, time, flash);
      break;
    case 'refinery':
      drawRefinery(ctx, team, level, time, flash);
      break;
  }

  if (pips) {
    ctx.fillStyle = pal.bright;
    const n = level + 1;
    for (let i = 0; i < n; i++) {
      const px = -((n - 1) * 5) / 2 + i * 5;
      ctx.fillRect(px - 1.5, 12.5, 3, 3);
    }
  }
}

function drawLaser(ctx: CanvasRenderingContext2D, team: Team, level: number, angle: number, flash: number): void {
  const pal = TEAM_COLORS[team];
  ctx.save();
  ctx.rotate(angle);
  const len = 15 + level * 2;
  ctx.fillStyle = METAL_LIGHT;
  ctx.fillRect(2, -4.5, len - 2, 3);
  ctx.fillRect(2, 1.5, len - 2, 3);
  ctx.fillStyle = pal.bright;
  ctx.fillRect(len - 3, -4.5, 3, 3);
  ctx.fillRect(len - 3, 1.5, 3, 3);
  ctx.beginPath();
  ctx.moveTo(-8, -7);
  ctx.lineTo(6, -6);
  ctx.lineTo(9, 0);
  ctx.lineTo(6, 6);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fillStyle = METAL;
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = pal.main;
  ctx.fillRect(-5, -1.5, 8, 3);
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, pal.bright, len, -3, 8, Math.min(1, flash * 8));
    drawGlow(ctx, pal.bright, len, 3, 8, Math.min(1, flash * 8));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function drawCannon(ctx: CanvasRenderingContext2D, team: Team, level: number, angle: number, flash: number): void {
  const pal = TEAM_COLORS[team];
  ctx.beginPath();
  polygonPath(ctx, 0, 0, 12.5, 6, Math.PI / 6);
  ctx.fillStyle = METAL;
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.rotate(angle);
  // Missile pod.
  ctx.beginPath();
  roundRectPath(ctx, -6, -7.5, 18 + level, 15, 3);
  ctx.fillStyle = METAL_LIGHT;
  ctx.fill();
  ctx.strokeStyle = '#0a0d14';
  ctx.lineWidth = 1;
  ctx.stroke();
  const tubes = level >= 1 ? 3 : 2;
  for (let i = 0; i < tubes; i++) {
    const ty = tubes === 2 ? -3 + i * 6 : -4.5 + i * 4.5;
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath();
    ctx.arc(10 + level, ty, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.bright;
    ctx.fillRect(7 + level, ty - 0.6, 2, 1.2);
  }
  ctx.fillStyle = pal.main;
  ctx.fillRect(-4, -2, 6, 4);
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, COLORS.explosion, 14 + level, 0, 14, Math.min(1, flash * 4));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function drawCryo(ctx: CanvasRenderingContext2D, team: Team, level: number, time: number, flash: number): void {
  const pal = TEAM_COLORS[team];
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, COLORS.cryo, 0, 0, 18 + level * 2, 0.35 + Math.min(0.6, flash * 2));
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.rotate(time * 0.6);
  const arm = 10 + level * 1.5;
  ctx.strokeStyle = COLORS.cryo;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    ctx.moveTo(0, 0);
    ctx.lineTo(c * arm, s * arm);
    const bx = c * arm * 0.6, by = s * arm * 0.6;
    const pc = Math.cos(a + 0.7), ps = Math.sin(a + 0.7);
    const nc = Math.cos(a - 0.7), ns = Math.sin(a - 0.7);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + pc * 4, by + ps * 4);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + nc * 4, by + ns * 4);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
  ctx.beginPath();
  polygonPath(ctx, 0, 0, 5.5, 4, 0);
  ctx.fillStyle = '#e8fbff';
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawRefinery(ctx: CanvasRenderingContext2D, team: Team, level: number, time: number, flash: number): void {
  const pal = TEAM_COLORS[team];
  const ringR = 12 + level * 2.2;
  // Magnet ring segments.
  ctx.save();
  ctx.rotate(time * (1.2 + level * 0.5));
  ctx.strokeStyle = COLORS.thorium;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, a, a + 1.25);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Reactor.
  ctx.beginPath();
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
  ctx.fillStyle = METAL;
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const pulse = 0.55 + 0.45 * Math.sin(time * 4);
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, COLORS.thorium, 0, 0, 12, 0.4 + 0.3 * pulse + Math.min(0.6, flash * 2));
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.thoriumCore;
  ctx.fill();
}

// ---------------------------------------------------------------- Units

/**
 * Draws a unit body centered at the origin. `body` overrides the fill color (slow tint / hit flash).
 * The shielded unit's bubble is drawn by the caller.
 */
export function drawUnitArt(
  ctx: CanvasRenderingContext2D,
  kind: UnitKind,
  team: Team,
  angle: number,
  time: number,
  body: string | null = null,
  radius: number = UNIT_DEFS[kind].radius,
): void {
  const pal = TEAM_COLORS[team];
  const fill = body ?? pal.main;
  const r = radius;
  ctx.save();
  ctx.rotate(angle);
  if (kind === 'scout') {
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0);
    ctx.lineTo(-r, -r * 0.9);
    ctx.lineTo(-r * 0.45, 0);
    ctx.lineTo(-r, r * 0.9);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = pal.bright;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-r * 0.75, -1, r * 0.35 + 0.8 * Math.sin(time * 30), 2);
  } else if (kind === 'tank') {
    const L = r * 1.6;
    const W = r * 1.5;
    // Treads.
    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(-L / 2, -W / 2 - 2, L, 5);
    ctx.fillRect(-L / 2, W / 2 - 3, L, 5);
    ctx.fillStyle = '#4b566e';
    const off = (time * 14) % 5;
    for (let x = -L / 2 + off; x < L / 2; x += 5) {
      ctx.fillRect(x, -W / 2 - 2, 1.5, 5);
      ctx.fillRect(x, W / 2 - 3, 1.5, 5);
    }
    // Hull.
    ctx.beginPath();
    roundRectPath(ctx, -L / 2 + 1, -W / 2 + 3, L - 2, W - 6, 3);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#0a0d14';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 5, L - 6, 3);
    // Turret + barrel.
    ctx.fillStyle = pal.dark;
    ctx.fillRect(2, -2, r * 0.95, 4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = pal.dark;
    ctx.fill();
    ctx.strokeStyle = pal.bright;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.beginPath();
    polygonPath(ctx, 0, 0, r, 6, 0);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = pal.bright;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    polygonPath(ctx, 0, 0, r * 0.5, 6, 0);
    ctx.fillStyle = pal.dark;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r * 0.15, -1.5, r * 0.5, 3);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Thorium & drone

/** Glowing Thorium crystal cluster at (x, y). `size` ≈ 1. */
export function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, pulse: number, time: number, alpha = 1): void {
  const p = 0.5 + 0.5 * Math.sin(time * 3 + pulse);
  const s = 8 * size;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, COLORS.thorium, x, y, s * (2.1 + 0.6 * p), 0.45 + 0.3 * p);
  ctx.globalCompositeOperation = 'source-over';
  // Side shards.
  ctx.fillStyle = '#6fbf1f';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.9, y + s * 0.5);
  ctx.lineTo(x - s * 0.75, y - s * 0.35);
  ctx.lineTo(x - s * 0.2, y + s * 0.45);
  ctx.closePath();
  ctx.moveTo(x + s * 0.95, y + s * 0.45);
  ctx.lineTo(x + s * 0.7, y - s * 0.45);
  ctx.lineTo(x + s * 0.2, y + s * 0.5);
  ctx.closePath();
  ctx.fill();
  // Main shard.
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.1);
  ctx.lineTo(x + s * 0.48, y);
  ctx.lineTo(x, y + s * 0.65);
  ctx.lineTo(x - s * 0.48, y);
  ctx.closePath();
  ctx.fillStyle = COLORS.thorium;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.1);
  ctx.lineTo(x + s * 0.48, y);
  ctx.lineTo(x, y + s * 0.1);
  ctx.closePath();
  ctx.fillStyle = COLORS.thoriumCore;
  ctx.fill();
  ctx.globalAlpha = prev;
}

/** Small hovering collector drone at (x, y) with a downward tractor light. */
export function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, time: number, carrying: boolean): void {
  const pal = TEAM_COLORS[team];
  const by = y - 14 + Math.sin(time * 4 + team) * 1.5;
  // Tractor light cone.
  const grad = ctx.createLinearGradient(x, by, x, by + 22);
  grad.addColorStop(0, carrying ? 'rgba(200,255,120,0.45)' : 'rgba(180,240,255,0.32)');
  grad.addColorStop(1, 'rgba(180,240,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 3, by + 2);
  ctx.lineTo(x + 3, by + 2);
  ctx.lineTo(x + 10, by + 22);
  ctx.lineTo(x - 10, by + 22);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, pal.main, x, by, 16, 0.6);
  ctx.globalCompositeOperation = 'source-over';
  // Arms + rotors.
  ctx.strokeStyle = METAL_LIGHT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, by - 1);
  ctx.lineTo(x + 10, by - 1);
  ctx.stroke();
  const spin = Math.abs(Math.sin(time * 40));
  ctx.strokeStyle = pal.bright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x - 10, by - 3, 5 * spin + 1, 1.2, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 10, by - 3, 5 * (1 - spin) + 1, 1.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Body.
  ctx.beginPath();
  ctx.ellipse(x, by, 7.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1a2130';
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = pal.bright;
  ctx.fillRect(x - 2, by - 1, 4, 2);
}

/** Y of the drone body for a cursor at y (used to attach carried rocks). */
export function droneBodyY(y: number, team: Team, time: number): number {
  return y - 14 + Math.sin(time * 4 + team) * 1.5;
}
