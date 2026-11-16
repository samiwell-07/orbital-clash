import type { Cell, GridData, GridPos, Team, Vec2 } from '../types';
import { BASE_BUILD_MARGIN, BASE_COL, BASE_H, BASE_ROW, BASE_W, COLS, ROWS, TILE } from '../core/config';
import { createRng, randInt } from '../core/Random';
import { hasPath } from './Pathfinding';

const MAX_GEN_ATTEMPTS = 50;

function chebyshevToBase(col: number, row: number): number {
  let best = Infinity;
  for (let t = 0; t < 2; t++) {
    const c0 = BASE_COL[t as Team];
    const dx = col < c0 ? c0 - col : col > c0 + BASE_W - 1 ? col - (c0 + BASE_W - 1) : 0;
    const dy = row < BASE_ROW ? BASE_ROW - row : row > BASE_ROW + BASE_H - 1 ? row - (BASE_ROW + BASE_H - 1) : 0;
    const d = Math.max(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Cells where natural rock may never be placed: anything within 3 cells of a base (Chebyshev),
 * the columns next to the bases, and the spawn approach lanes in front of each portal.
 */
function rockForbidden(col: number, row: number): boolean {
  if (chebyshevToBase(col, row) <= 3) return true;
  if (col < BASE_W + 3 || col > COLS - BASE_W - 4) return true;
  if (row >= BASE_ROW - 2 && row <= BASE_ROW + BASE_H + 1 && (col <= BASE_W + 5 || col >= COLS - BASE_W - 6)) return true;
  return false;
}

function buildShade(seed: number, cells: Cell[]): void {
  const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
  const step = 4;
  const lw = Math.ceil(COLS / step) + 2;
  const lh = Math.ceil(ROWS / step) + 2;
  const lattice: number[] = [];
  for (let i = 0; i < lw * lh; i++) lattice.push(rng());
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const gx = c / step;
      const gy = r / step;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const tx = smooth(gx - x0);
      const ty = smooth(gy - y0);
      const v00 = lattice[y0 * lw + x0]!;
      const v10 = lattice[y0 * lw + x0 + 1]!;
      const v01 = lattice[(y0 + 1) * lw + x0]!;
      const v11 = lattice[(y0 + 1) * lw + x0 + 1]!;
      const top = v00 + (v10 - v00) * tx;
      const bottom = v01 + (v11 - v01) * tx;
      const v = (top + (bottom - top) * ty) * 0.8 + rng() * 0.2;
      cells[r * COLS + c]!.shade = Math.min(1, Math.max(0, v));
    }
  }
}

const DC4 = [1, -1, 0, 0];
const DR4 = [0, 0, 1, -1];

/** True if (col,row) or any of its 8 neighbours is rock (keeps formations separated by at least one cell). */
function touchesRock(cells: Cell[], col: number, row: number): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      const r = row + dr;
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
      if (cells[r * COLS + c]!.type === 'rock') return true;
    }
  }
  return false;
}

/**
 * Grows an organic blob of `size` cells from (sc,sr) inside [minC,maxC] x [1,ROWS-2].
 * Returns null if it could not reach `minSize`.
 */
function growBlob(
  rng: () => number,
  cells: Cell[],
  sc: number,
  sr: number,
  size: number,
  minSize: number,
  minC: number,
  maxC: number,
): GridPos[] | null {
  if (rockForbidden(sc, sr) || touchesRock(cells, sc, sr)) return null;
  const blob: GridPos[] = [{ col: sc, row: sr }];
  for (let tries = 0; tries < 60 && blob.length < size; tries++) {
    // Bias growth toward the most recent cells for a lumpy, organic shape.
    const from = blob[Math.max(0, blob.length - 1 - Math.floor(rng() * rng() * blob.length))]!;
    const d = Math.floor(rng() * 4);
    const nc = from.col + DC4[d]!;
    const nr = from.row + DR4[d]!;
    if (nc < minC || nc > maxC || nr < 1 || nr > ROWS - 2) continue;
    if (rockForbidden(nc, nr) || touchesRock(cells, nc, nr)) continue;
    if (blob.some((p) => p.col === nc && p.row === nr)) continue;
    blob.push({ col: nc, row: nr });
  }
  return blob.length >= minSize ? blob : null;
}

function placeRock(cells: Cell[], col: number, row: number, obstacleId: number): void {
  const cell = cells[row * COLS + col]!;
  cell.type = 'rock';
  cell.obstacleId = obstacleId;
}

function generate(seed: number): GridData {
  const cells: Cell[] = [];
  for (let i = 0; i < COLS * ROWS; i++) cells.push({ type: 'empty', towerId: null, baseTeam: null, shade: 0, obstacleId: -1 });
  const grid: GridData = { cols: COLS, rows: ROWS, cells, version: 0 };

  for (let t = 0; t < 2; t++) {
    const team = t as Team;
    for (let r = BASE_ROW; r < BASE_ROW + BASE_H; r++) {
      for (let c = BASE_COL[team]; c < BASE_COL[team] + BASE_W; c++) {
        const cell = cells[r * COLS + c]!;
        cell.type = 'base';
        cell.baseTeam = team;
      }
    }
  }

  const rng = createRng(seed);
  const half = COLS / 2;
  let nextObstacle = 0;
  // 2-4 formations total: 1 or 2 mirrored pairs, plus optionally one self-symmetric centre crater (never 5).
  const pairs = randInt(rng, 1, 2);
  const wantCenter = pairs === 1 ? rng() < 0.75 : false;

  if (wantCenter) {
    for (let attempt = 0; attempt < 30; attempt++) {
      // Left half of the centre crater (cols half-2..half-1); mirroring gives 4-8 cells straddling the centre line.
      const blob = growBlob(rng, cells, half - 1, randInt(rng, 3, ROWS - 4), randInt(rng, 2, 4), 2, half - 2, half - 1);
      if (!blob) continue;
      const id = nextObstacle++;
      for (const p of blob) {
        placeRock(cells, p.col, p.row, id);
        placeRock(cells, COLS - 1 - p.col, p.row, id);
      }
      break;
    }
  }

  let placed = 0;
  for (let attempt = 0; attempt < 80 && placed < pairs; attempt++) {
    // Keep pair blobs off the centre line so the mirror copy stays a separate formation.
    const blob = growBlob(rng, cells, randInt(rng, 5, half - 3), randInt(rng, 1, ROWS - 2), randInt(rng, 4, 9), 4, 4, half - 3);
    if (!blob) continue;
    const id = nextObstacle;
    nextObstacle += 2;
    for (const p of blob) {
      placeRock(cells, p.col, p.row, id);
      placeRock(cells, COLS - 1 - p.col, p.row, id + 1);
    }
    placed++;
  }

  buildShade(seed, cells);
  return grid;
}

function allSpawnsConnected(grid: GridData): boolean {
  for (let t = 0; t < 2; t++) {
    const team = t as Team;
    const enemy: Team = team === 0 ? 1 : 0;
    for (const s of getSpawnCells(team)) if (!hasPath(grid, s, enemy)) return false;
  }
  return true;
}

/** Builds the COLS x ROWS grid: base cells for both teams + 2-4 mirrored natural rock craters (deterministic from seed). */
export function createGrid(seed: number): GridData {
  let s = seed >>> 0;
  for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
    const grid = generate(s);
    if (allSpawnsConnected(grid)) return grid;
    s = (s + 1) >>> 0;
  }
  // Practically unreachable; fall back to a map without rocks.
  const grid = generate(s);
  for (const cell of grid.cells) {
    if (cell.type !== 'rock') continue;
    cell.type = 'empty';
    cell.obstacleId = -1;
  }
  return grid;
}

export function cellIndex(grid: GridData, col: number, row: number): number {
  return row * grid.cols + col;
}

export function inBounds(grid: GridData, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;
}

export function getCell(grid: GridData, col: number, row: number): Cell | null {
  if (!inBounds(grid, col, row)) return null;
  return grid.cells[row * grid.cols + col] ?? null;
}

/** In bounds, type 'empty' and no tower. */
export function isPassable(grid: GridData, col: number, row: number): boolean {
  const cell = getCell(grid, col, row);
  return cell !== null && cell.type === 'empty' && cell.towerId === null;
}

/** Sets/clears a tower on a cell and increments grid.version. */
export function setTowerAt(grid: GridData, col: number, row: number, towerId: number | null): void {
  const cell = getCell(grid, col, row);
  if (!cell) return;
  cell.towerId = towerId;
  grid.version++;
}

/** Pixel center of a cell (map space). */
export function cellCenter(col: number, row: number): Vec2 {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

/** Cell containing a map-space pixel (may be out of bounds). */
export function pixelToCell(x: number, y: number): GridPos {
  return { col: Math.floor(x / TILE), row: Math.floor(y / TILE) };
}

/** Cells immediately in front of a team's base (where its units spawn). */
export function getSpawnCells(team: Team): GridPos[] {
  const col = team === 0 ? BASE_W : COLS - BASE_W - 1;
  const out: GridPos[] = [];
  for (let r = BASE_ROW; r < BASE_ROW + BASE_H; r++) out.push({ col, row: r });
  return out;
}

/** True if within BASE_BUILD_MARGIN (Chebyshev) of any base cell. */
export function isNearBase(col: number, row: number): boolean {
  return chebyshevToBase(col, row) <= BASE_BUILD_MARGIN;
}
