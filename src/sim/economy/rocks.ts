import type { Emit, Intent, Rock, Ship, System, World } from '@/types';
import { ECON } from './tuning';

/** Heading (radians) of the ship towing each rock; the rock sits on that heading, in front of the nose. */
const towAngle = new WeakMap<Rock, number>();

/** Drops a towed rock: it keeps the ship's velocity forever (drifting, no drag), or lands if the ship was still. */
export function releaseRock(w: World, r: Rock): void {
  let vx = 0;
  let vy = 0;
  if (r.carriedBy !== -1) {
    const ship = w.players[r.carriedBy].ship;
    if (ship.carrying === r.id) ship.carrying = 0;
    vx = ship.vx;
    vy = ship.vy;
  }
  const moving = Math.hypot(vx, vy) >= ECON.throwRestSpeed;
  r.state = moving ? 'drifting' : 'landed';
  r.carriedBy = -1;
  r.vx = moving ? vx : 0;
  r.vy = moving ? vy : 0;
  towAngle.delete(r);
}

function shipHeading(ship: Ship, fallback: number): number {
  return Math.hypot(ship.vx, ship.vy) > ECON.towHeadingMinSpeed ? Math.atan2(ship.vy, ship.vx) : fallback;
}

/** Turns `cur` toward `target` by at most `maxStep`, the short way round. */
function approachAngle(cur: number, target: number, maxStep: number): number {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
}

function placeInFront(r: Rock, ship: Ship, angle: number): void {
  const dist = ECON.towDistance[r.size];
  r.x = ship.x + Math.cos(angle) * dist;
  r.y = ship.y + Math.sin(angle) * dist;
}

export function handleRockIntent(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'grab' && intent.t !== 'drop') return false;
  const p = w.players[intent.player];
  if (!p || !p.alive || p.ship.dead) return true;
  if (intent.t === 'drop') {
    const held = w.rocks.find((r) => r.id === p.ship.carrying);
    if (held) releaseRock(w, held);
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
  towAngle.set(best, shipHeading(p.ship, Math.atan2(best.y - p.ship.y, best.x - p.ship.x)));
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

/** Drifting rocks keep a constant velocity over terrain and structures until caught, grabbed or off the map. */
function drift(w: World, r: Rock, dt: number): void {
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.spin += dt * 0.8;
  const out = 3;
  if (r.x < -out || r.y < -out || r.x > w.grid.w + out || r.y > w.grid.h + out) {
    r.state = 'smashed'; // left the map: silently removed, no payout or event
  }
}

/** Drifting rocks fly straight on; towed rocks ride in front of their ship. Harvesting rocks belong to harvest.ts. */
export const rocksSystem: System = (w, dt) => {
  compact(w);
  for (const r of w.rocks) {
    if (r.state === 'grabbed') {
      const ship = r.carriedBy === -1 ? null : w.players[r.carriedBy].ship;
      if (!ship || ship.carrying !== r.id) {
        releaseRock(w, r);
        continue;
      }
      const cur = towAngle.get(r) ?? shipHeading(ship, 0);
      const angle = approachAngle(cur, shipHeading(ship, cur), ECON.towTurnRate * dt);
      towAngle.set(r, angle);
      placeInFront(r, ship, angle);
      r.spin += dt * 2;
    } else if (r.state === 'drifting') drift(w, r, dt);
  }
  compact(w);
};
