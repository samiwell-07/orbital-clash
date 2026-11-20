import type { Emit, PlayerId, System, World } from '@/types';
import { STAGE_ORDER, registerSystem } from '@/sim/core/pipeline';
import { isOvertime, overtimeMult } from '@/sim/core/victory';
import { allTech } from '@/data/research';
import { BATTLE_CONFIG, scaleHits, scaleThorium } from './config';

const initialised = new WeakSet<World>();
const awarded = new WeakMap<World, Set<PlayerId>>();

type BonusFn = (w: World, player: PlayerId, amount: number, emit: Emit) => number;

/** The economy module's awardBaseKillBonus, resolved at load time when that file exists. */
const lateEconomy = import.meta.glob<Record<string, unknown>>('../../economy/thorium.ts', { eager: true });

function economyBonus(): BonusFn | null {
  for (const mod of Object.values(lateEconomy)) {
    const fn = mod.awardBaseKillBonus;
    if (typeof fn === 'function') return fn as BonusFn;
  }
  return null;
}

/** Remaining seconds of a timed battle (null when untimed) and whether spawning is running at 8x. */
export function battleClock(w: World): { timeLeftSec: number | null; overtime: boolean; spawnMult: number } {
  const limit = w.settings.timeLimitSec;
  return {
    timeLeftSec: limit > 0 ? Math.max(0, limit - w.timeSec) : null,
    overtime: isOvertime(w),
    spawnMult: overtimeMult(w),
  };
}

/** Awards the Thorium bonus for destroying an enemy base (patch 1.01) directly to the attacker. */
export function awardBonusDirect(w: World, attacker: PlayerId, emit: Emit): void {
  const amount = BATTLE_CONFIG.baseKillBonus;
  const p = w.players[attacker];
  p.thorium += amount;
  p.stats.thoriumEarned += amount;
  emit({ t: 'thorium', owner: attacker, amount });
}

function awardBonus(w: World, attacker: PlayerId, emit: Emit): void {
  const fn = economyBonus();
  if (fn && fn(w, attacker, BATTLE_CONFIG.baseKillBonus, emit) > 0) return;
  awardBonusDirect(w, attacker, emit);
}

/**
 * Runs once at tick 0 of a battle: applies Strength (Max Hits and start Thorium scale with it) and
 * unlocks all base-game research, since Battle has no campaign progression. Bionic research stays
 * locked so the Bionic Research Lab has something to sell (Original has no lab and no Bionic items).
 */
export const battleInitSystem: System = (w) => {
  if (w.settings.mode !== 'battle' || initialised.has(w)) return;
  initialised.add(w);
  if (w.tick !== 0) return;
  for (const p of w.players) {
    if (p.controller === 'none') continue;
    const s = w.settings.strength[p.id];
    p.maxHits = scaleHits(w.settings.maxHits, s);
    p.thorium = scaleThorium(BATTLE_CONFIG.fullStartThorium, s);
    p.tech = { ...allTech(), ...p.tech };
  }
};

/** Pays the base-kill bonus once per destroyed base. Runs right after the victory system. */
export const battleBonusSystem: System = (w, _dt, emit) => {
  if (w.settings.mode !== 'battle') return;
  let done = awarded.get(w);
  for (const e of w.events) {
    if (e.t !== 'baseDestroyed' || e.attacker === -1) continue;
    if (!done) {
      done = new Set();
      awarded.set(w, done);
    }
    if (done.has(e.target)) continue;
    done.add(e.target);
    if (w.players[e.attacker].team !== w.players[e.target].team) awardBonus(w, e.attacker, emit);
  }
};

registerSystem('battle.init', STAGE_ORDER.timeline, battleInitSystem);
registerSystem('battle.bonus', STAGE_ORDER.victory + 1, battleBonusSystem);
