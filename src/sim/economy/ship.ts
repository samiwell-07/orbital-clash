import type { Intent, PlayerId, System, World } from '@/types';
import { SHIP_ACCEL, SHIP_DRAG, SHIP_MAX_SPEED } from '@/config/constants';
import { ECON } from './tuning';

const inputs = new WeakMap<World, Map<PlayerId, { ax: number; ay: number }>>();

function inputOf(w: World, player: PlayerId): { ax: number; ay: number } {
  let m = inputs.get(w);
  if (!m) {
    m = new Map();
    inputs.set(w, m);
  }
  let v = m.get(player);
  if (!v) {
    v = { ax: 0, ay: 0 };
    m.set(player, v);
  }
  return v;
}

/** Latches the analog stick; it stays applied each tick until the next 'move' intent replaces it. */
export function handleShipIntent(w: World, intent: Intent): boolean {
  if (intent.t !== 'move') return false;
  const mag = Math.hypot(intent.ax, intent.ay);
  const ok = Number.isFinite(mag);
  const k = mag > 1 ? 1 / mag : 1;
  const v = inputOf(w, intent.player);
  v.ax = ok ? intent.ax * k : 0;
  v.ay = ok ? intent.ay * k : 0;
  return true;
}

function clampAxis(pos: number, vel: number, max: number): [number, number] {
  const lo = ECON.shipMargin;
  const hi = max - ECON.shipMargin;
  if (pos < lo) return [lo, Math.max(0, vel)];
  if (pos > hi) return [hi, Math.min(0, vel)];
  return [pos, vel];
}

/** Accel + drag + speed cap, clamped to the map. Ships ignore structures. Heavier rocks slow acceleration. */
export const shipSystem: System = (w, dt) => {
  for (const p of w.players) {
    if (!p.alive) continue;
    const s = p.ship;
    const input = inputOf(w, p.id);
    const rock = s.carrying ? w.rocks.find((r) => r.id === s.carrying) : undefined;
    const accel = SHIP_ACCEL / (1 + (rock ? rock.size * ECON.carrySlowPerSize : 0));
    s.vx += input.ax * accel * dt;
    s.vy += input.ay * accel * dt;
    const drag = Math.max(0, 1 - SHIP_DRAG * dt);
    s.vx *= drag;
    s.vy *= drag;
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > SHIP_MAX_SPEED) {
      s.vx *= SHIP_MAX_SPEED / speed;
      s.vy *= SHIP_MAX_SPEED / speed;
    }
    [s.x, s.vx] = clampAxis(s.x + s.vx * dt, s.vx, w.grid.w);
    [s.y, s.vy] = clampAxis(s.y + s.vy * dt, s.vy, w.grid.h);
    s.cursorTx = Math.floor(s.x);
    s.cursorTy = Math.floor(s.y);
  }
};
