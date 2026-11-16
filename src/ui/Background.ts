import type { GridData, Team } from '../types';
import {
  BASE_COL,
  BASE_H,
  BASE_ROW,
  BASE_W,
  CANVAS_H,
  CANVAS_W,
  COLORS,
  MAP_H,
  MAP_W,
  TEAM_COLORS,
  TILE,
} from '../core/config';
import { drawGlow, hash2, polygonPath, rgba, withGlow } from './theme';

// ---------------------------------------------------------------- Map cache

const DARK = [0x14, 0x18, 0x21];
const MID = [0x1f, 0x25, 0x32];
const LIGHT = [0x2e, 0x36, 0x48];

function mixRock(t: number): string {
  // 0..0.5 dark->mid, 0.5..1 mid->light (subdued)
  const a = t < 0.5 ? DARK : MID;
  const b = t < 0.5 ? MID : LIGHT;
  const k = t < 0.5 ? t * 2 : (t - 0.5) * 2 * 0.6;
  const r = Math.round(a[0]! + (b[0]! - a[0]!) * k);
  const g = Math.round(a[1]! + (b[1]! - a[1]!) * k);
  const bl = Math.round(a[2]! + (b[2]! - a[2]!) * k);
  return `rgb(${r},${g},${bl})`;
}

/** Jittered grid vertex shared by neighbouring cells (gives a faceted, natural surface). */
function vx(c: number, r: number, cols: number, rows: number): number {
  if (c <= 0 || c >= cols) return c * TILE;
  return c * TILE + (hash2(c, r, 11) - 0.5) * 9;
}
function vy(c: number, r: number, cols: number, rows: number): number {
  if (r <= 0 || r >= rows) return r * TILE;
  return r * TILE + (hash2(c, r, 23) - 0.5) * 9;
}

let cachedGrid: GridData | null = null;
let cachedDpr = 0;
let cachedCanvas: HTMLCanvasElement | null = null;

/** Returns the cached map surface canvas (MAP_W*dpr x MAP_H*dpr); rebuilt when the grid object changes. */
export function getMapLayer(grid: GridData, dpr: number): HTMLCanvasElement {
  if (cachedCanvas && cachedGrid === grid && cachedDpr === dpr) return cachedCanvas;
  cachedGrid = grid;
  cachedDpr = dpr;
  cachedCanvas = buildMapLayer(grid, dpr);
  return cachedCanvas;
}

function buildMapLayer(grid: GridData, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(MAP_W * dpr);
  canvas.height = Math.round(MAP_H * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);
  const { cols, rows } = grid;

  // Floor facets.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid.cells[r * cols + c]!;
      const x0 = vx(c, r, cols, rows), y0 = vy(c, r, cols, rows);
      const x1 = vx(c + 1, r, cols, rows), y1 = vy(c + 1, r, cols, rows);
      const x2 = vx(c + 1, r + 1, cols, rows), y2 = vy(c + 1, r + 1, cols, rows);
      const x3 = vx(c, r + 1, cols, rows), y3 = vy(c, r + 1, cols, rows);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      ctx.fillStyle = mixRock(cell.shade * 0.7);
      ctx.fill();
      // Lit / shaded triangle split.
      const diag = hash2(c, r, 3) < 0.5;
      ctx.beginPath();
      if (diag) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x3, y3);
      } else {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(170,200,255,${0.015 + cell.shade * 0.03})`;
      ctx.fill();

      // Specks.
      const specks = Math.floor(hash2(c, r, 5) * 4);
      for (let i = 0; i < specks; i++) {
        const sx = c * TILE + hash2(c, r, 40 + i) * TILE;
        const sy = r * TILE + hash2(c, r, 60 + i) * TILE;
        ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.35)' : 'rgba(150,170,210,0.08)';
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Craters.
      if (cell.type === 'empty' && hash2(c, r, 7) < 0.2) {
        const cr = 4 + hash2(c, r, 8) * 7;
        const cx = c * TILE + TILE / 2 + (hash2(c, r, 9) - 0.5) * (TILE - cr * 2);
        const cy = r * TILE + TILE / 2 + (hash2(c, r, 10) - 0.5) * (TILE - cr * 2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.75, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.75, 0, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.strokeStyle = 'rgba(160,185,230,0.12)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx + 1, cy + 1, cr * 0.55, cr * 0.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();
      }
    }
  }

  // Faint grid.
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < cols; c++) {
    ctx.moveTo(c * TILE + 0.5, 0);
    ctx.lineTo(c * TILE + 0.5, MAP_H);
  }
  for (let r = 1; r < rows; r++) {
    ctx.moveTo(0, r * TILE + 0.5);
    ctx.lineTo(MAP_W, r * TILE + 0.5);
  }
  ctx.stroke();

  // Natural rock boulders.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid.cells[r * cols + c]!.type === 'rock') drawBoulder(ctx, c, r, grid.cells[r * cols + c]!.shade);
    }
  }

  erodeEdges(ctx);

  // Vignette (only darkens existing pixels).
  ctx.globalCompositeOperation = 'source-atop';
  const vg = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.35, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
  vg.addColorStop(0, 'rgba(2,3,10,0)');
  vg.addColorStop(1, 'rgba(2,3,10,0.62)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.globalCompositeOperation = 'source-over';

  drawBasePad(ctx, 0);
  drawBasePad(ctx, 1);
  return canvas;
}

function drawBoulder(ctx: CanvasRenderingContext2D, c: number, r: number, shade: number): void {
  const cx = c * TILE + TILE / 2 + (hash2(c, r, 70) - 0.5) * 4;
  const cy = r * TILE + TILE / 2 + (hash2(c, r, 71) - 0.5) * 4;
  const n = 8 + Math.floor(hash2(c, r, 72) * 3);
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash2(c, r, 80 + i) * 0.4;
    const rad = TILE * (0.5 + hash2(c, r, 100 + i) * 0.16);
    pts.push(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  const path = (dx: number, dy: number, s: number): void => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const px = cx + (pts[i * 2]! - cx) * s + dx;
      const py = cy + (pts[i * 2 + 1]! - cy) * s + dy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };
  // Drop shadow.
  path(5, 6, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  // Body.
  path(0, 0, 1);
  const g = ctx.createLinearGradient(cx - TILE * 0.5, cy - TILE * 0.5, cx + TILE * 0.5, cy + TILE * 0.5);
  g.addColorStop(0, '#4a5570');
  g.addColorStop(0.45, mixRock(0.75 + shade * 0.25));
  g.addColorStop(1, '#0b0e15');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Facets.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const fx = cx - 3, fy = cy - 4;
  for (let i = 0; i < n; i += 2) {
    ctx.moveTo(fx, fy);
    ctx.lineTo(pts[i * 2]!, pts[i * 2 + 1]!);
  }
  ctx.stroke();
  // Top facet highlight.
  path(-2, -3, 0.55);
  ctx.fillStyle = 'rgba(170,195,240,0.12)';
  ctx.fill();
  // Rim light on the upper-left edges.
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(pts[i * 2 + 1]! - cy, pts[i * 2]! - cx);
    if (a < -Math.PI * 0.1 && a > -Math.PI * 0.95) {
      const j = (i + 1) % n;
      ctx.moveTo(pts[i * 2]!, pts[i * 2 + 1]!);
      ctx.lineTo(pts[j * 2]!, pts[j * 2 + 1]!);
    }
  }
  ctx.strokeStyle = 'rgba(180,210,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Makes the outer map border semi-transparent and chipped so stars show through. */
function erodeEdges(ctx: CanvasRenderingContext2D): void {
  ctx.globalCompositeOperation = 'destination-out';
  const fade = 34;
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, fade, 0, 0, 0, fade, MAP_H],
    [MAP_W, 0, MAP_W - fade, 0, MAP_W - fade, 0, fade, MAP_H],
    [0, 0, 0, fade, 0, 0, MAP_W, fade],
    [0, MAP_H, 0, MAP_H - fade, 0, MAP_H - fade, MAP_W, fade],
  ];
  for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of edges) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }
  // Chips along the border (skip the base areas).
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  for (let i = 0; i < 90; i++) {
    const side = i % 4;
    const t = hash2(i, side, 300);
    const s = 3 + hash2(i, side, 301) * 7;
    let x: number, y: number;
    if (side === 0) { x = t * MAP_W; y = 0; }
    else if (side === 1) { x = t * MAP_W; y = MAP_H; }
    else if (side === 2) { x = 0; y = t * MAP_H; }
    else { x = MAP_W; y = t * MAP_H; }
    if (side >= 2 && y > (BASE_ROW - 1) * TILE && y < (BASE_ROW + BASE_H + 1) * TILE) continue;
    ctx.beginPath();
    polygonPath(ctx, x, y, s, 5, hash2(i, side, 302) * 6);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawBasePad(ctx: CanvasRenderingContext2D, team: Team): void {
  const pal = TEAM_COLORS[team];
  const x = BASE_COL[team] * TILE + 3;
  const y = BASE_ROW * TILE + 3;
  const w = BASE_W * TILE - 6;
  const h = BASE_H * TILE - 6;
  const cut = 10;
  const pad = (): void => {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + cut, y + h);
    ctx.lineTo(x, y + h - cut);
    ctx.lineTo(x, y + cut);
    ctx.closePath();
  };
  // Apron around the pad.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  pad();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#1d2433');
  g.addColorStop(1, '#0b0f18');
  ctx.fillStyle = g;
  ctx.fill();
  // Hex plating.
  ctx.save();
  pad();
  ctx.clip();
  ctx.strokeStyle = rgba(pal.main, 0.12);
  ctx.lineWidth = 1;
  for (let yy = y; yy < y + h + 12; yy += 12) {
    for (let xx = x + ((yy - y) / 12) % 2 * 7; xx < x + w + 14; xx += 14) {
      ctx.beginPath();
      polygonPath(ctx, xx, yy, 6, 6, Math.PI / 6);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Glowing rim.
  withGlow(ctx, pal.main, 14, () => {
    pad();
    ctx.strokeStyle = pal.main;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
  ctx.strokeStyle = rgba(pal.bright, 0.6);
  ctx.lineWidth = 1;
  pad();
  ctx.stroke();
  // Corner lights.
  ctx.fillStyle = pal.bright;
  for (const [lx, ly] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]] as const) {
    ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);
  }
}

// ---------------------------------------------------------------- Starfield

interface StarLayer {
  /** x, y, size, phase, rate, brightness per star. */
  data: Float32Array;
  count: number;
  speed: number;
  color: string;
  depth: number;
}

const STRIDE = 6;
let layers: StarLayer[] | null = null;
let nebula: HTMLCanvasElement | null = null;

function makeLayer(count: number, speed: number, minS: number, maxS: number, color: string, depth: number, seed: number): StarLayer {
  const data = new Float32Array(count * STRIDE);
  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    data[o] = hash2(i, seed, 1) * CANVAS_W;
    data[o + 1] = hash2(i, seed, 2) * CANVAS_H;
    data[o + 2] = minS + hash2(i, seed, 3) * (maxS - minS);
    data[o + 3] = hash2(i, seed, 4) * Math.PI * 2;
    data[o + 4] = 0.6 + hash2(i, seed, 5) * 2.4;
    data[o + 5] = 0.35 + hash2(i, seed, 6) * 0.65;
  }
  return { data, count, speed, color, depth };
}

function buildNebula(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CANVAS_W / 2;
  c.height = CANVAS_H / 2;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = COLORS.space;
  g.fillRect(0, 0, c.width, c.height);
  const blobs: [number, number, number, string][] = [
    [0.18, 0.3, 0.45, 'rgba(25,120,200,0.16)'],
    [0.85, 0.7, 0.5, 'rgba(200,60,40,0.12)'],
    [0.55, 0.15, 0.35, 'rgba(120,50,200,0.12)'],
    [0.4, 0.85, 0.4, 'rgba(30,160,170,0.08)'],
    [0.7, 0.4, 0.25, 'rgba(160,80,220,0.07)'],
  ];
  for (const [bx, by, br, col] of blobs) {
    const x = bx * c.width, y = by * c.height, r = br * c.width;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
  }
  // Faint galactic band.
  g.save();
  g.translate(c.width / 2, c.height / 2);
  g.rotate(-0.35);
  const band = g.createLinearGradient(0, -60, 0, 60);
  band.addColorStop(0, 'rgba(140,160,255,0)');
  band.addColorStop(0.5, 'rgba(140,160,255,0.05)');
  band.addColorStop(1, 'rgba(140,160,255,0)');
  g.fillStyle = band;
  g.fillRect(-c.width, -60, c.width * 2, 120);
  g.restore();
  return c;
}

/** Full-canvas parallax starfield with twinkling stars. `ox/oy` add a depth-scaled parallax offset. */
export function drawStarfield(ctx: CanvasRenderingContext2D, time: number, ox = 0, oy = 0): void {
  if (!nebula) nebula = buildNebula();
  if (!layers) {
    layers = [
      makeLayer(220, 3, 0.6, 1.2, '#8fa6d8', 0.2, 1),
      makeLayer(110, 8, 1, 1.8, '#cfe0ff', 0.5, 2),
      makeLayer(40, 18, 1.6, 2.6, '#ffffff', 1, 3),
    ];
  }
  ctx.drawImage(nebula, 0, 0, CANVAS_W, CANVAS_H);
  const prevAlpha = ctx.globalAlpha;
  for (const layer of layers) {
    ctx.fillStyle = layer.color;
    const shift = time * layer.speed;
    const dx = ox * layer.depth;
    const dy = oy * layer.depth;
    const d = layer.data;
    for (let i = 0; i < layer.count; i++) {
      const o = i * STRIDE;
      let x = (d[o]! - shift + dx) % CANVAS_W;
      if (x < 0) x += CANVAS_W;
      const y = d[o + 1]! + dy;
      const s = d[o + 2]!;
      const tw = 0.65 + 0.35 * Math.sin(time * d[o + 4]! + d[o + 3]!);
      ctx.globalAlpha = d[o + 5]! * tw;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  // A few bright twinkling stars with cross flares.
  const near = layers[2]!;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const o = i * STRIDE;
    let x = (near.data[o]! - time * near.speed + ox) % CANVAS_W;
    if (x < 0) x += CANVAS_W;
    const y = near.data[o + 1]! + oy;
    const tw = 0.5 + 0.5 * Math.sin(time * 1.3 + near.data[o + 3]!);
    ctx.globalAlpha = 0.35 + 0.5 * tw;
    drawGlow(ctx, '#a9d8ff', x, y, 7 + 4 * tw);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 5 * tw, y - 0.5, 10 * tw, 1);
    ctx.fillRect(x - 0.5, y - 5 * tw, 1, 10 * tw);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = prevAlpha;
}

// ---------------------------------------------------------------- Attract mode (main menu)

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  pts: number[];
  crystal: boolean;
}

let asteroids: Asteroid[] | null = null;

function makeAsteroids(): Asteroid[] {
  const list: Asteroid[] = [];
  for (let i = 0; i < 16; i++) {
    const n = 9;
    const pts: number[] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const rr = 0.72 + hash2(i, k, 500) * 0.4;
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    list.push({
      x: hash2(i, 0, 501) * CANVAS_W,
      y: hash2(i, 0, 502) * CANVAS_H,
      vx: -6 - hash2(i, 0, 503) * 18,
      vy: (hash2(i, 0, 504) - 0.5) * 8,
      r: 10 + hash2(i, 0, 505) * (i < 3 ? 60 : 26),
      rot: hash2(i, 0, 506) * 6,
      spin: (hash2(i, 0, 507) - 0.5) * 0.4,
      pts,
      crystal: hash2(i, 0, 508) < 0.35,
    });
  }
  return list.sort((a, b) => a.r - b.r);
}

/** Main-menu background: starfield, drifting asteroids and neon comets. */
export function drawAttract(ctx: CanvasRenderingContext2D, time: number): void {
  drawStarfield(ctx, time);
  if (!asteroids) asteroids = makeAsteroids();
  const span = CANVAS_W + 240;
  const spanY = CANVAS_H + 240;
  for (const a of asteroids) {
    let x = (a.x + a.vx * time) % span;
    if (x < 0) x += span;
    x -= 120;
    let y = (a.y + a.vy * time) % spanY;
    if (y < 0) y += spanY;
    y -= 120;
    const rot = a.rot + a.spin * time;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    const n = a.pts.length / 2;
    for (let k = 0; k < n; k++) {
      const px = a.pts[k * 2]! * a.r;
      const py = a.pts[k * 2 + 1]! * a.r;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = a.r > 40 ? COLORS.rockMid : COLORS.rockDark;
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,255,0.18)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-a.r * 0.2, -a.r * 0.15, a.r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    ctx.restore();
    if (a.crystal) {
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + 0.4 * Math.sin(time * 2 + a.rot);
      drawGlow(ctx, COLORS.thorium, x + a.r * 0.3, y - a.r * 0.2, a.r * 0.6 + 6, 0.5 * pulse);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = COLORS.thoriumCore;
      ctx.beginPath();
      polygonPath(ctx, x + a.r * 0.3, y - a.r * 0.2, Math.max(2.5, a.r * 0.14), 4, rot);
      ctx.fill();
    }
  }

  // Comets.
  const comets: [number, number, string, number][] = [
    [9, 0, TEAM_COLORS[0].main, 0.2],
    [12, 4.5, TEAM_COLORS[1].main, 0.55],
    [15, 9, COLORS.thorium, 0.85],
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const [period, offset, color, lane] of comets) {
    const t = ((time + offset) % period) / period;
    if (t > 0.45) continue;
    const k = t / 0.45;
    const sx = CANVAS_W + 150 - k * (CANVAS_W + 500);
    const sy = lane * CANVAS_H - 160 + k * 380;
    const tailX = sx + 260;
    const tailY = sy - 100;
    const grad = ctx.createLinearGradient(sx, sy, tailX, tailY);
    grad.addColorStop(0, rgba(color, 0.9));
    grad.addColorStop(1, rgba(color, 0));
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 90, sy - 35);
    ctx.stroke();
    drawGlow(ctx, color, sx, sy, 26);
    drawGlow(ctx, '#ffffff', sx, sy, 7);
  }
  ctx.lineCap = 'butt';
  ctx.globalCompositeOperation = 'source-over';
}
