import type { SpatialIndex, Unit } from '../types';
import { MAP_H, MAP_W, SPATIAL_CELL } from '../core/config';

const MAX_UNITS = 4096;

export function createSpatialIndex(): SpatialIndex {
  const cols = Math.ceil(MAP_W / SPATIAL_CELL);
  const rows = Math.ceil(MAP_H / SPATIAL_CELL);
  return {
    cellSize: SPATIAL_CELL,
    cols,
    rows,
    head: new Int32Array(cols * rows).fill(-1),
    next: new Int32Array(MAX_UNITS).fill(-1),
    items: [],
    count: 0,
  };
}

function bucketOf(s: SpatialIndex, x: number, y: number): number {
  let c = Math.floor(x / s.cellSize);
  let r = Math.floor(y / s.cellSize);
  if (c < 0) c = 0;
  else if (c >= s.cols) c = s.cols - 1;
  if (r < 0) r = 0;
  else if (r >= s.rows) r = s.rows - 1;
  return r * s.cols + c;
}

/** Rebuilds the index from live units. Call once per sim step after movement. */
export function rebuildSpatial(s: SpatialIndex, units: readonly Unit[]): void {
  s.head.fill(-1);
  s.items.length = 0;
  let n = 0;
  for (const u of units) {
    if (!u.alive || n >= s.next.length) continue;
    const b = bucketOf(s, u.x, u.y);
    s.items[n] = u;
    s.next[n] = s.head[b] ?? -1;
    s.head[b] = n;
    n++;
  }
  s.count = n;
}

/**
 * Calls `fn` for every live unit within `radius` px of (x, y) (circle test includes unit radius 0).
 * Return `true` from fn to stop early. Optional `team` filter: only units of that team.
 */
export function queryUnits(
  s: SpatialIndex,
  x: number,
  y: number,
  radius: number,
  team: 0 | 1 | null,
  fn: (u: Unit, distSq: number) => boolean | void,
): void {
  const c0 = Math.max(0, Math.floor((x - radius) / s.cellSize));
  const c1 = Math.min(s.cols - 1, Math.floor((x + radius) / s.cellSize));
  const r0 = Math.max(0, Math.floor((y - radius) / s.cellSize));
  const r1 = Math.min(s.rows - 1, Math.floor((y + radius) / s.cellSize));
  const r2 = radius * radius;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      let i = s.head[r * s.cols + c] ?? -1;
      while (i !== -1) {
        const u = s.items[i];
        if (u && u.alive && (team === null || u.team === team)) {
          const dx = u.x - x;
          const dy = u.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && fn(u, d2) === true) return;
        }
        i = s.next[i] ?? -1;
      }
    }
  }
}
