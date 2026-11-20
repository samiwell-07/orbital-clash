import type { Emit, PlayerId, Structure, Unit, UnitDef, Vec2, World } from '@/types';
import { gridVersion, removeStructure } from '@/sim/core';
import { CHEW_HITS_PER_SEC, CHEW_RANGE } from './constants';

const UNREACHED = 0xffff;
const N8: readonly (readonly [number, number])[] = [
  [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1],
];

/** Structure a blocked unit chews, plus a step-count field leading to the free tiles beside it. */
export interface Chew {
  s: Structure;
  approach: Uint16Array;
}

interface Cache {
  version: number;
  w: number;
  h: number;
  label: Int32Array;
  queue: Int32Array;
  entries: Map<number, Chew | null>;
}

const caches = new WeakMap<World, Cache>();

function relabel(w: World, c: Cache): void {
  const { w: gw, h: gh, terrain, occupant } = w.grid;
  const n = gw * gh;
  if (c.label.length !== n) {
    c.label = new Int32Array(n);
    c.queue = new Int32Array(n);
  }
  const { label, queue } = c;
  label.fill(0);
  let next = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] !== 0 || terrain[i] !== 0 || occupant[i] !== 0) continue;
    next++;
    let head = 0;
    let tail = 0;
    label[i] = next;
    queue[tail++] = i;
    while (head < tail) {
      const v = queue[head++];
      const x = v % gw;
      const y = (v - x) / gw;
      for (let d = 0; d < 4; d++) {
        const nx = x + N8[d][0];
        const ny = y + N8[d][1];
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx;
        if (label[ni] !== 0 || terrain[ni] !== 0 || occupant[ni] !== 0) continue;
        label[ni] = next;
        queue[tail++] = ni;
      }
    }
  }
  c.version = gridVersion(w.grid);
  c.w = gw;
  c.h = gh;
  c.entries.clear();
}

function cacheFor(w: World): Cache {
  let c = caches.get(w);
  if (!c) {
    c = { version: -1, w: 0, h: 0, label: new Int32Array(0), queue: new Int32Array(0), entries: new Map() };
    caches.set(w, c);
  }
  if (c.version !== gridVersion(w.grid) || c.w !== w.grid.w || c.h !== w.grid.h) relabel(w, c);
  return c;
}

function buildApproach(c: Cache, s: Structure, region: number): Uint16Array {
  const { w: gw, h: gh, label, queue } = c;
  const dist = new Uint16Array(gw * gh).fill(UNREACHED);
  let head = 0;
  let tail = 0;
  for (let d = 0; d < 4; d++) {
    const nx = s.tx + N8[d][0];
    const ny = s.ty + N8[d][1];
    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
    const ni = ny * gw + nx;
    if (label[ni] !== region) continue;
    dist[ni] = 0;
    queue[tail++] = ni;
  }
  while (head < tail) {
    const v = queue[head++];
    const x = v % gw;
    const y = (v - x) / gw;
    for (let d = 0; d < 8; d++) {
      const nx = x + N8[d][0];
      const ny = y + N8[d][1];
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx;
      if (label[ni] !== region || dist[ni] !== UNREACHED) continue;
      if (d >= 4 && (label[y * gw + nx] !== region || label[ny * gw + x] !== region)) continue;
      dist[ni] = dist[v] + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

function compute(w: World, c: Cache, owner: PlayerId, target: PlayerId, region: number): Chew | null {
  const team = w.players[owner].team;
  const base = w.players[target];
  if (!base.baseBuilt) return null;
  let best: Structure | null = null;
  let bestScore = Infinity;
  for (const s of w.structures.values()) {
    if (w.players[s.owner].team === team) continue;
    let touches = false;
    for (let d = 0; d < 4 && !touches; d++) {
      const nx = s.tx + N8[d][0];
      const ny = s.ty + N8[d][1];
      touches = nx >= 0 && ny >= 0 && nx < c.w && ny < c.h && c.label[ny * c.w + nx] === region;
    }
    if (!touches) continue;
    const score = Math.hypot(s.tx - base.baseTx, s.ty - base.baseTy);
    if (score < bestScore || (score === bestScore && best !== null && s.id < best.id)) {
      best = s;
      bestScore = score;
    }
  }
  return best ? { s: best, approach: buildApproach(c, best, region) } : null;
}

/**
 * The enemy structure bordering the free region around tile (tx, ty) that lies closest to the
 * target base. Cached per grid version; null when nothing chewable borders the region.
 */
export function chewFor(w: World, owner: PlayerId, target: PlayerId, tx: number, ty: number): Chew | null {
  const c = cacheFor(w);
  if (tx < 0 || ty < 0 || tx >= c.w || ty >= c.h) return null;
  const region = c.label[ty * c.w + tx];
  if (region === 0) return null;
  const key = (region * 4 + owner) * 4 + target;
  let e = c.entries.get(key);
  if (e === undefined) {
    e = compute(w, c, owner, target, region);
    c.entries.set(key, e);
  }
  return e;
}

/** Unit vector (zero when at the goal or stuck) down the approach field, like flowDir. */
export function descend(w: World, field: Uint16Array, x: number, y: number, out: Vec2): Vec2 {
  out.x = 0;
  out.y = 0;
  const gw = w.grid.w;
  const gh = w.grid.h;
  const tx = Math.min(gw - 1, Math.max(0, Math.floor(x)));
  const ty = Math.min(gh - 1, Math.max(0, Math.floor(y)));
  const cur = field[ty * gw + tx];
  if (cur === 0) return out;
  let best = cur;
  let bx = -1;
  let by = -1;
  for (let d = 0; d < 8; d++) {
    const nx = tx + N8[d][0];
    const ny = ty + N8[d][1];
    if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
    const v = field[ny * gw + nx];
    if (v >= best) continue;
    if (d >= 4 && (field[ty * gw + nx] === UNREACHED || field[ny * gw + tx] === UNREACHED)) continue;
    best = v;
    bx = nx;
    by = ny;
  }
  if (bx < 0) return out;
  const vx = bx + 0.5 - x;
  const vy = by + 0.5 - y;
  const len = Math.hypot(vx, vy);
  if (len > 1e-6) {
    out.x = vx / len;
    out.y = vy / len;
  }
  return out;
}

export function inChewRange(x: number, y: number, s: Structure): boolean {
  const dx = s.tx + 0.5 - x;
  const dy = s.ty + 0.5 - y;
  return dx * dx + dy * dy <= CHEW_RANGE * CHEW_RANGE;
}

/** Applies one tick of unit damage to a chewed structure; destroys it at 0 hp. */
export function chewStructure(w: World, u: Unit, s: Structure, def: UnitDef, dt: number, emit: Emit): void {
  s.hp -= def.structureDamage * CHEW_HITS_PER_SEC * dt;
  if (s.hp > 0) {
    if ((w.tick + u.id) % 20 === 0) emit({ t: 'structureHit', id: s.id, x: s.tx + 0.5, y: s.ty + 0.5 });
    return;
  }
  s.hp = 0;
  removeStructure(w, s.id);
  emit({ t: 'structureDestroyed', id: s.id, kind: s.kind, owner: s.owner, x: s.tx + 0.5, y: s.ty + 0.5 });
}
