import type { GridData, PaletteKey, Team, UnitKind, World } from '../types';
import { CANVAS_H, CANVAS_W, COLORS, FRAME, MAP_H, MAP_W, PALETTES, SIDEBAR_W, TILE } from '../core/config';
import { blit, blitRect, glowSpr, unitSprite } from './Art';
import { angledRectPath, drawGlow, hash2, mixHex, polygonPath, rgba } from './theme';

// ---------------------------------------------------------------- Terrain (cliff rim + plateau) cache

/** The terrain layer covers [SIDEBAR_W, CANVAS_W] x [0, CANVAS_H]; the map sits at (FRAME, FRAME) inside it. */
export const TERRAIN_W = MAP_W + FRAME * 2;
export const TERRAIN_H = MAP_H + FRAME * 2;
export const TERRAIN_X = SIDEBAR_W;

let tKey = '';
let tGrid: GridData | null = null;
let tCanvas: HTMLCanvasElement | null = null;

/** Cached terrain canvas; rebuilt only when the grid object, palettes or dpr change. */
export function getTerrainLayer(world: World, dpr: number): HTMLCanvasElement {
  const key = `${world.players[0].palette}|${world.players[1].palette}|${dpr}`;
  if (tCanvas && tGrid === world.grid && tKey === key) return tCanvas;
  tGrid = world.grid;
  tKey = key;
  tCanvas = buildTerrain(world.grid, [world.players[0].palette, world.players[1].palette], dpr);
  return tCanvas;
}

function buildTerrain(grid: GridData, palettes: [PaletteKey, PaletteKey], dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TERRAIN_W * dpr);
  canvas.height = Math.round(TERRAIN_H * dpr);
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.scale(dpr, dpr);
  drawCliff(g);
  g.save();
  g.translate(FRAME, FRAME);
  g.beginPath();
  g.rect(0, 0, MAP_W, MAP_H);
  g.clip();
  drawFloor(g, grid);
  drawCircuits(g);
  drawTileGrid(g, grid);
  drawObstacles(g, grid);
  drawEdgeShadow(g);
  g.restore();
  g.save();
  g.translate(FRAME, FRAME);
  drawBasePlatform(g, 0, palettes[0], grid);
  drawBasePlatform(g, 1, palettes[1], grid);
  g.strokeStyle = 'rgba(190,180,255,0.22)';
  g.lineWidth = 1;
  g.strokeRect(-0.5, -0.5, MAP_W + 1, MAP_H + 1);
  g.restore();
  return canvas;
}

function drawCliff(g: CanvasRenderingContext2D): void {
  // Jagged outer outline: walk around the map rectangle, pushing points out by a random depth.
  const pts: number[] = [];
  const step = 13;
  const push = (x: number, y: number, nx: number, ny: number, i: number): void => {
    const d = 7 + hash2(i, 0, 901) * (FRAME - 5) + (hash2(i, 1, 902) < 0.15 ? -5 : 0);
    pts.push(FRAME + x + nx * d, FRAME + y + ny * d);
  };
  let i = 0;
  for (let x = 0; x < MAP_W; x += step) push(x, 0, 0, -1, i++);
  for (let y = 0; y < MAP_H; y += step) push(MAP_W, y, 1, 0, i++);
  for (let x = MAP_W; x > 0; x -= step) push(x, MAP_H, 0, 1, i++);
  for (let y = MAP_H; y > 0; y -= step) push(0, y, -1, 0, i++);
  const outline = (): void => {
    g.beginPath();
    for (let k = 0; k < pts.length; k += 2) {
      if (k === 0) g.moveTo(pts[k]!, pts[k + 1]!);
      else g.lineTo(pts[k]!, pts[k + 1]!);
    }
    g.closePath();
  };
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.9)';
  g.shadowBlur = 18;
  outline();
  g.fillStyle = COLORS.cliffDark;
  g.fill();
  g.restore();
  outline();
  g.fillStyle = COLORS.cliffMid;
  g.fill();
  g.strokeStyle = 'rgba(120,115,150,0.35)';
  g.lineWidth = 1;
  g.stroke();

  // Faceted boulders along the rim.
  g.save();
  outline();
  g.clip();
  for (let k = 0; k < 420; k++) {
    const side = k % 4;
    const t = hash2(k, 7, 903);
    const depth = 3 + hash2(k, 8, 904) * (FRAME - 4);
    let x: number;
    let y: number;
    if (side === 0) {
      x = FRAME + t * MAP_W;
      y = FRAME - depth;
    } else if (side === 1) {
      x = FRAME + t * MAP_W;
      y = FRAME + MAP_H + depth;
    } else if (side === 2) {
      x = FRAME - depth;
      y = FRAME + t * MAP_H;
    } else {
      x = FRAME + MAP_W + depth;
      y = FRAME + t * MAP_H;
    }
    const r = 3 + hash2(k, 9, 905) * 7;
    const shade = hash2(k, 10, 906);
    g.beginPath();
    polygonPath(g, x, y, r, 5 + (k % 3), hash2(k, 11, 907) * 6);
    g.fillStyle = mixHex(COLORS.cliffDark, COLORS.cliffLight, 0.25 + shade * 0.75);
    g.fill();
    g.beginPath();
    polygonPath(g, x - r * 0.25, y - r * 0.3, r * 0.5, 4, hash2(k, 12, 908) * 6);
    g.fillStyle = 'rgba(200,195,230,0.08)';
    g.fill();
  }
  g.restore();
  g.strokeStyle = '#0a090f';
  g.lineWidth = 4;
  g.strokeRect(FRAME - 2, FRAME - 2, MAP_W + 4, MAP_H + 4);
}

function plateColor(shade: number, k: number): string {
  return mixHex(COLORS.plateDark, COLORS.plateMid, Math.min(1, shade * 0.7 + k * 0.4));
}

function drawFloor(g: CanvasRenderingContext2D, grid: GridData): void {
  g.fillStyle = COLORS.plateDark;
  g.fillRect(0, 0, MAP_W, MAP_H);
  const P = TILE * 2;
  for (let by = 0; by < MAP_H; by += P) {
    for (let bx = 0; bx < MAP_W; bx += P) {
      const bc = bx / P;
      const br = by / P;
      const split = hash2(bc, br, 31);
      const panels: [number, number, number, number][] = [];
      if (split < 0.45) panels.push([bx, by, P, P]);
      else if (split < 0.65) panels.push([bx, by, P, TILE], [bx, by + TILE, P, TILE]);
      else if (split < 0.85) panels.push([bx, by, TILE, P], [bx + TILE, by, TILE, P]);
      else panels.push([bx, by, TILE, TILE], [bx + TILE, by, TILE, TILE], [bx, by + TILE, TILE, TILE], [bx + TILE, by + TILE, TILE, TILE]);
      for (let i = 0; i < panels.length; i++) {
        const [x, y, w, h] = panels[i]!;
        const col = Math.min(grid.cols - 1, Math.floor(x / TILE));
        const row = Math.min(grid.rows - 1, Math.floor(y / TILE));
        const shade = grid.cells[row * grid.cols + col]?.shade ?? 0.5;
        drawPanel(g, x, y, w, h, shade, hash2(bc * 7 + i, br, 32), bc * 4 + i, br);
      }
    }
  }
}

function drawPanel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, shade: number, k: number, hx: number, hy: number): void {
  g.fillStyle = plateColor(shade, k);
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  const sheen = g.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, 'rgba(160,150,230,0.07)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = sheen;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  // Bevel.
  g.fillStyle = 'rgba(175,165,240,0.16)';
  g.fillRect(x + 1, y + 1, w - 2, 1);
  g.fillRect(x + 1, y + 1, 1, h - 2);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(x + 1, y + h - 2, w - 2, 1);
  g.fillRect(x + w - 2, y + 1, 1, h - 2);
  // Seam.
  g.strokeStyle = 'rgba(5,4,12,0.75)';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // Detail.
  const d = hash2(hx, hy, 33);
  if (w >= TILE * 2 || h >= TILE * 2) {
    if (d < 0.35) {
      g.strokeStyle = 'rgba(0,0,0,0.3)';
      g.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
      g.strokeStyle = 'rgba(170,160,235,0.06)';
      g.strokeRect(x + 8.5, y + 8.5, w - 15, h - 15);
    } else if (d < 0.5) {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      const vx = x + w / 2 - 12;
      const vy = y + h / 2 - 7;
      for (let i = 0; i < 5; i++) g.fillRect(vx, vy + i * 3, 24, 1.5);
    }
  }
  const corners = [[x + 4, y + 4], [x + w - 5, y + 4], [x + 4, y + h - 5], [x + w - 5, y + h - 5]] as const;
  g.fillStyle = 'rgba(0,0,0,0.5)';
  for (const [rx, ry] of corners) g.fillRect(rx, ry, 1.6, 1.6);
  g.fillStyle = 'rgba(190,180,255,0.18)';
  for (const [rx, ry] of corners) g.fillRect(rx - 0.6, ry - 0.6, 1, 1);
}

function drawCircuits(g: CanvasRenderingContext2D): void {
  const lines: number[][] = [];
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
  for (let i = 0; i < 46; i++) {
    let x = Math.round((hash2(i, 0, 41) * MAP_W) / 10) * 10 + 0.5;
    let y = Math.round((hash2(i, 0, 42) * MAP_H) / 10) * 10 + 0.5;
    let dir = Math.floor(hash2(i, 0, 43) * 4) * 2;
    const pts = [x, y];
    const segs = 2 + Math.floor(hash2(i, 0, 44) * 4);
    for (let s = 0; s < segs; s++) {
      const len = 20 + hash2(i, s, 45) * 90;
      const [dx, dy] = dirs[dir]!;
      const k = dx !== 0 && dy !== 0 ? len * 0.5 : len;
      x += dx * k;
      y += dy * k;
      pts.push(x, y);
      dir = (dir + (hash2(i, s, 46) < 0.5 ? 1 : 7)) % 8;
    }
    lines.push(pts);
  }
  const strokeAll = (): void => {
    g.beginPath();
    for (const pts of lines) {
      g.moveTo(pts[0]!, pts[1]!);
      for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k]!, pts[k + 1]!);
    }
    g.stroke();
  };
  g.lineJoin = 'round';
  g.save();
  g.shadowColor = COLORS.circuit;
  g.shadowBlur = 7;
  g.strokeStyle = rgba(COLORS.circuit, 0.22);
  g.lineWidth = 2.4;
  strokeAll();
  g.restore();
  g.strokeStyle = rgba(COLORS.circuit, 0.55);
  g.lineWidth = 1;
  strokeAll();
  // Nodes and glowing dots.
  for (let i = 0; i < lines.length; i++) {
    const pts = lines[i]!;
    for (const k of [0, pts.length - 2]) {
      g.beginPath();
      g.arc(pts[k]!, pts[k + 1]!, 2.6, 0, Math.PI * 2);
      g.fillStyle = COLORS.plateDark;
      g.fill();
      g.strokeStyle = rgba(COLORS.circuit, 0.75);
      g.lineWidth = 1.1;
      g.stroke();
    }
    if (hash2(i, 1, 47) < 0.45) {
      const k = 2 * Math.floor(hash2(i, 2, 48) * (pts.length / 2));
      g.globalCompositeOperation = 'lighter';
      drawGlow(g, COLORS.circuit, pts[k]!, pts[k + 1]!, 9, 0.7);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#d8fbff';
      g.fillRect(pts[k]! - 1, pts[k + 1]! - 1, 2, 2);
    }
  }
}

function drawTileGrid(g: CanvasRenderingContext2D, grid: GridData): void {
  g.strokeStyle = COLORS.gridLine;
  g.lineWidth = 1;
  g.beginPath();
  for (let c = 1; c < grid.cols; c++) {
    g.moveTo(c * TILE + 0.5, 0);
    g.lineTo(c * TILE + 0.5, MAP_H);
  }
  for (let r = 1; r < grid.rows; r++) {
    g.moveTo(0, r * TILE + 0.5);
    g.lineTo(MAP_W, r * TILE + 0.5);
  }
  g.stroke();
}

function drawObstacles(g: CanvasRenderingContext2D, grid: GridData): void {
  const groups = new Map<string, number[]>();
  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i]!;
    if (cell.type !== 'rock') continue;
    const id = typeof cell.obstacleId === 'number' && cell.obstacleId >= 0 ? `o${cell.obstacleId}` : `c${i}`;
    let list = groups.get(id);
    if (!list) {
      list = [];
      groups.set(id, list);
    }
    list.push(i);
  }
  for (const cells of groups.values()) drawBoulderGroup(g, grid, cells);
}

function blobPath(g: CanvasRenderingContext2D, grid: GridData, cells: number[], scale: number, dx: number, dy: number): void {
  for (const i of cells) {
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    const cx = c * TILE + TILE / 2 + (hash2(c, r, 70) - 0.5) * 5 + dx;
    const cy = r * TILE + TILE / 2 + (hash2(c, r, 71) - 0.5) * 5 + dy;
    const n = 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + hash2(c, r, 80 + k) * 0.35;
      const rad = TILE * (0.6 + hash2(c, r, 100 + k) * 0.14) * scale;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (k === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }
}

function drawBoulderGroup(g: CanvasRenderingContext2D, grid: GridData, cells: number[]): void {
  let sx = 0;
  let sy = 0;
  for (const i of cells) {
    sx += (i % grid.cols) * TILE + TILE / 2;
    sy += Math.floor(i / grid.cols) * TILE + TILE / 2;
  }
  const cx = sx / cells.length;
  const cy = sy / cells.length;
  const span = TILE * (0.8 + Math.sqrt(cells.length) * 0.7);

  // Crater apron (scorched plating).
  g.beginPath();
  blobPath(g, grid, cells, 1.28, 0, 0);
  g.fillStyle = 'rgba(8,6,14,0.45)';
  g.fill('nonzero');
  // Drop shadow.
  g.beginPath();
  blobPath(g, grid, cells, 1, 6, 8);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fill('nonzero');
  // Outline, rim light, then the body offset down-right (leaves a lit upper-left rim).
  g.beginPath();
  blobPath(g, grid, cells, 1, 0, 0);
  g.strokeStyle = '#07060b';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#6b6684';
  g.fill('nonzero');
  g.save();
  g.clip('nonzero');
  const body = g.createRadialGradient(cx - span * 0.3, cy - span * 0.35, 4, cx, cy, span);
  body.addColorStop(0, '#4c4860');
  body.addColorStop(0.5, '#2b2838');
  body.addColorStop(1, '#100e17');
  g.beginPath();
  blobPath(g, grid, cells, 1, 2, 2.5);
  g.fillStyle = body;
  g.fill('nonzero');
  for (const i of cells) {
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    const x = c * TILE + TILE / 2;
    const y = r * TILE + TILE / 2;
    g.beginPath();
    polygonPath(g, x - 4, y - 5, 8 + hash2(c, r, 120) * 6, 5, hash2(c, r, 121) * 6);
    g.fillStyle = 'rgba(170,160,215,0.08)';
    g.fill();
    if (hash2(c, r, 122) < 0.6) {
      const pr = 3 + hash2(c, r, 123) * 5;
      const px = x + (hash2(c, r, 124) - 0.5) * 16;
      const py = y + (hash2(c, r, 125) - 0.5) * 16;
      g.beginPath();
      g.ellipse(px, py, pr, pr * 0.8, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fill();
      g.beginPath();
      g.ellipse(px, py, pr, pr * 0.8, 0, 0.15 * Math.PI, 0.85 * Math.PI);
      g.strokeStyle = 'rgba(180,170,230,0.18)';
      g.lineWidth = 1;
      g.stroke();
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    const a = hash2(c, r, 126) * Math.PI * 2;
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
    g.lineTo(x + Math.cos(a + 0.6) * 18, y + Math.sin(a + 0.6) * 18);
    g.stroke();
  }
  g.restore();
}

function drawEdgeShadow(g: CanvasRenderingContext2D): void {
  const d = 22;
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, 0, d, 0, 0, MAP_W, d],
    [0, MAP_H, 0, MAP_H - d, 0, MAP_H - d, MAP_W, d],
    [0, 0, d, 0, 0, 0, d, MAP_H],
    [MAP_W, 0, MAP_W - d, 0, MAP_W - d, 0, d, MAP_H],
  ];
  for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
    const grad = g.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(rx, ry, rw, rh);
  }
  const vg = g.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.4, MAP_W / 2, MAP_H / 2, MAP_W * 0.62);
  vg.addColorStop(0, 'rgba(3,2,10,0)');
  vg.addColorStop(1, 'rgba(3,2,10,0.4)');
  g.fillStyle = vg;
  g.fillRect(0, 0, MAP_W, MAP_H);
}

function drawBasePlatform(g: CanvasRenderingContext2D, team: Team, palKey: PaletteKey, grid: GridData): void {
  const pal = PALETTES[palKey];
  let minC = grid.cols;
  let minR = grid.rows;
  let maxC = -1;
  let maxR = -1;
  for (let i = 0; i < grid.cells.length; i++) {
    const cell = grid.cells[i]!;
    if (cell.type !== 'base' || cell.baseTeam !== team) continue;
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    minC = Math.min(minC, c);
    maxC = Math.max(maxC, c);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
  }
  if (maxC < 0) return;
  // The platform is anchored into the cliff on its outer side.
  const extra = FRAME - 6;
  const x = minC * TILE + (team === 0 ? -extra : 0) + 2;
  const y = minR * TILE + 2;
  const w = (maxC - minC + 1) * TILE + extra - 4;
  const h = (maxR - minR + 1) * TILE - 4;
  const pad = (inset: number): void => {
    g.beginPath();
    angledRectPath(g, x + inset, y + inset, w - inset * 2, h - inset * 2, 12 - inset * 0.5);
  };
  g.save();
  g.translate(5, 7);
  pad(0);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fill();
  g.restore();
  g.save();
  g.shadowColor = pal.main;
  g.shadowBlur = 16;
  pad(0);
  g.fillStyle = pal.dark;
  g.fill();
  g.restore();
  pad(0);
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, COLORS.metalLight);
  grad.addColorStop(0.4, COLORS.metalMid);
  grad.addColorStop(1, COLORS.metalDark);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = '#0d0e12';
  g.lineWidth = 1.5;
  g.stroke();
  pad(5);
  g.fillStyle = '#2e313b';
  g.fill();
  g.strokeStyle = rgba(pal.main, 0.85);
  g.lineWidth = 1.5;
  g.stroke();
  g.save();
  pad(5);
  g.clip();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.beginPath();
  for (let yy = y + 20; yy < y + h; yy += 20) {
    g.moveTo(x, yy + 0.5);
    g.lineTo(x + w, yy + 0.5);
  }
  g.stroke();
  g.restore();
  const cx = (minC + (maxC - minC + 1) / 2) * TILE;
  const cy = (minR + (maxR - minR + 1) / 2) * TILE;
  // Portal well.
  g.beginPath();
  g.arc(cx, cy, 34, 0, Math.PI * 2);
  g.fillStyle = '#121319';
  g.fill();
  g.strokeStyle = '#8a8f9c';
  g.lineWidth = 3;
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, 30, 0, Math.PI * 2);
  g.fillStyle = mixHex(pal.dark, '#000000', 0.4);
  g.fill();
  g.fillStyle = pal.bright;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillRect(cx + Math.cos(a) * 34 - 1.5, cy + Math.sin(a) * 34 - 1.5, 3, 3);
  }
  g.save();
  g.shadowColor = pal.main;
  g.shadowBlur = 6;
  g.fillStyle = pal.main;
  g.fillRect(x + 10, y + 9, w - 20, 2);
  g.fillRect(x + 10, y + h - 11, w - 20, 2);
  g.restore();
}

// ---------------------------------------------------------------- Starfield

let starCache: HTMLCanvasElement | null = null;
let starDpr = 0;
let twinkles: Float32Array | null = null;
const TWINKLES = 36;

function buildStars(dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(CANVAS_W * dpr);
  c.height = Math.round(CANVAS_H * dpr);
  const g = c.getContext('2d');
  if (!g) return c;
  g.scale(dpr, dpr);
  g.fillStyle = COLORS.space;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  const blobs: [number, number, number, string][] = [
    [0.2, 0.25, 0.4, 'rgba(90,50,200,0.16)'],
    [0.85, 0.75, 0.45, 'rgba(40,140,220,0.12)'],
    [0.55, 0.1, 0.3, 'rgba(180,60,200,0.1)'],
    [0.4, 0.9, 0.35, 'rgba(30,170,190,0.08)'],
  ];
  for (const [bx, by, br, col] of blobs) {
    const x = bx * CANVAS_W;
    const y = by * CANVAS_H;
    const r = br * CANVAS_W;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  for (let i = 0; i < 520; i++) {
    const x = hash2(i, 1, 201) * CANVAS_W;
    const y = hash2(i, 2, 202) * CANVAS_H;
    const s = 0.5 + hash2(i, 3, 203) ** 3 * 1.8;
    const b = 0.25 + hash2(i, 4, 204) * 0.75;
    g.fillStyle = hash2(i, 5, 205) < 0.2 ? `rgba(200,180,255,${b})` : `rgba(220,230,255,${b})`;
    g.fillRect(x, y, s, s);
  }
  return c;
}

/** Deep-space background (cached) plus a few live twinkling stars. `scroll` drifts it horizontally. */
export function drawStarfield(ctx: CanvasRenderingContext2D, time: number, dpr: number, scroll = 0): void {
  if (!starCache || starDpr !== dpr) {
    starCache = buildStars(dpr);
    starDpr = dpr;
  }
  if (!twinkles) {
    twinkles = new Float32Array(TWINKLES * 3);
    for (let i = 0; i < TWINKLES; i++) {
      twinkles[i * 3] = hash2(i, 0, 211) * CANVAS_W;
      twinkles[i * 3 + 1] = hash2(i, 1, 212) * CANVAS_H;
      twinkles[i * 3 + 2] = hash2(i, 2, 213) * 6.28;
    }
  }
  const off = ((scroll % CANVAS_W) + CANVAS_W) % CANVAS_W;
  if (off === 0) {
    ctx.drawImage(starCache, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    ctx.drawImage(starCache, -off, 0, CANVAS_W, CANVAS_H);
    ctx.drawImage(starCache, CANVAS_W - off, 0, CANVAS_W, CANVAS_H);
  }
  ctx.globalCompositeOperation = 'lighter';
  const glow = glowSpr('#b9d4ff');
  for (let i = 0; i < TWINKLES; i++) {
    let x = twinkles[i * 3]! - off;
    if (x < 0) x += CANVAS_W;
    const y = twinkles[i * 3 + 1]!;
    const tw = 0.5 + 0.5 * Math.sin(time * (0.8 + (i % 5) * 0.3) + twinkles[i * 3 + 2]!);
    const r = 2 + tw * 4;
    ctx.globalAlpha = 0.25 + 0.6 * tw;
    blitRect(ctx, glow, x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
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

interface Train {
  pal: PaletteKey;
  count: number;
  speed: number;
  phase: number;
  ay: number;
  freq: number;
  y0: number;
  dir: 1 | -1;
  kinds: UnitKind[];
}

const TRAINS: Train[] = [
  { pal: 'blue', count: 46, speed: 95, phase: 0, ay: 70, freq: 0.012, y0: 0.3, dir: 1, kinds: ['scout'] },
  { pal: 'purple', count: 36, speed: 80, phase: 600, ay: 90, freq: 0.009, y0: 0.72, dir: -1, kinds: ['scout', 'scout', 'shielded'] },
  { pal: 'red', count: 22, speed: 60, phase: 1200, ay: 50, freq: 0.015, y0: 0.52, dir: 1, kinds: ['tank', 'scout', 'scout'] },
];

/** Main-menu background: drifting asteroid field, serpent trains of units and neon comets. */
export function drawAttract(ctx: CanvasRenderingContext2D, time: number, dpr: number): void {
  drawStarfield(ctx, time, dpr, time * 6);
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
    ctx.fillStyle = a.r > 40 ? COLORS.cliffLight : COLORS.cliffMid;
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,150,255,0.2)';
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

  // Serpent trains of units snaking across space.
  const loop = CANVAS_W + 600;
  const p: [number, number] = [0, 0];
  const q: [number, number] = [0, 0];
  for (const tr of TRAINS) {
    const head = (time * tr.speed + tr.phase) % loop;
    const glow = glowSpr(PALETTES[tr.pal].main);
    const pos = (s: number, out: [number, number]): void => {
      out[0] = tr.dir === 1 ? s - 300 : CANVAS_W + 300 - s;
      out[1] = tr.y0 * CANVAS_H + Math.sin(s * tr.freq + tr.phase) * tr.ay;
    };
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < tr.count; i++) {
      pos(head - i * 11, p);
      blitRect(ctx, glow, p[0] - 10, p[1] - 10, 20, 20);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = tr.count - 1; i >= 0; i--) {
      const s = head - i * 11;
      pos(s, p);
      pos(s + 2, q);
      const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const spr = unitSprite(tr.kinds[i % tr.kinds.length]!, tr.pal, 0);
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(ang);
      ctx.scale(1.4, 1.4);
      blit(ctx, spr, 0, 0);
      ctx.restore();
    }
  }

  // Comets.
  const comets: [number, number, string, number][] = [
    [9, 0, PALETTES.blue.main, 0.2],
    [12, 4.5, PALETTES.purple.main, 0.55],
    [15, 9, COLORS.thorium, 0.85],
  ];
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const [period, offset, color, lane] of comets) {
    const t = ((time + offset) % period) / period;
    if (t > 0.45) continue;
    const k = t / 0.45;
    const sx = CANVAS_W + 150 - k * (CANVAS_W + 500);
    const sy = lane * CANVAS_H - 160 + k * 380;
    ctx.strokeStyle = rgba(color, 0.35);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 260, sy - 100);
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
