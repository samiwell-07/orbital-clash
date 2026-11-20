import type { Intent, PlayerId, Rock, Structure, World } from '@/types';
import { structuresOf } from '@/sim/core/entities';
import { harvesterRange } from '@/sim/economy/harvest';
import type { AiMemory } from './ctx';
import { SHIP_STEER } from './tuning';

interface Goal {
  x: number;
  y: number;
}

const centre = (s: Structure): Goal => ({ x: s.tx + 0.5, y: s.ty + 0.5 });

function harvesters(w: World, me: PlayerId): Structure[] {
  return structuresOf(w, me).filter((s) => s.kind === 'harvester' && s.buildProgress >= 1);
}

const isFree = (r: Rock): boolean => (r.state === 'drifting' || r.state === 'landed') && r.thorium > 0;

/** A free rock already inside one of my magnets will be pulled in without help. */
function inMagnet(list: readonly Structure[], r: Rock): boolean {
  return list.some((s) => Math.hypot(s.tx + 0.5 - r.x, s.ty + 0.5 - r.y) <= harvesterRange(s.level));
}

function nearestTo(list: readonly Structure[], x: number, y: number): Structure | null {
  let best: Structure | null = null;
  let bd = Infinity;
  for (const s of list) {
    const d = Math.hypot(s.tx + 0.5 - x, s.ty + 0.5 - y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Cheapest rock to bring home: close to the ship and close to one of my harvesters. */
function pickRock(w: World, mem: AiMemory, towers: readonly Structure[], sx: number, sy: number): Rock | null {
  const kept = w.rocks.find((r) => r.id === mem.rockId && isFree(r) && !inMagnet(towers, r));
  if (kept) return kept;
  let best: Rock | null = null;
  let bs = Infinity;
  for (const r of w.rocks) {
    if (!isFree(r) || inMagnet(towers, r)) continue;
    const t = nearestTo(towers, r.x, r.y);
    const score = Math.hypot(r.x - sx, r.y - sy) + 0.6 * (t ? Math.hypot(t.tx + 0.5 - r.x, t.ty + 0.5 - r.y) : 0);
    if (score < bs) {
      bs = score;
      best = r;
    }
  }
  mem.rockId = best ? best.id : 0;
  return best;
}

/** PD controller: stick deflection from position error and current velocity (ship has accel, drag and a speed cap). */
function steer(w: World, me: PlayerId, goal: Goal): Intent {
  const s = w.players[me].ship;
  const vx = Math.max(-SHIP_STEER.maxSpeed, Math.min(SHIP_STEER.maxSpeed, (goal.x - s.x) * SHIP_STEER.posGain));
  const vy = Math.max(-SHIP_STEER.maxSpeed, Math.min(SHIP_STEER.maxSpeed, (goal.y - s.y) * SHIP_STEER.posGain));
  let ax = (vx - s.vx) * SHIP_STEER.velGain;
  let ay = (vy - s.vy) * SHIP_STEER.velGain;
  const len = Math.hypot(ax, ay);
  if (len > 1) {
    ax /= len;
    ay /= len;
  }
  return { t: 'move', player: me, ax, ay };
}

/**
 * Economy: fly the ship to the best free rock, grab it, tow it into one of its own harvesters'
 * magnets and drop it there (magnets ignore towed rocks). Runs every tick (steering needs fine control).
 */
export function shipIntents(w: World, me: PlayerId, mem: AiMemory, dt: number): Intent[] {
  const p = w.players[me];
  if (!p.baseBuilt) return [];
  mem.grabCooldown = Math.max(0, mem.grabCooldown - dt);
  const ship = p.ship;
  const towers = harvesters(w, me);
  const home: Goal = { x: p.baseTx + 0.5, y: p.baseTy + 0.5 };
  const out: Intent[] = [];
  let goal: Goal = home;

  if (ship.carrying !== 0) {
    // Dropped rocks keep the ship's velocity forever, so only release into a magnet that is free to catch it.
    const idle = towers.filter((t) => t.targetId === 0);
    const s = nearestTo(idle.length > 0 ? idle : towers, ship.x, ship.y);
    if (s) {
      goal = centre(s);
      const held = w.rocks.find((r) => r.id === ship.carrying);
      const near = held ? Math.hypot(goal.x - held.x, goal.y - held.y) : Math.hypot(goal.x - ship.x, goal.y - ship.y);
      if (mem.grabCooldown === 0 && s.targetId === 0 && near <= harvesterRange(s.level) * 0.6) {
        out.push({ t: 'drop', player: me });
        mem.grabCooldown = SHIP_STEER.repeatSec;
        mem.rockId = 0;
      }
    }
  } else if (towers.length > 0) {
    const rock = pickRock(w, mem, towers, ship.x, ship.y);
    if (rock) {
      goal = { x: rock.x + rock.vx * 0.3, y: rock.y + rock.vy * 0.3 };
      if (mem.grabCooldown === 0 && Math.hypot(rock.x - ship.x, rock.y - ship.y) <= SHIP_STEER.grabRadius) {
        out.push({ t: 'grab', player: me });
        mem.grabCooldown = SHIP_STEER.repeatSec;
      }
    }
  }
  out.push(steer(w, me, goal));
  return out;
}
