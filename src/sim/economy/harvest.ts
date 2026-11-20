import type { Emit, PlayerId, Rock, Structure, System, World } from '@/types';
import { HEALTH_TOKEN_CHANCE, SHIP_HP_PER_TOKEN } from '@/config/constants';
import { rand } from '@/sim/core';
import { addThorium } from './thorium';
import { mapThoriumFactor } from './meteors';
import { applyHealthToken, hasShip } from './shipHealth';
import { ECON } from './tuning';

/** Magnet radius (tiles) of a harvester at the given upgrade level. */
export function harvesterRange(level: number): number {
  const r = ECON.harvesterRange;
  return r[Math.max(0, Math.min(r.length - 1, Math.floor(level)))];
}

function findRock(w: World, id: number): Rock | undefined {
  for (const r of w.rocks) if (r.id === id) return r;
  return undefined;
}

/** Nearest free rock (drifting or landed, never one a ship is towing) inside the magnet. */
function nearestFreeRock(w: World, x: number, y: number, range: number): Rock | null {
  let best: Rock | null = null;
  let bestD = range * range;
  for (const r of w.rocks) {
    if (r.state !== 'drifting' && r.state !== 'landed') continue;
    const d = (r.x - x) ** 2 + (r.y - y) ** 2;
    if (d <= bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

function payout(w: World, raw: number): number {
  return Math.round(raw * w.settings.thoriumRate * mapThoriumFactor(w));
}

/** Drains one pulse from a rock sitting on the harvester; smashes it (with a burst event) once empty. */
function drain(w: World, s: Structure, r: Rock, emit: Emit): void {
  const pull = Math.min(r.thorium, ECON.harvestPerPulse);
  r.thorium -= pull;
  addThorium(w, s.owner, payout(w, pull), emit);
  if (r.thorium > 0) return;
  r.state = 'smashed';
  s.targetId = 0;
  const total = payout(w, ECON.rockThorium[r.size]);
  emit({ t: 'rockSmashed', id: r.id, x: r.x, y: r.y, thorium: total, owner: s.owner });
  dropTokens(w, s.owner, r, total, emit);
}

/** Pickup visuals for a full harvest (the thorium itself was already paid per pulse), plus a chance at a health token. */
function dropTokens(w: World, owner: PlayerId, r: Rock, money: number, emit: Emit): void {
  emit({ t: 'token', kind: 'money', owner, x: r.x, y: r.y, amount: money });
  if (!hasShip(w.players[owner])) return;
  if (rand(w) >= HEALTH_TOKEN_CHANCE[r.size]) return;
  applyHealthToken(w, owner);
  emit({ t: 'token', kind: 'health', owner, x: r.x, y: r.y, amount: SHIP_HP_PER_TOKEN });
}

/**
 * Harvesters are the only source of rock thorium. Each finished harvester's magnet (radius grows with
 * its level) locks the nearest free rock, pulls it onto the pad, then drains it pulse by pulse: a big
 * rock takes longer but pays more. Structure.targetId holds the locked rock; cooldown is the pulse timer.
 */
export const harvestSystem: System = (w, dt, emit) => {
  const locked = new Set<number>();
  for (const s of w.structures.values()) {
    if (s.kind !== 'harvester' || s.buildProgress < 1) continue;
    let r = s.targetId ? findRock(w, s.targetId) : undefined;
    if (!r || r.state !== 'harvesting') {
      s.targetId = 0;
      const cx = s.tx + 0.5;
      const cy = s.ty + 0.5;
      const found = nearestFreeRock(w, cx, cy, harvesterRange(s.level));
      if (!found) continue;
      r = found;
      r.state = 'harvesting';
      r.vx = 0;
      r.vy = 0;
      s.targetId = r.id;
      s.cooldown = ECON.harvestPulse;
    }
    locked.add(r.id);
    const dx = s.tx + 0.5 - r.x;
    const dy = s.ty + 0.5 - r.y;
    const dist = Math.hypot(dx, dy);
    const step = ECON.magnetSpeed * dt;
    r.spin += dt * 1.5;
    if (dist > step) {
      r.x += (dx / dist) * step;
      r.y += (dy / dist) * step;
      continue;
    }
    r.x = s.tx + 0.5;
    r.y = s.ty + 0.5;
    s.cooldown -= dt;
    if (s.cooldown > 0) continue;
    s.cooldown += ECON.harvestPulse;
    drain(w, s, r, emit);
  }
  // A harvester destroyed or recycled mid-harvest drops its rock where it is.
  for (const r of w.rocks) {
    if (r.state === 'harvesting' && !locked.has(r.id)) r.state = 'landed';
  }
};
