import type { PaletteKey, TowerKind, UnitKind } from '../types';
import { COLORS, PALETTES } from '../core/config';
import type { TeamPalette } from '../core/config';
import { angledRectPath, hash2, polygonPath, rgba, roundRectPath } from './theme';

/**
 * Pre-rendered sprites for every map entity. Sprites are drawn once (supersampled) into a shared
 * texture ATLAS and blitted with 9-argument drawImage at render time, so the GPU canvas can batch
 * consecutive draws from one texture. Nothing here runs per frame except the tiny draw helpers.
 */

/** Supersampling factor of every cached sprite (crisp at devicePixelRatio 1 and 2). */
const SS = 2;
const ATLAS_SIZE = 2048;
const ATLAS_PAD = 2;

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Source rect inside the atlas canvas (device px). */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Logical size; the sprite is drawn centered on its anchor. */
  w: number;
  h: number;
}

interface AtlasPage {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  x: number;
  y: number;
  rowH: number;
}

const pages: AtlasPage[] = [];

function newPage(): AtlasPage {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas 2D context not available');
  const page = { canvas, g, x: 0, y: 0, rowH: 0 };
  pages.push(page);
  return page;
}

/** Shelf-packs a pw x ph region into the current atlas page (opening a new page when full). */
function allocRegion(pw: number, ph: number): { page: AtlasPage; x: number; y: number } {
  let page = pages[pages.length - 1] ?? newPage();
  if (page.x + pw > ATLAS_SIZE) {
    page.x = 0;
    page.y += page.rowH + ATLAS_PAD;
    page.rowH = 0;
  }
  if (page.y + ph > ATLAS_SIZE) page = newPage();
  const x = page.x;
  const y = page.y;
  page.x += pw + ATLAS_PAD;
  page.rowH = Math.max(page.rowH, ph);
  return { page, x, y };
}

function makeSprite(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const pw = Math.ceil(w * SS);
  const ph = Math.ceil(h * SS);
  const { page, x, y } = allocRegion(pw, ph);
  const g = page.g;
  g.save();
  g.beginPath();
  g.rect(x, y, pw, ph);
  g.clip();
  g.translate(x, y);
  g.scale(SS, SS);
  g.translate(w / 2, h / 2);
  draw(g);
  g.restore();
  return { canvas: page.canvas, sx: x, sy: y, sw: pw, sh: ph, w, h };
}

/** Draws a sprite centered at (x, y) in the current transform. */
export function blit(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1): void {
  const w = s.w * scale;
  const h = s.h * scale;
  ctx.drawImage(s.canvas, s.sx, s.sy, s.sw, s.sh, x - w / 2, y - h / 2, w, h);
}

/** Draws a sprite into the destination rect (x, y, w, h). */
export function blitRect(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, w: number, h: number): void {
  ctx.drawImage(s.canvas, s.sx, s.sy, s.sw, s.sh, x, y, w, h);
}

/** Soft radial glow (atlas copy of theme's glow), 32 logical px; draw scaled to any radius. */
export function glowSpr(color: string): Sprite {
  return cached(`glow:${color}`, () =>
    makeSprite(32, 32, (g) => {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 16);
      grad.addColorStop(0, rgba(color, 1));
      grad.addColorStop(0.25, rgba(color, 0.55));
      grad.addColorStop(0.6, rgba(color, 0.15));
      grad.addColorStop(1, rgba(color, 0));
      g.fillStyle = grad;
      g.fillRect(-16, -16, 32, 32);
    }),
  );
}

const cache = new Map<string, Sprite>();
function cached(key: string, build: () => Sprite): Sprite {
  let s = cache.get(key);
  if (!s) {
    s = build();
    cache.set(key, s);
  }
  return s;
}

function metalGrad(g: CanvasRenderingContext2D, r: number, light = 0): CanvasGradient {
  const grad = g.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, light > 0 ? '#c9ced8' : COLORS.metalLight);
  grad.addColorStop(0.45, COLORS.metalMid);
  grad.addColorStop(1, COLORS.metalDark);
  return grad;
}

// ---------------------------------------------------------------- Towers

export const TOWER_BODY_SIZE = 50;
export const TOWER_TOP_SIZE = 48;

function bodyPath(g: CanvasRenderingContext2D, kind: TowerKind, inset: number): void {
  g.beginPath();
  if (kind === 'cannon' || kind === 'refinery') {
    const h = 18.5 - inset;
    angledRectPath(g, -h, -h, h * 2, h * 2, Math.max(2, (kind === 'cannon' ? 9 : 6) - inset * 0.4));
  } else {
    polygonPath(g, 0, 0, 20 - inset, 8, Math.PI / 8);
  }
}

/** Bulky bunker body (no turret), ~37 px wide so neighbouring towers read as one thick wall. */
export function towerBody(kind: TowerKind, level: 0 | 1 | 2, palKey: PaletteKey): Sprite {
  return cached(`tb:${kind}:${level}:${palKey}`, () =>
    makeSprite(TOWER_BODY_SIZE, TOWER_BODY_SIZE, (g) => drawTowerBody(g, kind, level, PALETTES[palKey])),
  );
}

function drawTowerBody(g: CanvasRenderingContext2D, kind: TowerKind, level: number, pal: TeamPalette): void {
  // Drop shadow.
  g.save();
  g.translate(2.5, 3.5);
  bodyPath(g, kind, -0.5);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fill();
  g.restore();

  if (level === 2) {
    g.save();
    g.shadowColor = pal.main;
    g.shadowBlur = 9;
    bodyPath(g, kind, 0);
    g.fillStyle = pal.dark;
    g.fill();
    g.restore();
  }

  // Outer shell + bevel.
  bodyPath(g, kind, 0);
  g.fillStyle = metalGrad(g, 19);
  g.fill();
  g.strokeStyle = '#101116';
  g.lineWidth = 1.5;
  g.stroke();
  bodyPath(g, kind, 3.5);
  const inner = g.createLinearGradient(-15, -15, 15, 15);
  inner.addColorStop(0, '#585d69');
  inner.addColorStop(1, '#2a2d35');
  g.fillStyle = inner;
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.13)';
  g.lineWidth = 1;
  g.stroke();
  // Upper-left rim light.
  g.save();
  bodyPath(g, kind, 0.8);
  g.clip();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-20, 6);
  g.lineTo(-20, -20);
  g.lineTo(6, -20);
  g.stroke();
  g.restore();
  bodyPath(g, kind, 0.8);
  g.strokeStyle = 'rgba(255,255,255,0.1)';
  g.lineWidth = 0.8;
  g.stroke();

  // Panel seams.
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    g.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
    g.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
  }
  g.stroke();

  // Extra armor plating per level.
  if (level >= 1) {
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i * Math.PI) / 2);
      g.beginPath();
      g.moveTo(-6, -16.5);
      g.lineTo(6, -16.5);
      g.lineTo(4.5, -13);
      g.lineTo(-4.5, -13);
      g.closePath();
      g.fillStyle = level === 2 ? '#7b8190' : '#4a4f5b';
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 0.8;
      g.stroke();
      g.fillStyle = '#c4c9d4';
      g.fillRect(-4, -15.5, 1.2, 1.2);
      g.fillRect(2.8, -15.5, 1.2, 1.2);
      g.restore();
    }
  }

  // Team accent: ring around the turret socket + corner lights.
  g.save();
  g.shadowColor = pal.main;
  g.shadowBlur = level === 2 ? 7 : 4;
  g.beginPath();
  g.arc(0, 0, 12.2, 0, Math.PI * 2);
  g.strokeStyle = pal.main;
  g.lineWidth = level === 0 ? 2 : 2.6;
  g.stroke();
  g.fillStyle = pal.bright;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    g.fillRect(Math.cos(a) * 14.5 - 1.2, Math.sin(a) * 14.5 - 1.2, 2.4, 2.4);
  }
  g.restore();

  if (kind === 'refinery') {
    // Round landing pad.
    g.beginPath();
    g.arc(0, 0, 11, 0, Math.PI * 2);
    g.fillStyle = '#1b1d24';
    g.fill();
    g.strokeStyle = '#7d8290';
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = rgba(COLORS.thorium, 0.55);
    g.setLineDash([2, 2.4]);
    g.beginPath();
    g.arc(0, 0, 8.5, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(200,210,230,0.55)';
    g.fillRect(-4, -4.5, 1.6, 9);
    g.fillRect(2.4, -4.5, 1.6, 9);
    g.fillRect(-4, -0.8, 8, 1.6);
  } else {
    g.beginPath();
    g.arc(0, 0, 10, 0, Math.PI * 2);
    g.fillStyle = '#16181e';
    g.fill();
  }

  if (level === 2) {
    bodyPath(g, kind, 1.6);
    g.strokeStyle = rgba(pal.bright, 0.55);
    g.lineWidth = 0.8;
    g.stroke();
  }

  // Level pips.
  const n = level + 1;
  g.fillStyle = pal.bright;
  for (let i = 0; i < n; i++) {
    const px = -((n - 1) * 4) / 2 + i * 4;
    g.fillRect(px - 1.2, 15.2, 2.4, 2.4);
  }
}

/** Turret/top sprite pointing +x (rotated live). Refinery: magnet ring (spun live). Cryo: crystal dome. */
export function towerTop(kind: TowerKind, level: 0 | 1 | 2, palKey: PaletteKey): Sprite {
  return cached(`tt:${kind}:${level}:${palKey}`, () =>
    makeSprite(TOWER_TOP_SIZE, TOWER_TOP_SIZE, (g) => drawTowerTop(g, kind, level, PALETTES[palKey])),
  );
}

/** Number of pre-rotated turret frames. */
export const TOP_FRAMES = 32;
const topSources = new Map<string, HTMLCanvasElement>();

/** Turret pre-rotated to `frame` (angle = frame * 2π / TOP_FRAMES), so it can be drawn without setTransform. */
export function towerTopFrame(kind: TowerKind, level: 0 | 1 | 2, palKey: PaletteKey, frame: number): Sprite {
  return cached(`ttf:${kind}:${level}:${palKey}:${frame}`, () => {
    // Frames are rotated copies of a standalone (non-atlas) source: cheap to generate on demand.
    const key = `${kind}:${level}:${palKey}`;
    let src = topSources.get(key);
    if (!src) {
      src = document.createElement('canvas');
      src.width = TOWER_TOP_SIZE * SS;
      src.height = TOWER_TOP_SIZE * SS;
      const sg = src.getContext('2d');
      if (sg) {
        sg.scale(SS, SS);
        sg.translate(TOWER_TOP_SIZE / 2, TOWER_TOP_SIZE / 2);
        drawTowerTop(sg, kind, level, PALETTES[palKey]);
      }
      topSources.set(key, src);
    }
    const source = src;
    const half = TOWER_TOP_SIZE / 2;
    return makeSprite(TOWER_TOP_SIZE, TOWER_TOP_SIZE, (g) => {
      g.rotate((frame / TOP_FRAMES) * Math.PI * 2);
      g.drawImage(source, -half, -half, TOWER_TOP_SIZE, TOWER_TOP_SIZE);
    });
  });
}

function drawTowerTop(g: CanvasRenderingContext2D, kind: TowerKind, level: number, pal: TeamPalette): void {
  switch (kind) {
    case 'laser':
      topLaser(g, level, pal);
      break;
    case 'cannon':
      topCannon(g, level, pal);
      break;
    case 'cryo':
      topCryo(g, level, pal);
      break;
    case 'plasma':
      topPlasma(g, level, pal);
      break;
    case 'refinery':
      topRefinery(g, level);
      break;
  }
}

function topLaser(g: CanvasRenderingContext2D, level: number, pal: TeamPalette): void {
  const len = 12 + level * 2;
  const ys = level === 2 ? [-4.6, 0, 4.6] : [-3.2, 3.2];
  g.fillStyle = 'rgba(0,0,0,0.4)';
  for (const y of ys) g.fillRect(3, y - 0.3, len, 3);
  for (const y of ys) {
    g.fillStyle = COLORS.metalLight;
    g.fillRect(2, y - 1.3, len, 2.6);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(2, y + 0.5, len, 0.8);
  }
  if (level >= 1) {
    g.fillStyle = '#4b505c';
    for (let x = 5; x < 5 + len - 6; x += 3) g.fillRect(x, -6.5, 1.2, 13);
  }
  g.beginPath();
  roundRectPath(g, -8, -7.5, 14, 15, 3);
  g.fillStyle = metalGrad(g, 8);
  g.fill();
  g.strokeStyle = '#111217';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = pal.main;
  g.fillRect(-7, -1, 3, 2);
  g.save();
  g.shadowColor = COLORS.laser;
  g.shadowBlur = 6;
  g.fillStyle = COLORS.laser;
  for (const y of ys) g.fillRect(len, y - 1.8, 3, 3.6);
  g.fillRect(-2, -2, 5, 4);
  g.fillStyle = '#ffd0d0';
  for (const y of ys) g.fillRect(len + 1, y - 0.7, 1.6, 1.4);
  g.restore();
}

function topCannon(g: CanvasRenderingContext2D, level: number, pal: TeamPalette): void {
  const ys = level === 2 ? [-4.6, 4.6] : [0];
  const bw = level === 2 ? 7.5 : 9 + level;
  const blen = 15 + level * 1.5;
  for (const y of ys) {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(3.5, y - bw / 2 + 1.5, blen, bw);
    const bg = g.createLinearGradient(0, y - bw / 2, 0, y + bw / 2);
    bg.addColorStop(0, '#9aa0ad');
    bg.addColorStop(0.5, '#5b606c');
    bg.addColorStop(1, '#2c2f37');
    g.beginPath();
    roundRectPath(g, 2, y - bw / 2, blen, bw, 2.5);
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = '#111217';
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = '#2a2d35';
    g.fillRect(blen - 1, y - bw / 2 - 1, 3, bw + 2);
    if (level >= 1) g.fillRect(8, y - bw / 2 - 0.6, 2, bw + 1.2);
    g.fillStyle = '#0a0a0c';
    g.fillRect(blen + 1.6, y - bw / 2 + 2, 1.2, bw - 4);
    g.fillStyle = rgba(COLORS.fireball, 0.8);
    g.fillRect(blen + 1.6, y - 1, 1.2, 2);
  }
  g.beginPath();
  g.arc(0, 0, 9.5, 0, Math.PI * 2);
  const dome = g.createRadialGradient(-3, -3, 1, 0, 0, 10);
  dome.addColorStop(0, '#c9ced8');
  dome.addColorStop(0.5, COLORS.metalMid);
  dome.addColorStop(1, '#25272e');
  g.fillStyle = dome;
  g.fill();
  g.strokeStyle = '#111217';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = pal.main;
  g.fillRect(-7, -1.3, 6, 2.6);
  g.fillStyle = rgba('#ffffff', 0.5);
  g.beginPath();
  g.arc(-3, -3.5, 2, 0, Math.PI * 2);
  g.fill();
}

function topCryo(g: CanvasRenderingContext2D, level: number, pal: TeamPalette): void {
  const spikes = 4 + level * 2;
  g.save();
  g.shadowColor = COLORS.cryo;
  g.shadowBlur = 6 + level * 3;
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.beginPath();
    g.moveTo(8, -2.4);
    g.lineTo(14 + level * 1.2, 0);
    g.lineTo(8, 2.4);
    g.closePath();
    g.fillStyle = 'rgba(190,240,255,0.85)';
    g.fill();
    g.restore();
  }
  g.beginPath();
  g.arc(0, 0, 10, 0, Math.PI * 2);
  const dome = g.createRadialGradient(-3.5, -3.5, 0.5, 0, 0, 10.5);
  dome.addColorStop(0, '#ffffff');
  dome.addColorStop(0.35, '#b8f0ff');
  dome.addColorStop(0.75, COLORS.cryo);
  dome.addColorStop(1, '#1b5a9a');
  g.fillStyle = dome;
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 0.8;
  g.beginPath();
  polygonPath(g, 0, 0, 6, 6, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
    g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
  }
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 10, 0, Math.PI * 2);
  g.strokeStyle = pal.main;
  g.lineWidth = 1;
  g.stroke();
}

function topPlasma(g: CanvasRenderingContext2D, level: number, pal: TeamPalette): void {
  const len = 15 + level * 1.5;
  if (level >= 1) {
    g.fillStyle = COLORS.metalMid;
    g.fillRect(1, -7.2, 9 + level * 2, 2.2);
    g.fillRect(1, 5, 9 + level * 2, 2.2);
  }
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(2, -1.5, len, 6);
  g.fillStyle = '#4c515d';
  g.fillRect(0, -3, len, 6);
  g.save();
  g.shadowColor = COLORS.plasma;
  g.shadowBlur = 5 + level * 2;
  g.fillStyle = COLORS.plasma;
  for (let x = 3; x < len - 1; x += 3) g.fillRect(x, -4.6, 1.5, 9.2);
  if (level >= 1) {
    g.fillStyle = '#fff8cf';
    g.fillRect(9 + level * 2, -7.2, 2, 2.2);
    g.fillRect(9 + level * 2, 5, 2, 2.2);
  }
  g.beginPath();
  g.arc(len + 1, 0, 2.6 + level * 0.4, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.restore();
  g.beginPath();
  g.arc(-1, 0, 8, 0, Math.PI * 2);
  g.fillStyle = metalGrad(g, 8);
  g.fill();
  g.strokeStyle = '#111217';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.arc(-1, 0, 5, 0, Math.PI * 2);
  g.strokeStyle = rgba(COLORS.plasma, 0.9);
  g.lineWidth = 1.6;
  g.stroke();
  g.fillStyle = pal.main;
  g.fillRect(-7, -1, 3, 2);
}

function topRefinery(g: CanvasRenderingContext2D, level: number): void {
  const segs = 3 + level;
  const r = 15.5;
  g.save();
  g.shadowColor = COLORS.thorium;
  g.shadowBlur = 5 + level * 2;
  g.strokeStyle = COLORS.thorium;
  g.lineWidth = 2.2;
  g.lineCap = 'round';
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    g.beginPath();
    g.arc(0, 0, r, a + 0.25, a + (Math.PI * 2) / segs - 0.25);
    g.stroke();
  }
  g.restore();
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.fillStyle = '#9aa0ad';
    g.fillRect(r - 2.5, -1.8, 5, 3.6);
    g.fillStyle = '#2a2d35';
    g.fillRect(r - 2.5, -0.5, 5, 1);
    g.restore();
  }
}

/** Small icon of a tower (body + top) for the sidebar. */
export function drawTowerIcon(ctx: CanvasRenderingContext2D, kind: TowerKind, palKey: PaletteKey, x: number, y: number, size: number): void {
  const s = size / 40;
  blit(ctx, towerBody(kind, 0, palKey), x, y, s);
  blit(ctx, towerTop(kind, 0, palKey), x, y, s);
}

// ---------------------------------------------------------------- Units

/** Sprite canvas size per unit kind (logical px), including the baked glow halo. Visual body: scout 8, aegis 12, juggernaut 16, bomber 18. */
const UNIT_SPRITE: Record<UnitKind, number> = { scout: 20, tank: 32, shielded: 26, bomber: 30 };
/** Radius of the baked team-colored glow under each unit. */
const UNIT_HALO: Record<UnitKind, number> = { scout: 9.5, tank: 15.5, shielded: 12.5, bomber: 14 };

/** 0 = normal, 1 = slowed (icy tint), 2 = hit flash. */
export type UnitVariant = 0 | 1 | 2;

/** Unit sprite pointing +x with a faint baked glow underneath (one drawImage per unit). */
export function unitSprite(kind: UnitKind, palKey: PaletteKey, variant: UnitVariant): Sprite {
  return cached(`u:${kind}:${palKey}:${variant}`, () => {
    const size = UNIT_SPRITE[kind];
    return makeSprite(size, size, (g) => paintUnit(g, kind, PALETTES[palKey], variant, 0));
  });
}

/** Number of pre-rotated frames per unit sprite. */
export const UNIT_FRAMES = 32;

/** Unit sprite pre-rotated to frame `frame` (angle = frame * 2π / UNIT_FRAMES): drawn without setTransform. */
export function unitFrame(kind: UnitKind, palKey: PaletteKey, variant: UnitVariant, frame: number): Sprite {
  return cached(`uf:${kind}:${palKey}:${variant}:${frame}`, () => {
    const size = UNIT_SPRITE[kind];
    return makeSprite(size, size, (g) => paintUnit(g, kind, PALETTES[palKey], variant, (frame / UNIT_FRAMES) * Math.PI * 2));
  });
}

function paintUnit(g: CanvasRenderingContext2D, kind: UnitKind, pal: TeamPalette, variant: UnitVariant, angle: number): void {
  const r = UNIT_HALO[kind];
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, r);
  const a = kind === 'bomber' ? 0.3 : 0.42;
  halo.addColorStop(0, rgba(pal.main, a));
  halo.addColorStop(0.5, rgba(pal.main, a * 0.45));
  halo.addColorStop(1, rgba(pal.main, 0));
  g.fillStyle = halo;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.save();
  g.rotate(angle);
  drawUnitBody(g, kind, pal);
  g.restore();
  if (variant !== 0) {
    const size = UNIT_SPRITE[kind];
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = variant === 1 ? 'rgba(170,235,255,0.6)' : 'rgba(255,255,255,0.85)';
    g.fillRect(-size / 2, -size / 2, size, size);
    g.globalCompositeOperation = 'source-over';
  }
}

/** Dark silhouette used as the drop shadow of air units. */
export function unitShadow(kind: UnitKind): Sprite {
  return cached(`ush:${kind}`, () => {
    const size = UNIT_SPRITE[kind];
    return makeSprite(size, size, (g) => {
      drawUnitBody(g, kind, PALETTES.blue);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = '#000000';
      g.fillRect(-size / 2, -size / 2, size, size);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(-size / 2, -size / 2, size, size);
    });
  });
}

function drawUnitBody(g: CanvasRenderingContext2D, kind: UnitKind, pal: TeamPalette): void {
  g.lineJoin = 'round';
  if (kind === 'scout') {
    g.beginPath();
    g.moveTo(4.6, 0);
    g.lineTo(-3.6, -3.8);
    g.lineTo(-1.8, 0);
    g.lineTo(-3.6, 3.8);
    g.closePath();
    g.fillStyle = pal.main;
    g.fill();
    g.strokeStyle = pal.bright;
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(0.4, -0.7, 1.6, 1.4);
  } else if (kind === 'tank') {
    g.fillStyle = '#121317';
    g.fillRect(-8, -8, 16, 4.2);
    g.fillRect(-8, 3.8, 16, 4.2);
    g.fillStyle = '#5c616d';
    for (let x = -7; x < 8; x += 2.6) {
      g.fillRect(x, -8, 1, 4.2);
      g.fillRect(x, 3.8, 1, 4.2);
    }
    g.beginPath();
    angledRectPath(g, -7, -5.4, 14, 10.8, 2.5);
    g.fillStyle = metalGrad(g, 7);
    g.fill();
    g.strokeStyle = '#0d0e12';
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = pal.main;
    g.fillRect(-6, -4.6, 2.2, 9.2);
    g.fillRect(4.4, -3.4, 1.4, 6.8);
    g.fillStyle = '#2b2e36';
    g.fillRect(2, -1.1, 7, 2.2);
    g.beginPath();
    g.arc(0, 0, 3.4, 0, Math.PI * 2);
    g.fillStyle = pal.dark;
    g.fill();
    g.strokeStyle = pal.bright;
    g.lineWidth = 0.9;
    g.stroke();
  } else if (kind === 'shielded') {
    g.beginPath();
    polygonPath(g, 0, 0, 6, 6, 0);
    g.fillStyle = pal.main;
    g.fill();
    g.strokeStyle = pal.bright;
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    polygonPath(g, 0, 0, 3.2, 6, 0);
    g.fillStyle = pal.dark;
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(1.6, -0.9, 3, 1.8);
  } else {
    // Bomber: delta-wing aircraft.
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(-1, -2);
    g.lineTo(-5, -9);
    g.lineTo(-8, -9);
    g.lineTo(-6, -2);
    g.lineTo(-9, -1.5);
    g.lineTo(-9, 1.5);
    g.lineTo(-6, 2);
    g.lineTo(-8, 9);
    g.lineTo(-5, 9);
    g.lineTo(-1, 2);
    g.closePath();
    g.fillStyle = metalGrad(g, 9);
    g.fill();
    g.strokeStyle = '#0d0e12';
    g.lineWidth = 0.8;
    g.stroke();
    g.fillStyle = pal.main;
    g.beginPath();
    g.moveTo(-3, -5);
    g.lineTo(-5, -9);
    g.lineTo(-8, -9);
    g.lineTo(-6.5, -5);
    g.closePath();
    g.moveTo(-3, 5);
    g.lineTo(-5, 9);
    g.lineTo(-8, 9);
    g.lineTo(-6.5, 5);
    g.closePath();
    g.fill();
    g.fillStyle = pal.main;
    g.fillRect(-7, -1, 12, 2);
    g.fillStyle = pal.bright;
    g.fillRect(3, -0.9, 3.5, 1.8);
    g.save();
    g.shadowColor = COLORS.fireball;
    g.shadowBlur = 4;
    g.fillStyle = '#ffcf7a';
    g.fillRect(-10, -2.4, 1.6, 1.6);
    g.fillRect(-10, 0.8, 1.6, 1.6);
    g.restore();
  }
}

/** Aegis shield bubble (drawn unrotated, alpha by shield fraction). */
export function shieldSprite(palKey: PaletteKey): Sprite {
  return cached(`sh:${palKey}`, () =>
    makeSprite(22, 22, (g) => {
      const pal = PALETTES[palKey];
      const grad = g.createRadialGradient(0, 0, 3, 0, 0, 9.5);
      grad.addColorStop(0, rgba(pal.bright, 0));
      grad.addColorStop(0.75, rgba(pal.bright, 0.18));
      grad.addColorStop(1, rgba(pal.bright, 0.5));
      g.beginPath();
      g.arc(0, 0, 9.5, 0, Math.PI * 2);
      g.fillStyle = grad;
      g.fill();
      g.strokeStyle = rgba('#ffffff', 0.7);
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(0, 0, 9.5, -2.4, -1.2);
      g.stroke();
    }),
  );
}

// ---------------------------------------------------------------- Harvesters, Thorium, portals, streaks

/** Little mining drone, pointing +x. */
export function harvesterSprite(palKey: PaletteKey): Sprite {
  return cached(`hv:${palKey}`, () =>
    makeSprite(18, 18, (g) => {
      const pal = PALETTES[palKey];
      g.strokeStyle = COLORS.metalLight;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(-5, -5);
      g.lineTo(5, 5);
      g.moveTo(-5, 5);
      g.lineTo(5, -5);
      g.stroke();
      g.fillStyle = 'rgba(200,220,255,0.35)';
      for (const [x, y] of [[-5, -5], [5, 5], [-5, 5], [5, -5]] as const) {
        g.beginPath();
        g.arc(x, y, 2.6, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, 3.6, 0, Math.PI * 2);
      g.fillStyle = metalGrad(g, 4, 1);
      g.fill();
      g.strokeStyle = pal.main;
      g.lineWidth = 1.1;
      g.stroke();
      g.fillStyle = pal.bright;
      g.fillRect(1.6, -0.8, 2.4, 1.6);
    }),
  );
}

export const CRYSTAL_VARIANTS = 4;

/** Thorium crystal cluster (several shards), ~26 px. */
export function crystalSprite(variant: number): Sprite {
  const v = variant % CRYSTAL_VARIANTS;
  return cached(`cr:${v}`, () =>
    makeSprite(34, 34, (g) => {
      g.beginPath();
      g.ellipse(0, 6, 10, 4.5, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fill();
      g.beginPath();
      g.ellipse(0, 5, 8.5, 3.6, 0, 0, Math.PI * 2);
      g.fillStyle = '#2b3a1c';
      g.fill();
      const n = 4 + (v % 2);
      const shards: [number, number, number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const bx = (hash2(v, i, 1) - 0.5) * 12;
        const by = 4 + (hash2(v, i, 2) - 0.5) * 4;
        const h = 7 + hash2(v, i, 3) * 8 + (i === 0 ? 4 : 0);
        const lean = (bx / 6) * 3 + (hash2(v, i, 4) - 0.5) * 3;
        const w = 2.2 + hash2(v, i, 5) * 1.8;
        shards.push([i === 0 ? 0 : bx, by, h, lean, w]);
      }
      shards.sort((a, b) => a[2] - b[2]);
      g.save();
      g.shadowColor = COLORS.thorium;
      g.shadowBlur = 5;
      for (const [bx, by, h, lean, w] of shards) {
        const tx = bx + lean;
        const ty = by - h;
        g.beginPath();
        g.moveTo(bx - w, by);
        g.lineTo(tx - w * 0.7, ty + w);
        g.lineTo(tx, ty);
        g.lineTo(bx, by + 1);
        g.closePath();
        g.fillStyle = '#5fae1a';
        g.fill();
        g.beginPath();
        g.moveTo(bx, by + 1);
        g.lineTo(tx, ty);
        g.lineTo(tx + w * 0.7, ty + w);
        g.lineTo(bx + w, by);
        g.closePath();
        g.fillStyle = COLORS.thorium;
        g.fill();
        g.strokeStyle = COLORS.thoriumCore;
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(bx, by + 0.5);
        g.lineTo(tx, ty);
        g.stroke();
      }
      g.restore();
    }),
  );
}

/** Swirling portal ring (rotated live, additive). */
export function portalSprite(palKey: PaletteKey): Sprite {
  return cached(`pt:${palKey}`, () =>
    makeSprite(104, 104, (g) => {
      const pal = PALETTES[palKey];
      g.lineCap = 'round';
      for (let arm = 0; arm < 5; arm++) {
        const a0 = (arm / 5) * Math.PI * 2;
        for (let k = 0; k < 24; k++) {
          const t = k / 24;
          const r = 8 + t * 34;
          const a = a0 + t * 2.6;
          g.beginPath();
          g.arc(0, 0, r, a, a + 0.22);
          g.strokeStyle = rgba(k % 3 === 0 ? pal.bright : pal.main, 0.15 + 0.6 * t);
          g.lineWidth = 1 + 2.5 * t;
          g.stroke();
        }
      }
      g.shadowColor = pal.main;
      g.shadowBlur = 10;
      g.beginPath();
      g.arc(0, 0, 44, 0, Math.PI * 2);
      g.strokeStyle = pal.main;
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, 44, 0, Math.PI * 2);
      g.strokeStyle = rgba(pal.bright, 0.8);
      g.lineWidth = 1;
      g.stroke();
    }),
  );
}

/** Meteor streak: bright head at +x/2, tail fading toward -x. */
export function streakSprite(): Sprite {
  return cached('streak', () =>
    makeSprite(180, 20, (g) => {
      const grad = g.createLinearGradient(90, 0, -90, 0);
      grad.addColorStop(0, 'rgba(244,255,154,0.95)');
      grad.addColorStop(0.25, 'rgba(182,255,59,0.55)');
      grad.addColorStop(1, 'rgba(182,255,59,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(90, 0);
      g.lineTo(80, -6);
      g.lineTo(-90, -1);
      g.lineTo(-90, 1);
      g.lineTo(80, 6);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.moveTo(90, 0);
      g.lineTo(84, -2);
      g.lineTo(30, 0);
      g.lineTo(84, 2);
      g.closePath();
      g.fill();
    }),
  );
}

/** Fireball trail puff (orange glow with hot core). */
export function fireballSprite(): Sprite {
  return cached('fireball', () =>
    makeSprite(28, 28, (g) => {
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, 14);
      grad.addColorStop(0, 'rgba(255,255,230,1)');
      grad.addColorStop(0.2, 'rgba(255,220,120,0.95)');
      grad.addColorStop(0.5, 'rgba(255,140,40,0.55)');
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = grad;
      g.fillRect(-14, -14, 28, 28);
    }),
  );
}

// ---------------------------------------------------------------- Player ship

/** Y of the ship body for a cursor at y (carried rocks hang below it). */
export function droneBodyY(y: number, team: number, time: number): number {
  return y - 14 + Math.sin(time * 4 + team) * 1.5;
}

/** Player ship (hovering collector) at (x, y). Drawn live: there are only two. */
export function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, pal: TeamPalette, team: number, time: number, carrying: boolean): void {
  const by = droneBodyY(y, team, time);
  ctx.fillStyle = carrying ? 'rgba(200,255,120,0.18)' : 'rgba(180,240,255,0.13)';
  ctx.beginPath();
  ctx.moveTo(x - 3, by + 2);
  ctx.lineTo(x + 3, by + 2);
  ctx.lineTo(x + 10, by + 22);
  ctx.lineTo(x - 10, by + 22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.metalLight;
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
  ctx.beginPath();
  ctx.ellipse(x, by, 7.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1d1f27';
  ctx.fill();
  ctx.strokeStyle = pal.main;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = pal.bright;
  ctx.fillRect(x - 2, by - 1, 4, 2);
}
