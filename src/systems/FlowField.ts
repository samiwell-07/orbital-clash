import type { GridData, GridPos, Team, World } from '../types';
import { otherTeam } from '../core/config';

// Reused BFS queue (resized only when a bigger grid shows up).
let queue = new Int32Array(0);

// Fixed tie-break order: east, west, south, north.
const DC = [1, -1, 0, 0];
const DR = [0, 0, 1, -1];

/** BFS from every base cell of `goalTeam`; same passability as A* (towers, rock and the other base blocked). */
function fillField(grid: GridData, goalTeam: Team, dist: Int32Array): void {
  const cols = grid.cols;
  const rows = grid.rows;
  const cells = grid.cells;
  dist.fill(-1);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (cell.type === 'base' && cell.baseTeam === goalTeam) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const cur = queue[head++]!;
    const cc = cur % cols;
    const cr = (cur - cc) / cols;
    const nd = dist[cur]! + 1;
    for (let d = 0; d < 4; d++) {
      const nc = cc + DC[d]!;
      const nr = cr + DR[d]!;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (dist[ni] !== -1) continue;
      const cell = cells[ni]!;
      if (cell.type !== 'empty' || cell.towerId !== null) continue;
      dist[ni] = nd;
      queue[tail++] = ni;
    }
  }
}

/**
 * Recomputes both teams' distance fields if the grid changed since the last call.
 * `world.flow.dist[team]` = steps from each cell to the base of otherTeam(team); -1 = unreachable/blocked.
 */
export function updateFlowFields(world: World): void {
  const grid = world.grid;
  const flow = world.flow;
  if (flow.version === grid.version) return;
  const n = grid.cols * grid.rows;
  if (queue.length < n) queue = new Int32Array(n);
  for (let t = 0; t < 2; t++) {
    const team = t as Team;
    let dist = flow.dist[team];
    if (dist.length !== n) {
      dist = new Int32Array(n);
      flow.dist[team] = dist;
    }
    fillField(grid, otherTeam(team), dist);
  }
  flow.version = grid.version;
}

/**
 * Next cell for a ground unit of `team` standing on (col,row): the 4-neighbour with the smallest
 * non-negative distance that is lower than the current one (any non-negative one if the current cell is
 * blocked/unreachable). Ties go east, west, south, north. Null on a target base cell or with no way forward.
 * Call `updateFlowFields` first.
 */
export function nextStep(world: World, team: Team, col: number, row: number): GridPos | null {
  const grid = world.grid;
  const cols = grid.cols;
  const rows = grid.rows;
  if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
  const i = row * cols + col;
  const cell = grid.cells[i]!;
  if (cell.type === 'base' && cell.baseTeam === otherTeam(team)) return null;
  const dist = world.flow.dist[team];
  const cur = dist[i]!;
  let best = cur < 0 ? 0x7fffffff : cur;
  let bestD = -1;
  for (let d = 0; d < 4; d++) {
    const nc = col + DC[d]!;
    const nr = row + DR[d]!;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
    const nd = dist[nr * cols + nc]!;
    if (nd >= 0 && nd < best) {
      best = nd;
      bestD = d;
    }
  }
  if (bestD < 0) return null;
  return { col: col + DC[bestD]!, row: row + DR[bestD]! };
}
