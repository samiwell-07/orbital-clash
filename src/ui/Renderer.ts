import type { PlayerState, ThoriumRock, Tower, ViewState, World } from '../types';
import {
  BASE_BUILD_MARGIN,
  CANVAS_H,
  CANVAS_W,
  COLORS,
  HUD_TOP,
  MAP_H,
  MAP_W,
  SELL_REFUND,
  TEAM_COLORS,
  TILE,
} from '../core/config';
import { TOWER_DEFS, towerStats, upgradeCost } from '../data/towers';
import { SLOW_TINT, drawCrystal, drawDrone, drawTowerArt, drawUnitArt, droneBodyY } from './Art';
import { drawAttract, drawStarfield, getMapLayer } from './Background';
import { drawBuildMenu } from './BuildMenu';
import { drawHud } from './Hud';
import { drawMenu } from './MenuScreen';
import { angledRectPath, clamp01, drawGlow, easeOutBack, font, polygonPath, rgba, withGlow } from './theme';

/**
 * Draws everything to the canvas in LOGICAL coordinates (CANVAS_W x CANVAS_H).
 * The constructor sets the backing store to CANVAS_W*dpr x CANVAS_H*dpr; CSS sizing is done by main.ts.
 * `world` is null on the main menu (draw an animated attract background).
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr: number;
  private readonly towerMap = new Map<number, Tower>();

  constructor(public readonly canvas: HTMLCanvasElement) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.dpr = Math.min(2, Math.max(1, dpr));
    canvas.width = Math.round(CANVAS_W * this.dpr);
    canvas.height = Math.round(CANVAS_H * this.dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  render(world: World | null, view: ViewState): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = COLORS.space;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!world) {
      drawAttract(ctx, view.realTime);
      this.drawBanner(view);
      if (view.menu) drawMenu(ctx, view.menu, view);
      this.drawFps(view);
      return;
    }

    const sx = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
    const sy = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
    drawStarfield(ctx, view.realTime, sx * 0.3, sy * 0.3);

    this.towerMap.clear();
    for (const t of world.towers) this.towerMap.set(t.id, t);

    ctx.save();
    ctx.translate(sx, HUD_TOP + sy);
    const time = world.time;
    ctx.drawImage(getMapLayer(world.grid, this.dpr), 0, 0, MAP_W, MAP_H);
    this.drawBases(world, time);
    this.drawSpawns(world, time);
    this.drawRocks(world, time);
    this.drawTowers(world, time);
    this.drawUnits(world, time);
    this.drawProjectiles(world, time);
    this.drawFallingRocks(world, time);
    this.drawBeams(world);
    this.drawRings(world);
    this.drawParticles(world);
    this.drawTexts(world);
    this.drawCursors(world, view);
    ctx.restore();

    drawHud(ctx, world, view);
    drawBuildMenu(ctx, world, view);
    this.drawBanner(view);
    if (view.menu) {
      ctx.fillStyle = 'rgba(2,3,10,0.7)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawMenu(ctx, view.menu, view);
    }
    this.drawFps(view);
  }

  // ---------------------------------------------------------------- Map layers

  private drawBases(world: World, time: number): void {
    const ctx = this.ctx;
    for (const base of world.bases) {
      const pal = TEAM_COLORS[base.team];
      const frac = clamp01(base.hp / base.maxHp);
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.5 + base.team * 2);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, pal.main, base.x, base.y, 48, 0.25 + 0.2 * pulse * frac);
      if (base.hitFlash > 0) drawGlow(ctx, '#ffffff', base.x, base.y, 56, clamp01(base.hitFlash * 3));
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(time * 0.8 * (base.team === 0 ? 1 : -1));
      ctx.strokeStyle = rgba(pal.main, 0.8);
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 21, a, a + 1.4);
        ctx.stroke();
      }
      ctx.restore();

      // HP ring.
      const low = frac < 0.3;
      ctx.beginPath();
      ctx.arc(base.x, base.y, 27, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(base.x, base.y, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = low && Math.sin(time * 10) > 0 ? COLORS.warning : pal.main;
      ctx.stroke();

      ctx.beginPath();
      polygonPath(ctx, base.x, base.y, 13, 6, Math.PI / 6);
      ctx.fillStyle = pal.dark;
      ctx.fill();
      ctx.strokeStyle = pal.bright;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      polygonPath(ctx, base.x, base.y, 4 + 6 * frac * (0.85 + 0.15 * pulse), 6, Math.PI / 6);
      ctx.fillStyle = base.hitFlash > 0 ? '#ffffff' : pal.main;
      ctx.fill();
    }
  }

  private drawSpawns(world: World, time: number): void {
    const ctx = this.ctx;
    for (const player of world.players) {
      const pal = TEAM_COLORS[player.team];
      const dir = player.team === 0 ? 1 : -1;
      for (let i = 0; i < player.spawnCells.length; i++) {
        const c = player.spawnCells[i]!;
        const x = c.col * TILE;
        const y = c.row * TILE;
        ctx.fillStyle = rgba(pal.main, 0.05);
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        const a = 0.12 + 0.14 * (0.5 + 0.5 * Math.sin(time * 4 - i * 0.6));
        ctx.strokeStyle = rgba(pal.main, a);
        ctx.lineWidth = 2;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        ctx.beginPath();
        for (let k = 0; k < 2; k++) {
          const ox = (k * 9 - 4) * dir;
          ctx.moveTo(cx + ox - 4 * dir, cy - 6);
          ctx.lineTo(cx + ox + 3 * dir, cy);
          ctx.lineTo(cx + ox - 4 * dir, cy + 6);
        }
        ctx.stroke();
      }
    }
  }

  private drawRocks(world: World, time: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = 1.5;
    for (const rock of world.rocks) {
      if (!rock.alive) continue;
      if (rock.state === 'landed') {
        drawCrystal(ctx, rock.x, rock.y, rock.size, rock.pulse, time);
      } else if (rock.state === 'magnet') {
        const tower = rock.magnetTowerId !== null ? this.towerMap.get(rock.magnetTowerId) : undefined;
        if (tower) {
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = time * 40;
          ctx.strokeStyle = rgba(COLORS.thorium, 0.7);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(tower.x, tower.y);
          ctx.lineTo(rock.x, rock.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawCrystal(ctx, rock.x, rock.y, rock.size, rock.pulse, time * 2);
      }
    }
  }

  private drawTowers(world: World, time: number): void {
    const ctx = this.ctx;
    // Refinery magnet fields.
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = -time * 20;
    ctx.lineWidth = 1;
    for (const t of world.towers) {
      if (t.kind !== 'refinery') continue;
      const r = towerStats(t.kind, t.level).magnetRadius * TILE;
      ctx.strokeStyle = rgba(COLORS.thorium, 0.14);
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * Math.min(1, t.buildAnim * 1.5), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    for (const t of world.towers) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.buildAnim < 1) {
        const s = Math.max(0.05, easeOutBack(clamp01(t.buildAnim)));
        ctx.scale(s, s);
      }
      drawTowerArt(ctx, t.kind, t.team, t.level, t.angle, time, t.flash);
      if (t.kind === 'refinery' && t.refineQueue.length > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, 17.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(t.refineProgress));
        ctx.strokeStyle = COLORS.thoriumCore;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = COLORS.thorium;
        for (let i = 0; i < Math.min(5, t.refineQueue.length); i++) {
          const a = time * 3 + (i / Math.min(5, t.refineQueue.length)) * Math.PI * 2;
          ctx.fillRect(Math.cos(a) * 6 - 1.5, Math.sin(a) * 6 - 1.5, 3, 3);
        }
      }
      ctx.restore();
    }
  }

  private drawUnits(world: World, time: number): void {
    const ctx = this.ctx;
    const units = world.units;
    // Glow pass (one composite switch).
    ctx.globalCompositeOperation = 'lighter';
    for (const u of units) {
      if (!u.alive) continue;
      const pal = TEAM_COLORS[u.team];
      const r = u.kind === 'tank' ? 22 : u.kind === 'shielded' ? 20 : 14;
      drawGlow(ctx, u.slowTimer > 0 ? COLORS.cryo : pal.main, u.x, u.y, r, 0.45);
      if (u.hitFlash > 0) drawGlow(ctx, '#ffffff', u.x, u.y, r, clamp01(u.hitFlash * 6));
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const u of units) {
      if (!u.alive) continue;
      const pal = TEAM_COLORS[u.team];
      const body = u.hitFlash > 0 ? '#ffffff' : u.slowTimer > 0 ? SLOW_TINT[u.team] : null;
      const bob = u.kind === 'scout' ? Math.sin(u.age * 10) * 0.8 : 0;
      ctx.save();
      ctx.translate(u.x, u.y + bob);
      drawUnitArt(ctx, u.kind, u.team, u.angle, time + u.id, body);
      ctx.restore();
      const rad = u.kind === 'tank' ? 13 : u.kind === 'shielded' ? 10 : 7;

      if (u.maxShield > 0 && u.shield > 0) {
        const sf = clamp01(u.shield / u.maxShield);
        ctx.beginPath();
        ctx.arc(u.x, u.y, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(pal.bright, 0.1 + 0.12 * sf);
        ctx.fill();
        ctx.strokeStyle = rgba(pal.bright, 0.25 + 0.5 * sf);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(u.x, u.y, rad + 5, time * 2 + u.id, time * 2 + u.id + 0.9);
        ctx.strokeStyle = rgba('#ffffff', 0.5 * sf);
        ctx.stroke();
      }
      if (u.slowTimer > 0) {
        ctx.fillStyle = '#e8fbff';
        const a = time * 4 + u.id;
        ctx.fillRect(u.x + Math.cos(a) * (rad + 3) - 1, u.y + Math.sin(a) * (rad + 3) - 1, 2, 2);
      }

      // Bars.
      const bw = rad * 2 + 6;
      const bx = u.x - bw / 2;
      let by = u.y - rad - 9;
      if (u.hp < u.maxHp) {
        const f = clamp01(u.hp / u.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = f > 0.5 ? '#5dff7a' : f > 0.25 ? '#ffd23f' : '#ff3355';
        ctx.fillRect(bx, by, bw * f, 2);
        by -= 4;
      }
      if (u.maxShield > 0 && u.shield < u.maxShield) {
        const f = clamp01(u.shield / u.maxShield);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = '#9fdcff';
        ctx.fillRect(bx, by, bw * f, 2);
      }
    }
  }

  private drawProjectiles(world: World, time: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of world.projectiles) {
      if (!p.alive) continue;
      if (p.kind === 'cryo') {
        drawGlow(ctx, COLORS.cryo, p.x, p.y, 12, 0.9);
      } else {
        drawGlow(ctx, TEAM_COLORS[p.team].main, p.x, p.y, 12, 0.8);
        const tx = p.x - Math.cos(p.angle) * 9;
        const ty = p.y - Math.sin(p.angle) * 9;
        drawGlow(ctx, COLORS.explosion, tx, ty, 7 + Math.sin(time * 50) * 1.5, 0.9);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of world.projectiles) {
      if (!p.alive) continue;
      if (p.kind === 'cryo') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        polygonPath(ctx, p.x, p.y, 3.5, 4, time * 6);
        ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = '#c9d3e6';
      ctx.fillRect(-6, -1.8, 9, 3.6);
      ctx.fillStyle = TEAM_COLORS[p.team].bright;
      ctx.beginPath();
      ctx.moveTo(3, -2);
      ctx.lineTo(7, 0);
      ctx.lineTo(3, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = TEAM_COLORS[p.team].main;
      ctx.fillRect(-6, -3, 3, 6);
      ctx.restore();
    }
  }

  private drawFallingRocks(world: World, time: number): void {
    const ctx = this.ctx;
    for (const rock of world.rocks) {
      if (!rock.alive || rock.state !== 'falling') continue;
      const prog = rock.fallDuration > 0 ? clamp01(rock.fallTimer / rock.fallDuration) : 1;
      // Landing marker.
      const mr = 6 + 16 * (1 - prog);
      ctx.strokeStyle = rgba(COLORS.warning, 0.3 + 0.5 * prog);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rock.targetX, rock.targetY, mr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rock.targetX - 4, rock.targetY);
      ctx.lineTo(rock.targetX + 4, rock.targetY);
      ctx.moveTo(rock.targetX, rock.targetY - 4);
      ctx.lineTo(rock.targetX, rock.targetY + 4);
      ctx.stroke();

      // Streak trail.
      const ddx = rock.startX - rock.x;
      const ddy = rock.startY - rock.y;
      const dl = Math.hypot(ddx, ddy) || 1;
      const tl = Math.min(dl, 170);
      const tx = rock.x + (ddx / dl) * tl;
      const ty = rock.y + (ddy / dl) * tl;
      const g = ctx.createLinearGradient(rock.x, rock.y, tx, ty);
      g.addColorStop(0, 'rgba(244,255,154,0.95)');
      g.addColorStop(0.3, 'rgba(182,255,59,0.5)');
      g.addColorStop(1, 'rgba(182,255,59,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.lineWidth = 6 * rock.size;
      ctx.beginPath();
      ctx.moveTo(rock.x, rock.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(rock.x, rock.y);
      ctx.lineTo(rock.x + (tx - rock.x) * 0.25, rock.y + (ty - rock.y) * 0.25);
      ctx.stroke();
      ctx.lineCap = 'butt';
      drawGlow(ctx, COLORS.thorium, rock.x, rock.y, 22 * rock.size, 0.9);
      drawGlow(ctx, '#ffffff', rock.x, rock.y, 8 * rock.size, 1);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawBeams(world: World): void {
    if (world.beams.length === 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of world.beams) {
      const a = clamp01(b.life / b.maxLife);
      ctx.globalAlpha = a * 0.35;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width * 3.5;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = b.width;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, b.width * 0.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawGlow(ctx, b.color, b.x2, b.y2, 10 + b.width * 2, a);
      drawGlow(ctx, b.color, b.x1, b.y1, 6 + b.width, a * 0.8);
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRings(world: World): void {
    if (world.rings.length === 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const r of world.rings) {
      const a = clamp01(r.life / r.maxLife);
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1 + 3 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0, r.radius), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawParticles(world: World): void {
    const ctx = this.ctx;
    const pool = world.particles;
    ctx.globalCompositeOperation = 'lighter';
    let lastColor = '';
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]!;
      if (!p.active) continue;
      if (p.color !== lastColor) {
        ctx.fillStyle = p.color;
        lastColor = p.color;
      }
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a > 1 ? 1 : a;
      const s = p.size * (0.4 + 0.6 * a);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTexts(world: World): void {
    if (world.texts.length === 0) return;
    const ctx = this.ctx;
    ctx.font = font(13, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(2,3,10,0.85)';
    for (const t of world.texts) {
      const f = t.life / t.maxLife;
      ctx.globalAlpha = clamp01(f * 2.5);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- Cursors / drones

  private drawCursors(world: World, view: ViewState): void {
    for (const player of world.players) this.drawCursor(world, player, view);
  }

  private drawCursor(world: World, player: PlayerState, view: ViewState): void {
    const ctx = this.ctx;
    const cursor = player.cursor;
    const team = player.team;
    const pal = TEAM_COLORS[team];
    const time = view.realTime;
    const isAI = player.controller === 'ai';

    if (!isAI) this.drawReticle(world, player, time);

    // Carried rock + tractor beam.
    const carrying = cursor.carryingRockId !== null ? findRock(world, cursor.carryingRockId) : null;
    const bodyY = droneBodyY(cursor.y, team, time);
    if (carrying) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(COLORS.thorium, 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cursor.x, bodyY + 3);
      ctx.lineTo(carrying.x, carrying.y);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      drawCrystal(ctx, carrying.x, carrying.y, carrying.size, carrying.pulse, time * 1.5);
    }
    drawDrone(ctx, cursor.x, cursor.y, team, time, carrying !== null);

    if (world.mode === 'versus' || isAI) {
      const label = isAI ? 'AI' : team === 0 ? 'P1' : 'P2';
      ctx.font = font(9, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lx = cursor.x;
      const ly = bodyY - 13;
      ctx.fillStyle = 'rgba(2,3,10,0.7)';
      ctx.fillRect(lx - 10, ly - 6, 20, 12);
      ctx.fillStyle = pal.main;
      ctx.fillText(label, lx, ly + 0.5);
    }
  }

  private drawReticle(world: World, player: PlayerState, time: number): void {
    const ctx = this.ctx;
    const cursor = player.cursor;
    const team = player.team;
    const pal = TEAM_COLORS[team];
    const { col, row } = cursor;
    const grid = world.grid;
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return;
    const cell = grid.cells[row * grid.cols + col]!;
    const x = col * TILE;
    const y = row * TILE;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const fail = cursor.failFlash > 0;
    const color = fail ? COLORS.warning : pal.main;

    const tower = cell.towerId !== null ? this.towerMap.get(cell.towerId) : undefined;

    if (tower) {
      const own = tower.team === team;
      this.drawTowerRange(tower, own ? pal.main : COLORS.warning, own ? 0.5 : 0.25);
      if (own) this.drawTowerTooltip(tower, player);
    } else {
      // Ghost preview.
      const kind = player.selectedTower;
      const stats = towerStats(kind, 0);
      const ok =
        cell.type === 'empty' &&
        !nearBase(world, col, row) &&
        player.money >= stats.cost &&
        !rockAt(world, col, row);
      const rangeColor = ok ? pal.main : COLORS.warning;
      const range = (kind === 'refinery' ? stats.magnetRadius : stats.range) * TILE;
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, Math.PI * 2);
      ctx.fillStyle = rgba(rangeColor, 0.06);
      ctx.fill();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 20;
      ctx.strokeStyle = rgba(rangeColor, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      if (cell.type === 'empty') {
        ctx.save();
        ctx.globalAlpha = ok ? 0.5 : 0.28;
        ctx.translate(cx, cy);
        drawTowerArt(ctx, kind, team, 0, team === 0 ? 0 : Math.PI, time, 0, false);
        ctx.restore();
      }
      if (!ok) {
        ctx.strokeStyle = COLORS.warning;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 8);
        ctx.lineTo(cx + 8, cy + 8);
        ctx.moveTo(cx + 8, cy - 8);
        ctx.lineTo(cx - 8, cy + 8);
        ctx.stroke();
      }
    }

    // Cell tint + bracket reticle.
    ctx.fillStyle = rgba(color, fail ? 0.25 : 0.08);
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    const inset = 1 + Math.sin(time * 6) * 1.5;
    const L = 9;
    const x0 = x + inset;
    const y0 = y + inset;
    const x1 = x + TILE - inset;
    const y1 = y + TILE - inset;
    withGlow(ctx, color, 8, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + L);
      ctx.lineTo(x0, y0);
      ctx.lineTo(x0 + L, y0);
      ctx.moveTo(x1 - L, y0);
      ctx.lineTo(x1, y0);
      ctx.lineTo(x1, y0 + L);
      ctx.moveTo(x1, y1 - L);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - L, y1);
      ctx.moveTo(x0 + L, y1);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x0, y1 - L);
      ctx.stroke();
    });
  }

  private drawTowerRange(tower: Tower, color: string, alpha: number): void {
    const ctx = this.ctx;
    const stats = towerStats(tower.kind, tower.level);
    const range = (tower.kind === 'refinery' ? stats.magnetRadius : stats.range) * TILE;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, alpha * 0.12);
    ctx.fill();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawTowerTooltip(tower: Tower, player: PlayerState): void {
    const ctx = this.ctx;
    const pal = TEAM_COLORS[player.team];
    const p2 = player.controller === 'p2';
    const upKey = p2 ? 'NUM+' : 'R';
    const sellKey = p2 ? 'NUM-' : 'F';
    const up = upgradeCost(tower.kind, tower.level);
    const refund = Math.floor(tower.totalSpent * SELL_REFUND);
    const upText = up === null ? 'MAX' : `${upKey} upgrade $${up}`;
    const text = `${TOWER_DEFS[tower.kind].name.toUpperCase()} · LV ${tower.level + 1} · ${upText} · ${sellKey} sell $${refund}`;
    ctx.font = font(10, 700);
    const w = ctx.measureText(text).width + 20;
    const h = 20;
    let x = tower.x - w / 2;
    x = Math.max(4, Math.min(MAP_W - w - 4, x));
    let y = tower.y - TILE / 2 - h - 8;
    if (y < 4) y = tower.y + TILE / 2 + 8;
    ctx.beginPath();
    angledRectPath(ctx, x, y, w, h, 6);
    ctx.fillStyle = 'rgba(4,8,18,0.9)';
    ctx.fill();
    ctx.strokeStyle = pal.main;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const affordable = up !== null && player.money >= up;
    ctx.fillStyle = up === null ? '#ffd166' : affordable ? COLORS.text : COLORS.textDim;
    ctx.fillText(text, x + w / 2, y + h / 2 + 0.5);
  }

  // ---------------------------------------------------------------- Overlays

  private drawBanner(view: ViewState): void {
    const banner = view.banner;
    if (!banner || banner.time <= 0) return;
    const ctx = this.ctx;
    const a = clamp01(banner.time * 2.5);
    const cy = HUD_TOP + MAP_H * 0.36;
    ctx.save();
    ctx.globalAlpha = a;
    const band = ctx.createLinearGradient(0, 0, CANVAS_W, 0);
    band.addColorStop(0, 'rgba(2,3,10,0)');
    band.addColorStop(0.5, 'rgba(2,3,10,0.7)');
    band.addColorStop(1, 'rgba(2,3,10,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, cy - 38, CANVAS_W, 76);
    ctx.fillStyle = banner.color;
    ctx.fillRect(CANVAS_W * 0.25, cy - 38, CANVAS_W * 0.5, 1);
    ctx.fillRect(CANVAS_W * 0.25, cy + 37, CANVAS_W * 0.5, 1);
    ctx.font = font(42, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    withGlow(ctx, banner.color, 24, () => {
      ctx.fillStyle = banner.color;
      ctx.fillText(banner.text, CANVAS_W / 2, cy);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.globalAlpha = a * 0.5;
    ctx.fillText(banner.text, CANVAS_W / 2, cy);
    ctx.restore();
  }

  private drawFps(view: ViewState): void {
    const ctx = this.ctx;
    ctx.font = font(9, 600);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(125,138,166,0.6)';
    ctx.fillText(`${Math.round(view.fps)} FPS`, CANVAS_W - 6, HUD_TOP + MAP_H - 6);
  }
}

function findRock(world: World, id: number): ThoriumRock | null {
  for (const r of world.rocks) if (r.id === id && r.alive) return r;
  return null;
}

function rockAt(world: World, col: number, row: number): boolean {
  for (const r of world.rocks) {
    if (!r.alive) continue;
    const x = r.state === 'falling' ? r.targetX : r.x;
    const y = r.state === 'falling' ? r.targetY : r.y;
    if (r.state !== 'falling' && r.state !== 'landed') continue;
    if (Math.floor(x / TILE) === col && Math.floor(y / TILE) === row) return true;
  }
  return false;
}

function nearBase(world: World, col: number, row: number): boolean {
  for (const b of world.bases) {
    const dx = col < b.col ? b.col - col : col > b.col + b.w - 1 ? col - (b.col + b.w - 1) : 0;
    const dy = row < b.row ? b.row - row : row > b.row + b.h - 1 ? row - (b.row + b.h - 1) : 0;
    if (Math.max(dx, dy) <= BASE_BUILD_MARGIN) return true;
  }
  return false;
}

