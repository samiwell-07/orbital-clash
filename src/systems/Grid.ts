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

/** Cells where natural rock may never be placed (base surroundings, spawn lanes). */
function rockForbidden(col: number, row: number): boolean {
  if (chebyshevToBase(col, row) <= 2) return true;
  if (row >= 6 && row <= 11 && ((col >= 2 && col <= 4) || (col >= COLS - 5 && col <= COLS - 3))) return true;
  for (let t = 0; t < 2; t++) {
    for (const s of getSpawnCells(t as Team)) if (s.col === col && s.row === row) return true;
  }
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

function generate(seed: number): GridData {
  const cells: Cell[] = [];
  for (let i = 0; i < COLS * ROWS; i++) cells.push({ type: 'empty', towerId: null, baseTeam: null, shade: 0 });
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
  // Each left-half cluster is mirrored, giving 6-8 clusters total.
  const pairs = randInt(rng, 3, 4);
  let placedPairs = 0;
  for (let attempt = 0; attempt < 60 && placedPairs < pairs; attempt++) {
    const sc = randInt(rng, 3, half - 1);
    const sr = randInt(rng, 0, ROWS - 1);
    if (rockForbidden(sc, sr) || cells[sr * COLS + sc]!.type !== 'empty') continue;
    const size = randInt(rng, 1, 4);
    const cluster: GridPos[] = [{ col: sc, row: sr }];
    for (let tries = 0; tries < 12 && cluster.length < size; tries++) {
      const base = cluster[Math.floor(rng() * cluster.length)]!;
      const dir = Math.floor(rng() * 4);
      const nc = base.col + (dir === 0 ? 1 : dir === 1 ? -1 : 0);
      const nr = base.row + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
      if (nc < 0 || nc >= half || nr < 0 || nr >= ROWS) continue;
      if (rockForbidden(nc, nr)) continue;
      if (cluster.some((p) => p.col === nc && p.row === nr)) continue;
      if (cells[nr * COLS + nc]!.type !== 'empty') continue;
      cluster.push({ col: nc, row: nr });
    }
    for (const p of cluster) {
      cells[p.row * COLS + p.col]!.type = 'rock';
      cells[p.row * COLS + (COLS - 1 - p.col)]!.type = 'rock';
    }
    placedPairs++;
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

/** Builds the 32x18 grid: base cells for both teams + mirrored natural rock outcrops (deterministic from seed). */
export function createGrid(seed: number): GridData {
  let s = seed >>> 0;
  for (let i = 0; i < MAX_GEN_ATTEMPTS; i++) {
    const grid = generate(s);
    if (allSpawnsConnected(grid)) return grid;
    s = (s + 1) >>> 0;
  }
  // Practically unreachable; fall back to a map without rocks.
  const grid = generate(s);
  for (const cell of grid.cells) if (cell.type === 'rock') cell.type = 'empty';
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
