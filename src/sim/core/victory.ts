import type { Emit, PlayerId, System, World } from '@/types';
import { OVERTIME_SPAWN_MULT } from '@/config/constants';

const lastAttacker = new WeakMap<object, PlayerId>();
const timeUpFired = new WeakSet<World>();

/**
 * Registers one base hit (call from unit arrival logic). Emits baseHit; elimination is
 * resolved by the victory system. Returns hits remaining.
 */
export function hitBase(w: World, target: PlayerId, attacker: PlayerId, emit: Emit, hits = 1): number {
  const p = w.players[target];
  p.hits += hits;
  lastAttacker.set(p, attacker);
  const hitsLeft = Math.max(0, p.maxHits - p.hits);
  emit({ t: 'baseHit', target, attacker, hitsLeft });
  return hitsLeft;
}

export function overtimeMult(w: World): number {
  const limit = w.settings.timeLimitSec;
  return limit > 0 && w.timeSec >= limit ? OVERTIME_SPAWN_MULT : 1;
}

export function isOvertime(w: World): boolean {
  return overtimeMult(w) > 1;
}

function checkBases(w: World, emit: Emit): void {
  for (const p of w.players) {
    if (!p.alive || !p.baseBuilt || p.hits < p.maxHits) continue;
    p.alive = false;
    const attacker = lastAttacker.get(p) ?? -1;
    if (attacker !== -1) w.players[attacker].stats.basesDestroyed++;
    emit({ t: 'baseDestroyed', target: p.id, attacker });
  }
}

function checkElimination(w: World, emit: Emit): void {
  const participating = new Set<number>();
  const alive = new Set<number>();
  for (const p of w.players) {
    if (p.controller === 'none') continue;
    participating.add(p.team);
    if (p.alive) alive.add(p.team);
  }
  if (participating.size < 2 || alive.size > 1) return;
  w.over = true;
  const winner = alive.size === 1 ? [...alive][0] : -1;
  w.winnerTeam = winner;
  if (winner !== -1) emit({ t: 'victory', team: winner });
  for (const team of participating) if (team !== winner) emit({ t: 'defeat', team });
}

function checkTime(w: World, emit: Emit): void {
  if (w.settings.timeLimitSec > 0 && w.timeSec >= w.settings.timeLimitSec && !timeUpFired.has(w)) {
    timeUpFired.add(w);
    emit({ t: 'timeUp' });
  }
}

export const victorySystem: System = (w, _dt, emit) => {
  if (w.over) return;
  checkBases(w, emit);
  checkElimination(w, emit);
  checkTime(w, emit);
};
