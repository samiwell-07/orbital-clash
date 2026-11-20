import type { Emit, Mission, PlayerId, Unit, UnitKind, World } from '@/types';
import { ALL_UNITS } from '@/types';
import { UNIT_DEFS } from '@/data';
import { DIRS4, addUnit, isTerrainBlocked, occupantAt } from '@/sim/core';
import { AIR_HEIGHT } from '@/sim/army/constants';
import { launchHp } from '@/sim/units/tuning';

export interface GarrisonTile {
  tx: number;
  ty: number;
}

const OWN = 1;
const HOSTILE = 2;
const CONTESTED = 3;

/**
 * The owner's territory: floor tiles strictly nearer (BFS over terrain) to its base than to any hostile base,
 * that are free to stand on (no structure, no base pad, no scripted build site). Row-major order.
 */
export function territoryTiles(w: World, owner: PlayerId, mission: Mission | null = w.settings.mission): GarrisonTile[] {
  const p = w.players[owner];
  const g = w.grid;
  if (!p?.baseBuilt) return [];
  const n = g.w * g.h;
  const dist = new Int32Array(n).fill(-1);
  const side = new Uint8Array(n);
  const queue = new Int32Array(n);
  let tail = 0;
  const seed = (tx: number, ty: number, s: number) => {
    const i = ty * g.w + tx;
    if (dist[i] === 0) { side[i] = CONTESTED; return; }
    dist[i] = 0;
    side[i] = s;
    queue[tail++] = i;
  };
  seed(p.baseTx, p.baseTy, OWN);
  for (const q of w.players) {
    if (q.id !== owner && q.alive && q.baseBuilt && q.team !== p.team) seed(q.baseTx, q.baseTy, HOSTILE);
  }
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % g.w;
    const y = (i - x) / g.w;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (isTerrainBlocked(g, nx, ny)) continue;
      const j = ny * g.w + nx;
      if (dist[j] === -1) {
        dist[j] = dist[i] + 1;
        side[j] = side[i];
        queue[tail++] = j;
      } else if (dist[j] === dist[i] + 1 && side[j] !== side[i]) {
        side[j] = CONTESTED;
      }
    }
  }
  const reserved = new Set<number>();
  for (const b of mission?.map.baseTiles ?? []) if (b) reserved.add(b.ty * g.w + b.tx);
  for (const q of w.players) if (q.baseBuilt) reserved.add(q.baseTy * g.w + q.baseTx);
  for (const e of mission?.timeline ?? []) if (e.action.a === 'build') reserved.add(e.action.ty * g.w + e.action.tx);
  const out: GarrisonTile[] = [];
  for (let i = 0; i < n; i++) {
    if (side[i] !== OWN || reserved.has(i)) continue;
    const tx = i % g.w;
    const ty = (i - tx) / g.w;
    if (occupantAt(g, tx, ty) === 0) out.push({ tx, ty });
  }
  return out;
}

/** Stable sub-tile offset (no world RNG, so deploying never shifts the sim's random stream). */
function jitter(tx: number, ty: number, salt: number): number {
  const h = Math.imul(tx * 73856093 ^ ty * 19349663 ^ salt * 83492791, 2654435761) >>> 24;
  return (h / 255 - 0.5) * 0.3;
}

/**
 * Fills the scripted enemy's territory with idle troops at mission start: one per free tile. Troops are
 * taken from its seeded stored army first (keeping the stored mix); when the seed is too small to fill the
 * zone, the rest are extra troops of the same mix (or of its spawn towers' outputs when it has no seed).
 * Returns how many were deployed.
 */
export function deployGarrison(w: World, owner: PlayerId): number {
  const p = w.players[owner];
  const tiles = territoryTiles(w, owner);
  if (tiles.length === 0) return 0;
  const kinds = ALL_UNITS.filter((k) => (p.stored[k] ?? 0) > 0);
  const total = kinds.reduce((a, k) => a + (p.stored[k] ?? 0), 0);
  let pool: UnitKind[] = kinds;
  let weight = kinds.map((k) => (p.stored[k] ?? 0) / total);
  if (pool.length === 0) {
    // No seeded army: man the zone with what its spawn towers make.
    const made = new Set<UnitKind>();
    for (const s of w.structures.values()) if (s.owner === owner && s.output) made.add(s.output);
    pool = made.size > 0 ? ALL_UNITS.filter((k) => made.has(k)) : ['scout'];
    weight = pool.map(() => 1 / pool.length);
  }
  const acc = pool.map(() => 0);
  const foe = w.players[p.attack.targetPlayer];
  for (const t of tiles) {
    // Smooth weighted round-robin: the garrison mixes kinds in the stored army's proportions.
    let pick = 0;
    for (let i = 0; i < pool.length; i++) {
      acc[i] += weight[i];
      if (acc[i] > acc[pick]) pick = i;
    }
    acc[pick] -= 1;
    const kind = pool[pick];
    if ((p.stored[kind] ?? 0) > 0) p.stored[kind] = (p.stored[kind] ?? 0) - 1;
    const def = UNIT_DEFS[kind];
    const hp = launchHp(p.tech, kind);
    const x = t.tx + 0.5 + jitter(t.tx, t.ty, 1);
    const y = t.ty + 0.5 + jitter(t.tx, t.ty, 2);
    addUnit(w, {
      kind, owner, targetPlayer: p.attack.targetPlayer, x, y,
      z: def.layer === 'air' ? AIR_HEIGHT : 0, hp, maxHp: hp, layer: def.layer, state: 'guarding',
      heading: foe?.baseBuilt ? Math.atan2(foe.baseTy + 0.5 - y, foe.baseTx + 0.5 - x) : 0,
    });
  }
  return tiles.length;
}

export function guardCount(w: World, owner: PlayerId, kind: UnitKind): number {
  let n = 0;
  for (const u of w.units) if (u.state === 'guarding' && u.owner === owner && u.kind === kind) n++;
  return n;
}

/**
 * Sends up to `count` idle troops of a kind into the attack on `target`, front line (nearest that base)
 * first. Woken troops march from where they stand. Returns how many left the garrison.
 */
export function wakeGuards(w: World, owner: PlayerId, kind: UnitKind, count: number, target: PlayerId, emit: Emit): number {
  const q = w.players[target];
  const guards: Unit[] = w.units.filter((u) => u.state === 'guarding' && u.owner === owner && u.kind === kind);
  if (guards.length === 0 || count <= 0) return 0;
  const bx = q ? q.baseTx + 0.5 : 0;
  const by = q ? q.baseTy + 0.5 : 0;
  const d = (u: Unit) => (u.x - bx) ** 2 + (u.y - by) ** 2;
  guards.sort((a, b) => d(a) - d(b) || a.id - b.id);
  const n = Math.min(count, guards.length);
  for (let i = 0; i < n; i++) {
    const u = guards[i];
    u.state = 'marching';
    u.targetPlayer = target;
    u.travelled = 0;
  }
  w.players[owner].stats.unitsLaunched += n;
  emit({ t: 'unitLaunched', owner, kind, count: n });
  return n;
}
