import type { Emit, Intent, PlayerId, Rock, System, WeaponKind, World } from '@/types';
import { WEAPONS } from '@/types';
import { DEFS } from '@/data';
import { rand, randRange, structureAt, isTerrainBlocked } from '@/sim/core';
import { addThorium } from './thorium';
import { mapThoriumFactor } from './meteors';
import { ECON } from './tuning';

/** Last player to carry a rock; credited when a dropped rock is later smashed over a tower. */
const lastCarrier = new WeakMap<Rock, PlayerId>();

/**
 * Smashes a rock and credits its thorium (rock.thorium * thoriumRate * map factor) to `credit`.
 * Also used by combat when a weapon shot hits a rock. Returns the thorium paid (0 if already smashed).
 */
export function smashRock(w: World, rockId: number, credit: PlayerId, emit: Emit): number {
  const r = w.rocks.find((x) => x.id === rockId);
  if (!r || r.state === 'smashed') return 0;
  if (r.state === 'grabbed' && r.carriedBy !== -1) {
    const ship = w.players[r.carriedBy].ship;
    if (ship.carrying === r.id) ship.carrying = 0;
  }
  r.state = 'smashed';
  r.carriedBy = -1;
  const paid = Math.round(r.thorium * w.settings.thoriumRate * mapThoriumFactor(w));
  addThorium(w, credit, paid, emit);
  emit({ t: 'rockSmashed', id: r.id, x: r.x, y: r.y, thorium: paid, owner: credit });
  return paid;
}

function release(w: World, r: Rock): void {
  if (r.carriedBy !== -1) {
    const ship = w.players[r.carriedBy].ship;
    if (ship.carrying === r.id) ship.carrying = 0;
  }
  r.state = 'landed';
  r.carriedBy = -1;
  r.vx = 0;
  r.vy = 0;
}

export function handleRockIntent(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'grab' && intent.t !== 'drop') return false;
  const p = w.players[intent.player];
  if (!p || !p.alive) return true;
  if (intent.t === 'drop') {
    const held = w.rocks.find((r) => r.id === p.ship.carrying);
    if (held) release(w, held);
    p.ship.carrying = 0;
    return true;
  }
  if (p.ship.carrying !== 0) return true;
  let best: Rock | null = null;
  let bestD = ECON.grabRange * ECON.grabRange;
  for (const r of w.rocks) {
    if (r.state !== 'drifting' && r.state !== 'landed') continue;
    const d = (r.x - p.ship.x) ** 2 + (r.y - p.ship.y) ** 2;
    if (d < bestD) {
      best = r;
      bestD = d;
    }
  }
  if (!best) return true;
  best.state = 'grabbed';
  best.carriedBy = intent.player;
  best.vx = 0;
  best.vy = 0;
  lastCarrier.set(best, intent.player);
  p.ship.carrying = best.id;
  emit({ t: 'rockGrabbed', id: best.id, owner: intent.player });
  return true;
}

/** In-place removal of smashed rocks (keeps the array identity other modules may hold). */
function compact(w: World): void {
  let j = 0;
  for (const r of w.rocks) if (r.state !== 'smashed') w.rocks[j++] = r;
  w.rocks.length = j;
}

function drift(w: World, r: Rock, dt: number): boolean {
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.spin += dt * 0.8;
  const out = 3;
  if (r.x < -out || r.y < -out || r.x > w.grid.w + out || r.y > w.grid.h + out) {
    r.state = 'smashed'; // left the map: silently removed, no payout or event
    return false;
  }
  const m = ECON.landMargin;
  const inside = r.x > m && r.y > m && r.x < w.grid.w - m && r.y < w.grid.h - m;
  if (inside && !isTerrainBlocked(w.grid, Math.floor(r.x), Math.floor(r.y)) && rand(w) < ECON.landPerSecond * dt) {
    r.state = 'landed';
    r.vx = 0;
    r.vy = 0;
    r.spin += randRange(w, 0, 1);
  }
  return true;
}

/** Rocks over a smash-capable weapon tower (turret/laser/bomber) are smashed for the carrier or tower owner. */
function trySmashOverTower(w: World, r: Rock, emit: Emit): void {
  const s = structureAt(w, Math.floor(r.x), Math.floor(r.y));
  if (!s || !(WEAPONS as readonly string[]).includes(s.kind)) return;
  if (!DEFS.weapon(s.kind as WeaponKind).smashesRocks) return;
  const credit = r.carriedBy !== -1 ? r.carriedBy : (lastCarrier.get(r) ?? s.owner);
  smashRock(w, r.id, credit, emit);
}

export const rocksSystem: System = (w, dt, emit) => {
  compact(w);
  for (const r of w.rocks.slice()) {
    if (r.state === 'smashed') continue;
    if (r.state === 'grabbed') {
      const ship = r.carriedBy === -1 ? null : w.players[r.carriedBy].ship;
      if (!ship || ship.carrying !== r.id) {
        release(w, r);
        continue;
      }
      r.x = ship.x;
      r.y = ship.y;
      r.spin += dt * 2;
    } else if (r.state === 'drifting' && !drift(w, r, dt)) continue;
    if (r.state !== 'drifting') trySmashOverTower(w, r, emit);
  }
  compact(w);
};
