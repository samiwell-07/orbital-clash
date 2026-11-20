import type { BasicUnitKind, Intent, Structure, UnitKind } from '@/types';
import { BASIC_UNITS } from '@/types';
import { DEFS, UNIT_DEFS, isUnlocked } from '@/data';
import { structuresOf } from '@/sim/core/entities';
import { overtimeMult } from '@/sim/core/victory';
import type { BrainCtx } from './ctx';
import { ATTACK_WEIGHT, BASE_MIX } from './tuning';
import { enemyDefence, storedTotal, weakestEnemy, type Defence } from './threat';

/** Output shares of the Basic Ops towers, adapted to what the target has built. */
function mixFor(c: BrainCtx, d: Defence | null): [BasicUnitKind, number][] {
  const mix: Record<string, number> = { ...BASE_MIX };
  if (d && d.weapons > 0 && d.antiAir === 0) mix.drone += 0.3;
  if (d && d.antiAir >= 2) mix.drone *= 0.4;
  if (d && d.structures >= 8) mix.torpedo += 0.1;
  const out: [BasicUnitKind, number][] = [];
  for (const k of BASIC_UNITS) {
    if (isUnlocked(c.p.tech, UNIT_DEFS[k].requires) && (mix[k] ?? 0) > 0) out.push([k, mix[k]]);
  }
  const sum = out.reduce((a, [, v]) => a + v, 0) || 1;
  return out.map(([k, v]) => [k, v / sum]);
}

/**
 * Stable per-tower assignment: tower i of n takes the unit at cumulative share (i+0.5)/n, so the mix
 * only changes when the enemy changes, and towers that cannot make that unit yet fall back to their best.
 */
function wantedOutput(t: Structure, index: number, n: number, mix: readonly [BasicUnitKind, number][]): UnitKind {
  const pos = (index + 0.5) / n;
  let acc = 0;
  let pick: BasicUnitKind = 'scout';
  for (const [k, v] of mix) {
    acc += v;
    pick = k;
    if (pos <= acc) break;
  }
  const have = DEFS.basicOutputsFor(t.level);
  if (have.includes(pick)) return pick;
  return [...mix].map(([k]) => k).filter((k) => have.includes(k)).pop() ?? 'scout';
}

function planOutputs(c: BrainCtx, d: Defence | null): void {
  const mix = mixFor(c, d);
  const mine = structuresOf(c.w, c.me).sort((a, b) => a.id - b.id);
  const towers = mine.filter((s) => s.kind === 'basicOps');
  const specials = mine.filter((s) => s.kind === 'specialOps' && isUnlocked(c.p.tech, 'hammers'));
  const wants: [Structure, UnitKind][] = towers.map((t, i) => [t, wantedOutput(t, i, towers.length, mix)]);
  for (const s of specials) wants.push([s, 'hammer']);
  for (const [s, want] of wants) {
    if (s.output === want) continue;
    c.out.push({ t: 'cycleOutput', player: c.me, tx: s.tx, ty: s.ty });
    return;
  }
}

function pickKind(c: BrainCtx, d: Defence | null): UnitKind | null {
  let best: UnitKind | null = null;
  let bs = 0;
  for (const [k, n] of Object.entries(c.p.stored) as [UnitKind, number][]) {
    let wgt = ATTACK_WEIGHT[k] ?? 0;
    if (k === 'drone' && d) wgt *= d.weapons > 0 && d.antiAir === 0 ? 1.4 : d.antiAir >= 2 ? 0.6 : 1;
    if (k === 'torpedo' && d && d.structures >= 6) wgt *= 1.3;
    if (k === 'scout' && d && d.weapons === 0) wgt *= 1.2;
    if (n > 0 && n * wgt > bs) {
      bs = n * wgt;
      best = k;
    }
  }
  return best;
}

/** Stored-army attack cycle: build up, aim at the weakest enemy, release and lock, stop when drained. */
function planAttack(c: BrainCtx, d: Defence | null): void {
  const { w, p, mem, tun } = c;
  const target = weakestEnemy(w, c.me);
  const total = storedTotal(p);
  const limit = w.settings.timeLimitSec;
  const rushing = overtimeMult(w) > 1 || (limit > 0 && limit - w.timeSec < 60);
  const threshold = rushing ? Math.max(10, tun.attackThreshold * 0.25) : tun.attackThreshold;
  const out: Intent[] = c.out;

  if (target === null) {
    if (p.attack.locked) out.push({ t: 'attackLock', player: c.me, locked: false });
    mem.attacking = false;
    return;
  }
  if (!mem.attacking && total >= threshold && w.timeSec - mem.lastAttackEnd >= tun.attackCooldownSec) {
    mem.attacking = true;
    mem.cycleTries = 0;
  }
  if (!mem.attacking) return;

  if (p.attack.targetPlayer !== target && mem.cycleTries < 4) {
    out.push({ t: 'cycleTarget', player: c.me });
    mem.cycleTries++;
    return;
  }
  if (total <= Math.max(3, threshold * 0.1)) {
    if (p.attack.locked) out.push({ t: 'attackLock', player: c.me, locked: false });
    if (p.attack.selected !== null) out.push({ t: 'attackSelect', player: c.me, kind: null });
    mem.attacking = false;
    mem.lastAttackEnd = w.timeSec;
    return;
  }
  const kind = pickKind(c, d);
  if (kind && p.attack.selected !== kind) out.push({ t: 'attackSelect', player: c.me, kind });
  if (kind && !p.attack.locked) out.push({ t: 'attackLock', player: c.me, locked: true });
}

export function planArmy(c: BrainCtx): void {
  const target = weakestEnemy(c.w, c.me);
  const d = target === null ? null : enemyDefence(c.w, target);
  planOutputs(c, d);
  planAttack(c, d);
}
