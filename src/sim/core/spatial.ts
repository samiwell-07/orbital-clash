import type { Unit, World } from '@/types';

const CELL = 2;
const INV_CELL = 1 / CELL;

class Hash {
  cols = 0;
  rows = 0;
  count = 0;
  cellStart = new Int32Array(1);
  cursor = new Int32Array(1);
  items = new Int32Array(64);
  cellOf = new Int32Array(64);
}

const hashes = new WeakMap<World, Hash>();

function hashFor(w: World): Hash {
  let h = hashes.get(w);
  if (!h) {
    h = new Hash();
    hashes.set(w, h);
  }
  return h;
}

function cellX(h: Hash, x: number): number {
  const c = Math.floor(x * INV_CELL);
  return c < 0 ? 0 : c >= h.cols ? h.cols - 1 : c;
}

function cellY(h: Hash, y: number): number {
  const c = Math.floor(y * INV_CELL);
  return c < 0 ? 0 : c >= h.rows ? h.rows - 1 : c;
}

/** Re-bucket all non-dead units (counting sort, no per-call allocation once warmed up). */
export function rebuild(w: World): void {
  const h = hashFor(w);
  const units = w.units;
  const n = units.length;
  const cols = Math.max(1, Math.ceil(w.grid.w / CELL));
  const rows = Math.max(1, Math.ceil(w.grid.h / CELL));
  if (cols !== h.cols || rows !== h.rows) {
    h.cols = cols;
    h.rows = rows;
    h.cellStart = new Int32Array(cols * rows + 1);
    h.cursor = new Int32Array(cols * rows + 1);
  }
  if (n > h.items.length) {
    const cap = Math.max(n, h.items.length * 2);
    h.items = new Int32Array(cap);
    h.cellOf = new Int32Array(cap);
  }
  const { cellStart, cursor, items, cellOf } = h;
  cellStart.fill(0);
  for (let i = 0; i < n; i++) {
    const u = units[i];
    if (u.state === 'dead') {
      cellOf[i] = -1;
      continue;
    }
    const c = cellY(h, u.y) * cols + cellX(h, u.x);
    cellOf[i] = c;
    cellStart[c + 1]++;
  }
  for (let c = 0; c < cols * rows; c++) cellStart[c + 1] += cellStart[c];
  cursor.set(cellStart);
  for (let i = 0; i < n; i++) {
    const c = cellOf[i];
    if (c >= 0) items[cursor[c]++] = i;
  }
  h.count = n;
}

function ready(w: World): Hash {
  const h = hashFor(w);
  if (h.count !== w.units.length || h.cols === 0) rebuild(w);
  return h;
}

/** Calls cb(unit, distSq) for every live unit within radius r. Do not add/remove units inside cb. */
export function queryRadius(
  w: World,
  x: number,
  y: number,
  r: number,
  cb: (u: Unit, d2: number) => void,
): void {
  const h = ready(w);
  const r2 = r * r;
  const x0 = cellX(h, x - r);
  const x1 = cellX(h, x + r);
  const y0 = cellY(h, y - r);
  const y1 = cellY(h, y + r);
  const units = w.units;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const c = cy * h.cols + cx;
      for (let k = h.cellStart[c], e = h.cellStart[c + 1]; k < e; k++) {
        const u = units[h.items[k]];
        const dx = u.x - x;
        const dy = u.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) cb(u, d2);
      }
    }
  }
}

/** Closest live unit within r accepted by filter, or null. */
export function nearest(
  w: World,
  x: number,
  y: number,
  r: number,
  filter?: (u: Unit) => boolean,
): Unit | null {
  const h = ready(w);
  let best: Unit | null = null;
  let bestD2 = r * r;
  const x0 = cellX(h, x - r);
  const x1 = cellX(h, x + r);
  const y0 = cellY(h, y - r);
  const y1 = cellY(h, y + r);
  const units = w.units;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const c = cy * h.cols + cx;
      for (let k = h.cellStart[c], e = h.cellStart[c + 1]; k < e; k++) {
        const u = units[h.items[k]];
        const dx = u.x - x;
        const dy = u.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2 && (best === null || d2 < bestD2 || u.id < best.id) && (!filter || filter(u))) {
          best = u;
          bestD2 = d2;
        }
      }
    }
  }
  return best;
}
