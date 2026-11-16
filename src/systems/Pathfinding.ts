import type { GridData, GridPos, Team } from '../types';

// Reused scratch buffers (resized only when a bigger grid shows up).
let capacity = 0;
let gScore = new Int32Array(0);
let cameFrom = new Int32Array(0);
let stamp = new Int32Array(0);
let closedStamp = new Int32Array(0);
let heapNode = new Int32Array(0);
let heapF = new Int32Array(0);
let heapH = new Int32Array(0);
let heapSize = 0;
let generation = 0;

function ensureCapacity(n: number): void {
  if (n <= capacity) return;
  capacity = n;
  gScore = new Int32Array(n);
  cameFrom = new Int32Array(n);
  stamp = new Int32Array(n);
  closedStamp = new Int32Array(n);
  // Lazy deletion: each cell can be pushed at most once per neighbour improvement.
  heapNode = new Int32Array(n * 4 + 4);
  heapF = new Int32Array(n * 4 + 4);
  heapH = new Int32Array(n * 4 + 4);
  generation = 0;
}

/** Strict ordering: lower f, then lower h, then lower cell index. */
function less(a: number, b: number): boolean {
  const fa = heapF[a]!;
  const fb = heapF[b]!;
  if (fa !== fb) return fa < fb;
  const ha = heapH[a]!;
  const hb = heapH[b]!;
  if (ha !== hb) return ha < hb;
  return heapNode[a]! < heapNode[b]!;
}

function swap(a: number, b: number): void {
  let t = heapNode[a]!;
  heapNode[a] = heapNode[b]!;
  heapNode[b] = t;
  t = heapF[a]!;
  heapF[a] = heapF[b]!;
  heapF[b] = t;
  t = heapH[a]!;
  heapH[a] = heapH[b]!;
  heapH[b] = t;
}

function heapPush(node: number, f: number, h: number): void {
  let i = heapSize++;
  heapNode[i] = node;
  heapF[i] = f;
  heapH[i] = h;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!less(i, p)) break;
    swap(i, p);
    i = p;
  }
}

/** Removes the min entry; returns its node (min data is read before calling). */
function heapPop(): number {
  const top = heapNode[0]!;
  heapSize--;
  if (heapSize > 0) {
    heapNode[0] = heapNode[heapSize]!;
    heapF[0] = heapF[heapSize]!;
    heapH[0] = heapH[heapSize]!;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < heapSize && less(l, m)) m = l;
      if (r < heapSize && less(r, m)) m = r;
      if (m === i) break;
      swap(i, m);
      i = m;
    }
  }
  return top;
}

interface GoalBox {
  minC: number;
  maxC: number;
  minR: number;
  maxR: number;
}

// Base cells never change after grid creation, so the goal bounding box is cached per grid.
const goalCache = new WeakMap<GridData, [GoalBox | null, GoalBox | null]>();

function goalBox(grid: GridData, team: Team): GoalBox | null {
  let entry = goalCache.get(grid);
  if (!entry) {
    const boxes: [GoalBox | null, GoalBox | null] = [null, null];
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        const cell = grid.cells[r * grid.cols + c]!;
        if (cell.type !== 'base' || cell.baseTeam === null) continue;
        const b = boxes[cell.baseTeam];
        if (!b) {
          boxes[cell.baseTeam] = { minC: c, maxC: c, minR: r, maxR: r };
        } else {
          if (c < b.minC) b.minC = c;
          if (c > b.maxC) b.maxC = c;
          if (r < b.minR) b.minR = r;
          if (r > b.maxR) b.maxR = r;
        }
      }
    }
    entry = boxes;
    goalCache.set(grid, entry);
  }
  return entry[team];
}

const DC = [1, -1, 0, 0];
const DR = [0, 0, 1, -1];

/** Runs A*; returns the index of the reached goal cell, or -1. Fills cameFrom. */
function search(grid: GridData, start: GridPos, goalTeam: Team, extraBlocked?: ReadonlySet<number>): number {
  const cols = grid.cols;
  const rows = grid.rows;
  if (start.col < 0 || start.row < 0 || start.col >= cols || start.row >= rows) return -1;
  const box = goalBox(grid, goalTeam);
  if (!box) return -1;
  const n = cols * rows;
  ensureCapacity(n);
  generation++;
  if (generation >= 0x7fffffff) {
    stamp.fill(0);
    closedStamp.fill(0);
    generation = 1;
  }
  const gen = generation;
  const cells = grid.cells;
  const blocked = extraBlocked && extraBlocked.size > 0 ? extraBlocked : null;

  const startIdx = start.row * cols + start.col;
  heapSize = 0;
  stamp[startIdx] = gen;
  gScore[startIdx] = 0;
  cameFrom[startIdx] = -1;
  {
    const dx = start.col < box.minC ? box.minC - start.col : start.col > box.maxC ? start.col - box.maxC : 0;
    const dy = start.row < box.minR ? box.minR - start.row : start.row > box.maxR ? start.row - box.maxR : 0;
    heapPush(startIdx, dx + dy, dx + dy);
  }

  while (heapSize > 0) {
    const cur = heapPop();
    if (closedStamp[cur] === gen) continue;
    closedStamp[cur] = gen;
    const curCell = cells[cur]!;
    if (curCell.type === 'base' && curCell.baseTeam === goalTeam) return cur;
    const cc = cur % cols;
    const cr = (cur - cc) / cols;
    const ng = gScore[cur]! + 1;
    for (let d = 0; d < 4; d++) {
      const nc = cc + DC[d]!;
      const nr = cr + DR[d]!;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (closedStamp[ni] === gen) continue;
      const cell = cells[ni]!;
      if (cell.type === 'base') {
        if (cell.baseTeam !== goalTeam) continue;
      } else if (cell.type !== 'empty' || cell.towerId !== null || (blocked !== null && blocked.has(ni))) {
        continue;
      }
      if (stamp[ni] === gen && gScore[ni]! <= ng) continue;
      stamp[ni] = gen;
      gScore[ni] = ng;
      cameFrom[ni] = cur;
      const dx = nc < box.minC ? box.minC - nc : nc > box.maxC ? nc - box.maxC : 0;
      const dy = nr < box.minR ? box.minR - nr : nr > box.maxR ? nr - box.maxR : 0;
      const h = dx + dy;
      heapPush(ni, ng + h, h);
    }
  }
  return -1;
}

/**
 * A* (4-directional, Manhattan heuristic to nearest goal cell).
 * Goal = any 'base' cell whose baseTeam === goalTeam. Other base cells, rocks and towers are blocked.
 * `extraBlocked` = cell indices treated as blocked (used to test hypothetical builds).
 * Returns the path INCLUDING start and ending ON the goal base cell, or null.
 */
export function findPath(grid: GridData, start: GridPos, goalTeam: Team, extraBlocked?: ReadonlySet<number>): GridPos[] | null {
  const goal = search(grid, start, goalTeam, extraBlocked);
  if (goal < 0) return null;
  const cols = grid.cols;
  const path: GridPos[] = [];
  for (let i = goal; i !== -1; i = cameFrom[i]!) {
    const c = i % cols;
    path.push({ col: c, row: (i - c) / cols });
  }
  path.reverse();
  return path;
}

export function hasPath(grid: GridData, start: GridPos, goalTeam: Team, extraBlocked?: ReadonlySet<number>): boolean {
  return search(grid, start, goalTeam, extraBlocked) >= 0;
}

// Reused flood-fill buffers.
let floodMark = new Uint8Array(0);
let floodQueue = new Int32Array(0);
const goalCellCache = new WeakMap<GridData, [Int32Array, Int32Array]>();

function goalCells(grid: GridData, team: Team): Int32Array {
  let entry = goalCellCache.get(grid);
  if (!entry) {
    const lists: [number[], number[]] = [[], []];
    for (let i = 0; i < grid.cells.length; i++) {
      const cell = grid.cells[i]!;
      if (cell.type === 'base' && cell.baseTeam !== null) lists[cell.baseTeam].push(i);
    }
    entry = [Int32Array.from(lists[0]), Int32Array.from(lists[1])];
    goalCellCache.set(grid, entry);
  }
  return entry[team];
}

/**
 * BFS flood fill from every base cell of `goalTeam`, using the same passability rules as A*
 * (`extraBlocked` cells are treated as blocked). Returns a per-cell mark array (1 = can reach the goal).
 * The returned buffer is reused and overwritten by the next call.
 */
export function floodFromGoal(grid: GridData, goalTeam: Team, extraBlocked?: ReadonlySet<number>): Uint8Array {
  const cols = grid.cols;
  const rows = grid.rows;
  const n = cols * rows;
  if (floodMark.length !== n) {
    floodMark = new Uint8Array(n);
    floodQueue = new Int32Array(n);
  } else {
    floodMark.fill(0);
  }
  const mark = floodMark;
  const queue = floodQueue;
  const cells = grid.cells;
  const blocked = extraBlocked && extraBlocked.size > 0 ? extraBlocked : null;
  let head = 0;
  let tail = 0;
  const seeds = goalCells(grid, goalTeam);
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i]!;
    mark[s] = 1;
    queue[tail++] = s;
  }
  while (head < tail) {
    const cur = queue[head++]!;
    const cc = cur % cols;
    const cr = (cur - cc) / cols;
    for (let d = 0; d < 4; d++) {
      const nc = cc + DC[d]!;
      const nr = cr + DR[d]!;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (mark[ni] === 1) continue;
      const cell = cells[ni]!;
      // Goal base cells are all seeded already; other base cells are blocked.
      if (cell.type !== 'empty' || cell.towerId !== null || (blocked !== null && blocked.has(ni))) continue;
      mark[ni] = 1;
      queue[tail++] = ni;
    }
  }
  return mark;
}

/**
 * True if A* from `start` would reach the goal, given a mark array from `floodFromGoal`.
 * Like A*, the start cell itself is always allowed, so a reached neighbour is enough.
 */
export function floodReaches(grid: GridData, mark: Uint8Array, start: GridPos): boolean {
  const cols = grid.cols;
  const rows = grid.rows;
  const c = start.col;
  const r = start.row;
  if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
  const i = r * cols + c;
  if (mark[i] === 1) return true;
  if (c > 0 && mark[i - 1] === 1) return true;
  if (c < cols - 1 && mark[i + 1] === 1) return true;
  if (r > 0 && mark[i - cols] === 1) return true;
  return r < rows - 1 && mark[i + cols] === 1;
}
