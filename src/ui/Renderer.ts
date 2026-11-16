import type { PlayerState, ThoriumRock, Tower, TowerKind, UnitKind, ViewState, World } from '../types';
import { CANVAS_H, CANVAS_W, COLORS, MAP_H, MAP_W, MAP_X, MAP_Y, PALETTES, SELL_REFUND, TILE, paletteOf } from '../core/config';
import { P1_BINDINGS, P2_BINDINGS } from '../data/controls';
import type { KeyBindings } from '../data/controls';
import { TOWER_DEFS, towerStats, upgradeCost } from '../data/towers';
import { isNearBase } from '../systems/Grid';
import { rockFade } from '../systems/MeteorSystem';
import type { Sprite } from './Art';
import {
  blitRect,
  crystalSprite,
  drawShip,
  droneBodyY,
  fireballSprite,
  glowSpr,
  harvesterSprite,
  portalSprite,
  shieldSprite,
  streakSprite,
  towerBody,
  towerTop,
  towerTopFrame,
  TOP_FRAMES,
  unitShadow,
  unitFrame,
  UNIT_FRAMES,
} from './Art';
import { TERRAIN_H, TERRAIN_W, TERRAIN_X, drawAttract, drawStarfield, getTerrainLayer } from './Background';
import { drawMenu } from './MenuScreen';
import { drawSidebar } from './Sidebar';
import { angledRectPath, clamp01, easeOutBack, font, rgba } from './theme';

const TWO_PI = Math.PI * 2;
const KIND_INDEX: Record<UnitKind, number> = { scout: 0, tank: 1, shielded: 2, bomber: 3 };
const TOWER_INDEX: Record<TowerKind, number> = { laser: 0, cannon: 1, cryo: 2, plasma: 3, refinery: 4 };
/** Extra border around the cached tower layer (bodies and shadows overhang their tile). */
const LAYER_MARGIN = 10;
const P_MAX_COLORS = 48;
const P_ALPHA_LEVELS = 8;

/**
 * Draws everything to the canvas in LOGICAL coordinates (CANVAS_W x CANVAS_H).
 * The constructor sets the backing store to CANVAS_W*dpr x CANVAS_H*dpr; CSS sizing is done by main.ts.
 * `world` is null on the main menu (draws an animated attract background).
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly dpr: number;
  private readonly towerMap = new Map<number, Tower>();
  private readonly rockMap = new Map<number, ThoriumRock>();
  /** Current map origin in logical canvas px (includes shake). */
  private ox = MAP_X;
  private oy = MAP_Y;
  /** Particle bucketing scratch (no per-frame allocation). */
  private pNext = new Int32Array(0);
  private readonly pHead = new Int32Array(P_MAX_COLORS * P_ALPHA_LEVELS);
  private readonly pColors: string[] = [];
  private readonly pColorIndex = new Map<string, number>();
  /** Per-frame unit sprite lookup [team*12 + kind*3 + variant], reset each frame (palettes may change). */
  private readonly unitTable: (Sprite | undefined)[] = [];
  private readonly towerTable: (Sprite | undefined)[] = [];
  private readonly topTable: (Sprite | undefined)[] = [];
  private tLayer: HTMLCanvasElement | null = null;
  private tLayerKey = '';
  private tLayerGrid: World['grid'] | null = null;

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
    this.screenSpace();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (!world) {
      drawAttract(ctx, view.realTime, this.dpr);
      this.drawBanner(view);
      if (view.menu) drawMenu(ctx, view.menu, view);
      return;
    }

    drawStarfield(ctx, view.realTime, this.dpr);
    const sx = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
    const sy = world.shake > 0 ? (Math.random() * 2 - 1) * world.shake : 0;
    ctx.drawImage(getTerrainLayer(world, this.dpr), TERRAIN_X + sx, sy, TERRAIN_W, TERRAIN_H);

    this.towerMap.clear();
    for (const t of world.towers) this.towerMap.set(t.id, t);
    this.rockMap.clear();
    for (const r of world.rocks) if (r.alive) this.rockMap.set(r.id, r);
    this.unitTable.length = 0;
    this.towerTable.length = 0;
    this.topTable.length = 0;

    this.ox = MAP_X + sx;
    this.oy = MAP_Y + sy;
    this.mapSpace();
    const time = world.time;
    this.drawSpawns(world, view.realTime);
    this.drawPortals(world, view.realTime);
    this.drawRocks(world, time);
    this.drawTowers(world, time);
    this.drawHarvesters(world, time);
    this.drawUnits(world, false);
    this.drawUnits(world, true);
    this.drawProjectiles(world);
    this.drawFallingRocks(world);
    this.drawBeams(world);
    this.drawRings(world);
    this.drawParticles(world);
    this.drawTexts(world);
    this.drawCursors(world, view);

    this.screenSpace();
    drawSidebar(ctx, world, view);
    this.drawBanner(view);
    if (view.menu) {
      ctx.fillStyle = 'rgba(3,2,10,0.72)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawMenu(ctx, view.menu, view);
    }
  }

  // ---------------------------------------------------------------- Transforms

  private screenSpace(): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private mapSpace(): void {
    const d = this.dpr;
    this.ctx.setTransform(d, 0, 0, d, this.ox * d, this.oy * d);
  }

  /** Draws a sprite centered at map (x, y), rotated by `angle`. Leaves a rotated transform: call mapSpace() after a batch. */
  private rot(s: Sprite, x: number, y: number, angle: number, scale = 1): void {
    const d = this.dpr * scale;
    const c = Math.cos(angle) * d;
    const sn = Math.sin(angle) * d;
    this.ctx.setTransform(c, sn, -sn, c, (this.ox + x) * this.dpr, (this.oy + y) * this.dpr);
    this.ctx.drawImage(s.canvas, s.sx, s.sy, s.sw, s.sh, -s.w / 2, -s.h / 2, s.w, s.h);
  }

  /** Cached body (part 0) or top (part 1) sprite of a tower via the per-frame table. */
  private towerSprite(world: World, t: Tower, part: 0 | 1): Sprite {
    const k = ((t.team * 5 + TOWER_INDEX[t.kind]) * 3 + t.level) * 2 + part;
    let s = this.towerTable[k];
    if (!s) {
      const palKey = world.players[t.team].palette;
      s = part === 0 ? towerBody(t.kind, t.level, palKey) : towerTop(t.kind, t.level, palKey);
      this.towerTable[k] = s;
    }
    return s;
  }

  /** Map-sized cache of every finished tower body. */
  private towerLayer(world: World): HTMLCanvasElement {
    let h1 = world.towers.length;
    let h2 = 0;
    for (const t of world.towers) {
      if (t.buildAnim < 1) {
        h1 = (h1 * 17 + 1) | 0;
        continue;
      }
      h1 = (h1 * 31 + t.id * 4 + t.level) | 0;
      h2 = (h2 + (t.id + 1) * (t.level + 1) * 7919 + TOWER_INDEX[t.kind] * 101 + t.team) | 0;
    }
    const key = `${h1}|${h2}|${world.players[0].palette}|${world.players[1].palette}`;
    let c = this.tLayer;
    if (c && this.tLayerKey === key && this.tLayerGrid === world.grid) return c;
    const d = this.dpr;
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.round((MAP_W + LAYER_MARGIN * 2) * d);
      c.height = Math.round((MAP_H + LAYER_MARGIN * 2) * d);
      this.tLayer = c;
    }
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.setTransform(d, 0, 0, d, LAYER_MARGIN * d, LAYER_MARGIN * d);
      for (const t of world.towers) {
        if (t.buildAnim < 1) continue;
        const s = this.towerSprite(world, t, 0);
        blitRect(g, s, t.x - s.w / 2, t.y - s.h / 2, s.w, s.h);
      }
    }
    this.tLayerKey = key;
    this.tLayerGrid = world.grid;
    return c;
  }

  // ---------------------------------------------------------------- Map layers

  private drawSpawns(world: World, time: number): void {
    const ctx = this.ctx;
    ctx.lineWidth = 2;
    for (const player of world.players) {
      const pal = paletteOf(player);
      const dir = player.team === 0 ? 1 : -1;
      for (let i = 0; i < player.spawnCells.length; i++) {
        const c = player.spawnCells[i]!;
        const cx = c.col * TILE + TILE / 2;
        const cy = c.row * TILE + TILE / 2;
        ctx.strokeStyle = rgba(pal.main, 0.12 + 0.14 * (0.5 + 0.5 * Math.sin(time * 4 - i * 0.6)));
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

  private drawPortals(world: World, time: number): void {
    const ctx = this.ctx;
    for (const base of world.bases) {
      const palKey = world.players[base.team].palette;
      const pal = PALETTES[palKey];
      const frac = clamp01(base.hp / base.maxHp);
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.5 + base.team * 2);
      const spin = base.team === 0 ? 1 : -1;
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, pal.main, base.x, base.y, 62, 0.3 + 0.25 * pulse * (0.4 + 0.6 * frac));
      const ps = portalSprite(palKey);
      ctx.globalAlpha = 0.55 + 0.35 * frac;
      this.rot(ps, base.x, base.y, time * 1.3 * spin, 0.68);
      ctx.globalAlpha = 0.45;
      this.rot(ps, base.x, base.y, -time * 0.8 * spin + 1, 0.45);
      this.mapSpace();
      ctx.globalAlpha = 1;
      drawGlow(ctx, pal.bright, base.x, base.y, 16 + 4 * pulse, 0.9);
      drawGlow(ctx, '#ffffff', base.x, base.y, 7, 0.9);
      if (base.hitFlash > 0) drawGlow(ctx, '#ffffff', base.x, base.y, 60, clamp01(base.hitFlash * 3));
      ctx.globalCompositeOperation = 'source-over';
      // HP arc.
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(base.x, base.y, 38, 0, TWO_PI);
      ctx.stroke();
      ctx.strokeStyle = frac < 0.3 && Math.sin(time * 10) > 0 ? COLORS.warning : COLORS.health;
      ctx.beginPath();
      ctx.arc(base.x, base.y, 38, -Math.PI / 2, -Math.PI / 2 + TWO_PI * frac);
      ctx.stroke();
    }
  }

  private drawRocks(world: World, time: number): void {
    const ctx = this.ctx;
    // Magnet tethers (one dashed batch).
    let any = false;
    ctx.beginPath();
    for (const rock of world.rocks) {
      if (!rock.alive || rock.state !== 'magnet' || rock.magnetTowerId === null) continue;
      const tower = this.towerMap.get(rock.magnetTowerId);
      if (!tower) continue;
      ctx.moveTo(tower.x, tower.y);
      ctx.lineTo(rock.x, rock.y);
      any = true;
    }
    if (any) {
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -time * 40;
      ctx.strokeStyle = rgba(COLORS.thorium, 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Pulsing glow pass, then the crystal clusters.
    ctx.globalCompositeOperation = 'lighter';
    const glow = glowSpr(COLORS.thorium);
    for (const rock of world.rocks) {
      if (!rock.alive || (rock.state !== 'landed' && rock.state !== 'magnet')) continue;
      const fade = rockFade(world, rock);
      const p = 0.5 + 0.5 * Math.sin(time * 3 + rock.pulse);
      const r = 17 * rock.size * (1 + 0.25 * p);
      ctx.globalAlpha = (0.35 + 0.35 * p) * fade;
      blitRect(ctx, glow, rock.x - r, rock.y - r - 3, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (const rock of world.rocks) {
      if (!rock.alive || (rock.state !== 'landed' && rock.state !== 'magnet')) continue;
      const s = crystalSprite(rock.id);
      const sc = 0.85 * rock.size;
      ctx.globalAlpha = rockFade(world, rock);
      blitRect(ctx, s, rock.x - (s.w * sc) / 2, rock.y - (s.h * sc) / 2 - 3, s.w * sc, s.h * sc);
    }
    ctx.globalAlpha = 1;
  }

  private drawTowers(world: World, time: number): void {
    const ctx = this.ctx;
    const towers = world.towers;
    // Harvest Station magnet fields.
    ctx.setLineDash([4, 8]);
    ctx.lineDashOffset = -time * 20;
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(COLORS.thorium, 0.16);
    ctx.beginPath();
    for (const t of towers) {
      if (t.kind !== 'refinery') continue;
      const r = towerStats(t.kind, t.level).magnetRadius * TILE * Math.min(1, t.buildAnim * 1.5);
      ctx.moveTo(t.x + r, t.y);
      ctx.arc(t.x, t.y, r, 0, TWO_PI);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Finished bodies come from a cached layer (rebuilt only when the tower set changes); growing ones are live.
    const layer = this.towerLayer(world);
    ctx.drawImage(layer, -LAYER_MARGIN, -LAYER_MARGIN, MAP_W + LAYER_MARGIN * 2, MAP_H + LAYER_MARGIN * 2);
    for (const t of towers) {
      if (t.buildAnim >= 1) continue;
      const sc = Math.max(0.05, easeOutBack(clamp01(t.buildAnim)));
      this.rot(this.towerSprite(world, t, 0), t.x, t.y, 0, sc);
    }
    this.mapSpace();
    // Tops: pre-rotated frames (no per-tower setTransform) except while growing.
    for (const t of towers) {
      let a = t.angle;
      if (t.kind === 'refinery') a = time * (1.2 + t.level * 0.5) + t.id;
      else if (t.kind === 'cryo') a = time * 0.5 + t.id;
      if (t.buildAnim < 1) {
        this.rot(this.towerSprite(world, t, 1), t.x, t.y, a, Math.max(0.05, easeOutBack(clamp01(t.buildAnim))));
        this.mapSpace();
        continue;
      }
      const frame = ((Math.round((a / TWO_PI) * TOP_FRAMES) % TOP_FRAMES) + TOP_FRAMES) % TOP_FRAMES;
      const k = ((t.team * 5 + TOWER_INDEX[t.kind]) * 3 + t.level) * TOP_FRAMES + frame;
      let s = this.topTable[k];
      if (!s) {
        s = towerTopFrame(t.kind, t.level, world.players[t.team].palette, frame);
        this.topTable[k] = s;
      }
      ctx.drawImage(s.canvas, s.sx, s.sy, s.sw, s.sh, t.x - s.w / 2, t.y - s.h / 2, s.w, s.h);
    }

    // Additive muzzle flashes (only while firing; level-3 glow is baked into the body sprite).
    ctx.globalCompositeOperation = 'lighter';
    for (const t of towers) {
      if (t.flash <= 0) continue;
      const f = Math.min(1, t.flash * 6);
      const c = Math.cos(t.angle);
      const s = Math.sin(t.angle);
      switch (t.kind) {
        case 'laser':
          drawGlow(ctx, COLORS.laser, t.x + c * 15, t.y + s * 15, 10, f);
          break;
        case 'cannon':
          drawGlow(ctx, COLORS.fireball, t.x + c * 19, t.y + s * 19, 16, f);
          break;
        case 'plasma':
          drawGlow(ctx, COLORS.plasma, t.x + c * 17, t.y + s * 17, 12, f);
          break;
        case 'cryo':
          drawGlow(ctx, COLORS.cryo, t.x, t.y, 26, f);
          break;
        case 'refinery':
          drawGlow(ctx, COLORS.thorium, t.x, t.y, 22, f);
          break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Refining progress.
    for (const t of towers) {
      if (t.kind !== 'refinery' || t.refineQueue.length === 0) continue;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 9, -Math.PI / 2, -Math.PI / 2 + TWO_PI * clamp01(t.refineProgress));
      ctx.strokeStyle = COLORS.thoriumCore;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.thorium;
      const n = Math.min(5, t.refineQueue.length);
      for (let i = 0; i < n; i++) {
        const a = time * 3 + (i / n) * TWO_PI;
        ctx.fillRect(t.x + Math.cos(a) * 5 - 1.5, t.y + Math.sin(a) * 5 - 1.5, 3, 3);
      }
    }
  }

  private drawHarvesters(world: World, time: number): void {
    if (world.harvesters.length === 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const h of world.harvesters) {
      if (!h.alive) continue;
      drawGlow(ctx, paletteOf(world.players[h.team]).main, h.x, h.y, 10, 0.45);
      if (h.cargo.length > 0) drawGlow(ctx, COLORS.thorium, h.x, h.y + 6, 10, 0.8);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const h of world.harvesters) {
      if (!h.alive || h.cargo.length === 0) continue;
      const s = crystalSprite(h.cargo[0]!);
      blitRect(ctx, s, h.x - s.w * 0.22, h.y + 6 - s.h * 0.22, s.w * 0.44, s.h * 0.44);
    }
    for (const h of world.harvesters) {
      if (!h.alive) continue;
      this.rot(harvesterSprite(world.players[h.team].palette), h.x, h.y + Math.sin(time * 5 + h.id) * 0.8, h.angle);
    }
    this.mapSpace();
  }

  private drawUnits(world: World, air: boolean): void {
    const ctx = this.ctx;
    const units = world.units;
    const p0 = world.players[0].palette;
    const p1 = world.players[1].palette;
    let count = 0;
    for (let i = 0; i < units.length; i++) {
      const u = units[i]!;
      if (u.alive && u.air === air) count++;
    }
    if (count === 0) return;

    if (air) {
      for (let i = 0; i < units.length; i++) {
        const u = units[i]!;
        if (!u.alive || !u.air) continue;
        this.rot(unitShadow(u.kind), u.x + 8, u.y + 12, u.angle, 0.9);
      }
    }
    for (let i = 0; i < units.length; i++) {
      const u = units[i]!;
      if (!u.alive || u.air !== air) continue;
      const variant = u.hitFlash > 0 ? 2 : u.slowTimer > 0 ? 1 : 0;
      const frame = ((Math.round((u.angle / TWO_PI) * UNIT_FRAMES) % UNIT_FRAMES) + UNIT_FRAMES) % UNIT_FRAMES;
      const k = ((u.team * 4 + KIND_INDEX[u.kind]) * 3 + variant) * UNIT_FRAMES + frame;
      let s = this.unitTable[k];
      if (!s) {
        s = unitFrame(u.kind, u.team === 0 ? p0 : p1, variant, frame);
        this.unitTable[k] = s;
      }
      ctx.drawImage(s.canvas, s.sx, s.sy, s.sw, s.sh, u.x - s.w / 2, u.y - s.h / 2, s.w, s.h);
    }
    this.mapSpace();

    // Shields and HP bars (big units only).
    for (let i = 0; i < units.length; i++) {
      const u = units[i]!;
      if (!u.alive || u.air !== air) continue;
      if (u.maxShield > 0 && u.shield > 0) {
        const s = shieldSprite(u.team === 0 ? p0 : p1);
        ctx.globalAlpha = 0.35 + 0.65 * clamp01(u.shield / u.maxShield);
        blitRect(ctx, s, u.x - s.w / 2, u.y - s.h / 2, s.w, s.h);
        ctx.globalAlpha = 1;
      }
      if ((u.kind === 'tank' || u.kind === 'bomber') && u.hp < u.maxHp) {
        const f = clamp01(u.hp / u.maxHp);
        const bw = u.kind === 'tank' ? 16 : 18;
        const bx = u.x - bw / 2;
        const by = u.y - (u.kind === 'tank' ? 13 : 15);
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
        ctx.fillStyle = f > 0.5 ? '#5dff7a' : f > 0.25 ? '#ffd23f' : '#ff3355';
        ctx.fillRect(bx, by, bw * f, 2);
      }
    }
  }

  private drawProjectiles(world: World): void {
    if (world.projectiles.length === 0) return;
    const ctx = this.ctx;
    const fb = fireballSprite();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of world.projectiles) {
      if (!p.alive) continue;
      const c = Math.cos(p.angle);
      const s = Math.sin(p.angle);
      for (let k = 3; k >= 1; k--) {
        const r = 9 - k * 1.8;
        ctx.globalAlpha = 0.55 - k * 0.12;
        blitRect(ctx, fb, p.x - c * k * 6 - r, p.y - s * k * 6 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      blitRect(ctx, fb, p.x - 10, p.y - 10, 20, 20);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawFallingRocks(world: World): void {
    const ctx = this.ctx;
    let any = false;
    ctx.lineWidth = 1.5;
    for (const rock of world.rocks) {
      if (!rock.alive || rock.state !== 'falling') continue;
      any = true;
      const prog = rock.fallDuration > 0 ? clamp01(rock.fallTimer / rock.fallDuration) : 1;
      const mr = 6 + 16 * (1 - prog);
      ctx.strokeStyle = rgba(COLORS.warning, 0.3 + 0.5 * prog);
      ctx.beginPath();
      ctx.arc(rock.targetX, rock.targetY, mr, 0, TWO_PI);
      ctx.moveTo(rock.targetX - 4, rock.targetY);
      ctx.lineTo(rock.targetX + 4, rock.targetY);
      ctx.moveTo(rock.targetX, rock.targetY - 4);
      ctx.lineTo(rock.targetX, rock.targetY + 4);
      ctx.stroke();
    }
    if (!any) return;
    const streak = streakSprite();
    ctx.globalCompositeOperation = 'lighter';
    for (const rock of world.rocks) {
      if (!rock.alive || rock.state !== 'falling') continue;
      const a = Math.atan2(rock.targetY - rock.startY, rock.targetX - rock.startX);
      const sc = rock.size;
      this.rot(streak, rock.x - Math.cos(a) * 90 * sc, rock.y - Math.sin(a) * 90 * sc, a, sc);
    }
    this.mapSpace();
    for (const rock of world.rocks) {
      if (!rock.alive || rock.state !== 'falling') continue;
      drawGlow(ctx, COLORS.thorium, rock.x, rock.y, 22 * rock.size, 0.9);
      drawGlow(ctx, '#ffffff', rock.x, rock.y, 8 * rock.size, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBeams(world: World): void {
    if (world.beams.length === 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of world.beams) {
      const a = clamp01(b.life / b.maxLife);
      if (b.style === 'plasma') {
        // Jittery thick stream: 4 segments with random perpendicular offsets.
        const dx = b.x2 - b.x1;
        const dy = b.y2 - b.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        for (let k = 1; k < 4; k++) {
          const j = (Math.random() - 0.5) * b.width * 1.4;
          ctx.lineTo(b.x1 + (dx * k) / 4 + nx * j, b.y1 + (dy * k) / 4 + ny * j);
        }
        ctx.lineTo(b.x2, b.y2);
        ctx.globalAlpha = a * 0.3;
        ctx.strokeStyle = COLORS.fireball;
        ctx.lineWidth = b.width * 3;
        ctx.stroke();
        ctx.globalAlpha = a * 0.85;
        ctx.strokeStyle = COLORS.plasma;
        ctx.lineWidth = b.width * 1.3;
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.strokeStyle = COLORS.plasmaCore;
        ctx.lineWidth = Math.max(1, b.width * 0.45);
        ctx.stroke();
        ctx.globalAlpha = 1;
        drawGlow(ctx, COLORS.plasma, b.x2, b.y2, 9 + b.width * 2, a);
      } else {
        ctx.beginPath();
        ctx.moveTo(b.x1, b.y1);
        ctx.lineTo(b.x2, b.y2);
        ctx.globalAlpha = a * 0.3;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = b.width * 3.5;
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.lineWidth = b.width;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.8, b.width * 0.35);
        ctx.stroke();
        ctx.globalAlpha = 1;
        drawGlow(ctx, b.color, b.x2, b.y2, 7 + b.width * 2, a);
      }
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawRings(world: World): void {
    if (world.rings.length === 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < world.rings.length; i++) {
      const r = world.rings[i]!;
      const a = clamp01(r.life / r.maxLife);
      const rad = Math.max(0, r.radius);
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1 + 3 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TWO_PI);
      ctx.stroke();
      if (r.color === COLORS.cryo) {
        // Icy shimmer: a soft halo and sparkles riding the frost front.
        ctx.globalAlpha = a * 0.25;
        ctx.lineWidth = 6 * a + 2;
        ctx.stroke();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#eafcff';
        const n = 10;
        const spin = i * 0.7 + rad * 0.02;
        for (let k = 0; k < n; k++) {
          const ang = spin + (k / n) * TWO_PI;
          const jr = rad + ((k * 7) % 5) - 2;
          ctx.fillRect(r.x + Math.cos(ang) * jr - 1, r.y + Math.sin(ang) * jr - 1, 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawParticles(world: World): void {
    const ctx = this.ctx;
    const pool = world.particles;
    const n = pool.length;
    if (this.pNext.length < n) this.pNext = new Int32Array(n);
    const head = this.pHead;
    head.fill(-1);
    const next = this.pNext;
    // Bucket particles by (color, quantized alpha) so state changes happen once per bucket.
    for (let i = 0; i < n; i++) {
      const p = pool[i]!;
      if (!p.active) continue;
      let ci = this.pColorIndex.get(p.color);
      if (ci === undefined) {
        if (this.pColors.length >= P_MAX_COLORS) ci = 0;
        else {
          ci = this.pColors.length;
          this.pColors.push(p.color);
          this.pColorIndex.set(p.color, ci);
        }
      }
      const a = p.life / p.maxLife;
      const level = a >= 1 ? P_ALPHA_LEVELS - 1 : Math.floor(a * P_ALPHA_LEVELS);
      const b = ci * P_ALPHA_LEVELS + level;
      next[i] = head[b]!;
      head[b] = i;
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < head.length; b++) {
      let i = head[b]!;
      if (i < 0) continue;
      const level = b % P_ALPHA_LEVELS;
      ctx.fillStyle = this.pColors[(b - level) / P_ALPHA_LEVELS]!;
      ctx.globalAlpha = (level + 0.5) / P_ALPHA_LEVELS;
      while (i >= 0) {
        const p = pool[i]!;
        const a = p.life / p.maxLife;
        const s = p.size * (0.4 + 0.6 * (a > 1 ? 1 : a));
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        i = next[i]!;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTexts(world: World): void {
    if (world.texts.length === 0) return;
    const ctx = this.ctx;
    ctx.font = font(12, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(2,3,10,0.85)';
    for (const t of world.texts) {
      ctx.globalAlpha = clamp01((t.life / t.maxLife) * 2.5);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- Cursors / ships

  private drawCursors(world: World, view: ViewState): void {
    for (const player of world.players) this.drawCursor(world, player, view);
  }

  private drawCursor(world: World, player: PlayerState, view: ViewState): void {
    const ctx = this.ctx;
    const cursor = player.cursor;
    const pal = paletteOf(player);
    const time = view.realTime;
    const isAI = player.controller === 'ai';

    if (!isAI) this.drawReticle(world, player, time);

    const carrying = cursor.carryingRockId !== null ? this.rockMap.get(cursor.carryingRockId) ?? null : null;
    const bodyY = droneBodyY(cursor.y, player.team, time);
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
      drawGlow(ctx, COLORS.thorium, carrying.x, carrying.y, 16, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      const s = crystalSprite(carrying.id);
      blitRect(ctx, s, carrying.x - s.w * 0.4, carrying.y - s.h * 0.4, s.w * 0.8, s.h * 0.8);
    }
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, pal.main, cursor.x, bodyY, 16, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    drawShip(ctx, cursor.x, cursor.y, pal, player.team, time, carrying !== null);

    if (world.mode === 'versus' || isAI) {
      const label = isAI ? 'AI' : player.team === 0 ? 'P1' : 'P2';
      ctx.font = font(9, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ly = bodyY - 13;
      ctx.fillStyle = 'rgba(3,2,10,0.75)';
      ctx.fillRect(cursor.x - 10, ly - 6, 20, 12);
      ctx.fillStyle = pal.main;
      ctx.fillText(label, cursor.x, ly + 0.5);
    }
  }

  private drawReticle(world: World, player: PlayerState, time: number): void {
    const ctx = this.ctx;
    const cursor = player.cursor;
    const pal = paletteOf(player);
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
      const own = tower.team === player.team;
      this.drawTowerRange(tower, own ? pal.main : COLORS.warning, own ? 0.5 : 0.25);
      if (own) this.drawTowerTooltip(tower, player);
    } else {
      const kind = player.selectedTower;
      const stats = towerStats(kind, 0);
      const ok = cell.type === 'empty' && !isNearBase(col, row) && player.money >= stats.cost && !rockOnCell(world, col, row);
      const rangeColor = ok ? pal.main : COLORS.warning;
      const range = (kind === 'refinery' ? stats.magnetRadius : stats.range) * TILE;
      ctx.beginPath();
      ctx.arc(cx, cy, range, 0, TWO_PI);
      ctx.fillStyle = rgba(rangeColor, 0.06);
      ctx.fill();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 20;
      ctx.strokeStyle = rgba(rangeColor, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      if (cell.type === 'empty') {
        ctx.globalAlpha = ok ? 0.55 : 0.3;
        const b = towerBody(kind, 0, player.palette);
        blitRect(ctx, b, cx - b.w / 2, cy - b.h / 2, b.w, b.h);
        this.rot(towerTop(kind, 0, player.palette), cx, cy, player.team === 0 ? 0 : Math.PI);
        this.mapSpace();
        ctx.globalAlpha = 1;
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

    ctx.fillStyle = rgba(color, fail ? 0.25 : 0.08);
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    const inset = 1 + Math.sin(time * 6) * 1.5;
    const L = 9;
    const x0 = x + inset;
    const y0 = y + inset;
    const x1 = x + TILE - inset;
    const y1 = y + TILE - inset;
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
    ctx.strokeStyle = rgba(color, 0.3);
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawTowerRange(tower: Tower, color: string, alpha: number): void {
    const ctx = this.ctx;
    const stats = towerStats(tower.kind, tower.level);
    const range = (tower.kind === 'refinery' ? stats.magnetRadius : stats.range) * TILE;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, range, 0, TWO_PI);
    ctx.fillStyle = rgba(color, alpha * 0.12);
    ctx.fill();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawTowerTooltip(tower: Tower, player: PlayerState): void {
    const ctx = this.ctx;
    const pal = paletteOf(player);
    const binds: KeyBindings = player.controller === 'p2' ? P2_BINDINGS : P1_BINDINGS;
    const upKey = binds.slots.find((s) => s.action.type === 'upgrade')?.label ?? '?';
    const sellKey = binds.slots.find((s) => s.action.type === 'sell')?.label ?? '?';
    const up = upgradeCost(tower.kind, tower.level);
    const refund = Math.floor(tower.totalSpent * SELL_REFUND);
    const needsResearch = tower.level === 1 && !player.researched.maxLevel3;
    const title = `${TOWER_DEFS[tower.kind].name.toUpperCase()} · LV ${tower.level + 1}`;
    const upText = up === null ? 'MAX LEVEL' : `[${upKey}] UPGRADE $${up}`;
    const sellText = `[${sellKey}] SELL +$${refund} (75%)`;
    const upColor = up === null ? '#ffd166' : !needsResearch && player.money >= up ? COLORS.text : COLORS.textDim;
    const lines: [string, string][] = [
      [title, pal.bright],
      [upText, upColor],
      [sellText, COLORS.money],
    ];
    if (needsResearch) lines.push(['LV3 needs research', COLORS.research]);
    ctx.font = font(9, 700);
    let w = 0;
    for (const [t] of lines) w = Math.max(w, ctx.measureText(t).width);
    w += 16;
    const lh = 12;
    const h = lines.length * lh + 8;
    const x = Math.max(4, Math.min(MAP_W - w - 4, tower.x - w / 2));
    let y = tower.y - TILE / 2 - h - 8;
    if (y < 4) y = tower.y + TILE / 2 + 8;
    ctx.beginPath();
    angledRectPath(ctx, x, y, w, h, 5);
    ctx.fillStyle = 'rgba(8,6,18,0.92)';
    ctx.fill();
    ctx.strokeStyle = pal.main;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < lines.length; i++) {
      const [t, c] = lines[i]!;
      ctx.fillStyle = c;
      ctx.fillText(t, x + 8, y + 4 + lh / 2 + i * lh + 0.5);
    }
  }

  // ---------------------------------------------------------------- Overlays

  private drawBanner(view: ViewState): void {
    const banner = view.banner;
    if (!banner || banner.time <= 0) return;
    const ctx = this.ctx;
    const a = clamp01(banner.time * 2.5);
    const cx = MAP_X + MAP_W / 2;
    const cy = MAP_Y + MAP_H * 0.36;
    const x0 = MAP_X;
    ctx.globalAlpha = a;
    const band = ctx.createLinearGradient(x0, 0, x0 + MAP_W, 0);
    band.addColorStop(0, 'rgba(3,2,10,0)');
    band.addColorStop(0.5, 'rgba(3,2,10,0.75)');
    band.addColorStop(1, 'rgba(3,2,10,0)');
    ctx.fillStyle = band;
    ctx.fillRect(x0, cy - 38, MAP_W, 76);
    ctx.fillStyle = banner.color;
    ctx.fillRect(x0 + MAP_W * 0.25, cy - 38, MAP_W * 0.5, 1);
    ctx.fillRect(x0 + MAP_W * 0.25, cy + 37, MAP_W * 0.5, 1);
    ctx.font = font(42, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = banner.color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text, cx, cy);
    ctx.restore();
    ctx.globalAlpha = a * 0.5;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(banner.text, cx, cy);
    ctx.globalAlpha = 1;
  }
}

/** Additive-friendly cached glow of adius px at (x, y); the caller picks the composite mode. */
function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number, alpha = 1): void {
  if (alpha <= 0 || radius <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, alpha);
  blitRect(ctx, glowSpr(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

function rockOnCell(world: World, col: number, row: number): boolean {
  for (const r of world.rocks) {
    if (!r.alive || (r.state !== 'falling' && r.state !== 'landed')) continue;
    const x = r.state === 'falling' ? r.targetX : r.x;
    const y = r.state === 'falling' ? r.targetY : r.y;
    if (Math.floor(x / TILE) === col && Math.floor(y / TILE) === row) return true;
  }
  return false;
}
