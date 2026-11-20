import type {
  PlayerId, PrePlacedStructure, ScriptAction, StructureGroup, StructureKind, TimelineEvent, UnitKind, WeaponKind,
} from '@/types';
import { WEAPONS } from '@/types';
import { STORAGE_CAP } from '@/config/constants';
import { SPAWN_TOWER_DEFS } from '../spawnTowers';
import { SUPPORT_DEFS } from '../support';
import { UNIT_DEFS } from '../units';
import { WEAPON_DEFS } from '../weapons';
import type { UnitStock } from './seeds';

/** Share of nominal production the seeded stock counts on (the dry-run compile credits slightly more). */
const CREDIT = 0.4;
/** Worst-case enemy strength multiplier (Expert) and safety margin for the seeded stock. */
const WORST_MULT = 1.4;
const BUFFER = 6;
/** Production is credited only while the estimated stored total stays this far below STORAGE_CAP. */
const CAP_MARGIN = 200;

interface Tower {
  kind: StructureKind;
  level: number;
  output: UnitKind | null;
}

function costs(kind: StructureKind): { build: number; up: readonly number[] } {
  if (kind === 'basicOps' || kind === 'specialOps') {
    return { build: SPAWN_TOWER_DEFS[kind].buildCost, up: SPAWN_TOWER_DEFS[kind].upgradeCost };
  }
  if (kind in WEAPON_DEFS) {
    const d = WEAPON_DEFS[kind as keyof typeof WEAPON_DEFS];
    return { build: d.buildCost, up: d.upgradeCost };
  }
  const d = SUPPORT_DEFS[kind as keyof typeof SUPPORT_DEFS];
  return { build: d.buildCost, up: d.upgradeCost ?? [] };
}

function defaultOutput(kind: StructureKind, output?: UnitKind): UnitKind | null {
  return output ?? (kind === 'basicOps' ? 'scout' : kind === 'specialOps' ? 'hammer' : null);
}

type Op = (t: number) => void;

/**
 * Authoring helper for one enemy's script. Operations may be declared in any order; `finish()` replays
 * them chronologically. Every build/upgrade is preceded by an exact thorium grant (the mission funds the
 * enemy explicitly; burst upgrades fund themselves at runtime) and the stored army that releases need is
 * seeded, so a release never asks for units that production cannot have delivered.
 */
export class Script {
  readonly pre: (PrePlacedStructure & { owner: PlayerId })[] = [];
  private readonly ops: { t: number; seq: number; run: Op }[] = [];
  /** Towers standing at t=0 (preplaced); every replay pass starts from a copy. */
  private readonly initial = new Map<string, Tower>();
  private out: TimelineEvent[] = [];
  private towers = new Map<string, Tower>();
  private avail: Partial<Record<UnitKind, number>> = {};
  private seed: UnitStock = {};
  /** Seed total assumed by this pass, plus the nominal production minus releases so far: the base's stored total. */
  private seedGuess = 0;
  private net = 0;
  private last = 0;
  private done = false;
  constructor(readonly enemy: PlayerId = 1) {}

  private later(t: number, run: Op): void {
    this.ops.push({ t, seq: this.ops.length, run });
  }

  private push(atSec: number, action: TimelineEvent['action']): void {
    this.out.push({ atSec, player: this.enemy, action });
  }

  private accrue(t: number): void {
    const dt = t - this.last;
    if (dt <= 0) return;
    this.last = t;
    // A full base pauses production (STORAGE_CAP); credit nothing while the estimate is near the cap.
    if (this.seedGuess === Infinity || this.seedGuess + this.net >= STORAGE_CAP - CAP_MARGIN) return;
    for (const tw of this.towers.values()) {
      if (!tw.output || (tw.kind !== 'basicOps' && tw.kind !== 'specialOps')) continue;
      const mult = SPAWN_TOWER_DEFS[tw.kind].spawnMult;
      const rate = mult[Math.min(mult.length - 1, tw.level)] / UNIT_DEFS[tw.output].spawnSeconds;
      this.avail[tw.output] = (this.avail[tw.output] ?? 0) + CREDIT * dt * rate;
      this.net += dt * rate;
    }
  }

  private tower(tx: number, ty: number): Tower {
    const tw = this.towers.get(`${tx},${ty}`);
    if (!tw) throw new Error(`script: no structure declared at ${tx},${ty}`);
    return tw;
  }

  preplace(kind: StructureKind, tx: number, ty: number, level = 0, output?: UnitKind): void {
    this.pre.push({ kind, tx, ty, level, output, owner: this.enemy });
    this.initial.set(`${tx},${ty}`, { kind, level, output: defaultOutput(kind, output) });
  }

  unlock(t: number, key: string): void {
    this.later(t, () => this.push(t, { a: 'unlock', key }));
  }

  message(t: number, text: string): void {
    this.later(t, () => this.push(t, { a: 'message', text }));
  }

  objective(t: number, id: string, text: string): void {
    this.later(t, () => this.push(t, { a: 'objective', id, text }));
  }

  build(t: number, kind: StructureKind, tx: number, ty: number, level = 0, output?: UnitKind): void {
    this.later(t, () => {
      this.accrue(t);
      const c = costs(kind);
      this.push(t, { a: 'grantThorium', amount: c.build + c.up.slice(0, level).reduce((a, b) => a + b, 0) });
      this.push(t, { a: 'build', kind, tx, ty, level, output });
      this.towers.set(`${tx},${ty}`, { kind, level, output: defaultOutput(kind, output) });
    });
  }

  upgrade(t: number, tx: number, ty: number): void {
    this.later(t, () => {
      this.accrue(t);
      const tw = this.tower(tx, ty);
      this.push(t, { a: 'grantThorium', amount: costs(tw.kind).up[tw.level] });
      this.push(t, { a: 'upgrade', tx, ty });
      tw.level++;
    });
  }

  setOutput(t: number, tx: number, ty: number, output: UnitKind): void {
    this.later(t, () => {
      this.accrue(t);
      this.tower(tx, ty).output = output;
      this.push(t, { a: 'setOutput', tx, ty, output });
    });
  }

  /**
   * Burst upgrade of every enemy structure in `kind` (self-funded at runtime, since the count is only known
   * then). Production credit ignores the extra levels: the humans may have destroyed those towers.
   */
  upgradeAll(t: number, kind: StructureGroup, opts: { max?: number; cap?: number; text?: string } = {}): void {
    this.later(t, () => {
      this.accrue(t);
      const a: Extract<ScriptAction, { a: 'upgradeAll' }> = { a: 'upgradeAll', kind };
      if (opts.max !== undefined) a.max = opts.max;
      if (opts.cap !== undefined) a.cap = opts.cap;
      if (opts.text) a.text = opts.text;
      this.push(t, a);
    });
  }

  /** Burst: rebuilds every original enemy structure whose tile is free and safe again (free of charge). */
  rebuildAll(t: number, text?: string): void {
    this.later(t, () => this.push(t, text ? { a: 'rebuildAll', text } : { a: 'rebuildAll' }));
  }

  /** Burst: switches every tower of `kind` that offers `output` at its level. */
  setOutputAll(t: number, kind: 'basicOps' | 'specialOps', output: UnitKind, text?: string): void {
    this.later(t, () => {
      this.accrue(t);
      for (const tw of this.towers.values()) {
        const lv = SPAWN_TOWER_DEFS[kind].outputsByLevel;
        if (tw.kind === kind && lv[Math.min(lv.length - 1, tw.level)].includes(output)) tw.output = output;
      }
      this.push(t, text ? { a: 'setOutputAll', kind, output, text } : { a: 'setOutputAll', kind, output });
    });
  }

  /** Release `count` stored units (Normal strength); the seed absorbs what production cannot cover. */
  release(t: number, kind: UnitKind, count: number): void {
    this.later(t, () => {
      this.accrue(t);
      const need = Math.ceil(count * WORST_MULT) + 2;
      const have = Math.floor(this.avail[kind] ?? 0) - BUFFER;
      if (have < need) {
        this.seed[kind] = (this.seed[kind] ?? 0) + need - have;
        this.avail[kind] = (this.avail[kind] ?? 0) + need - have;
      }
      this.avail[kind] = (this.avail[kind] ?? 0) - need;
      this.net = Math.max(-this.seedGuess, this.net - Math.round(count * WORST_MULT));
      this.push(t, { a: 'release', kind, count });
    });
  }

  releaseAll(t: number): void {
    this.later(t, () => {
      this.accrue(t);
      for (const k of Object.keys(this.avail) as UnitKind[]) this.avail[k] = 0;
      this.net = -this.seedGuess;
      this.push(t, { a: 'release', kind: 'all', count: 'all' });
    });
  }

  /**
   * Replays the declared operations in time order; safe to call repeatedly. The seed sits in the base from
   * t=0 and can fill it (pausing production), so passes repeat with the previous seed total until it holds.
   */
  finish(): void {
    if (this.done) return;
    this.done = true;
    const order = [...this.ops].sort((a, b) => a.t - b.t || a.seq - b.seq);
    for (let pass = 0; pass < 9; pass++) {
      // Last resort: credit no production at all, so every release is fully seeded.
      if (pass === 8) this.seedGuess = Infinity;
      this.out = [];
      this.towers = new Map([...this.initial].map(([k, tw]) => [k, { ...tw }]));
      this.avail = {};
      this.seed = {};
      this.net = 0;
      this.last = 0;
      for (const op of order) op.run(op.t);
      const total = Object.values(this.seed).reduce((a, n) => a + (n ?? 0), 0);
      if (total <= this.seedGuess) return;
      this.seedGuess = total;
    }
  }

  get events(): readonly TimelineEvent[] {
    this.finish();
    return this.out;
  }

  stock(): UnitStock {
    this.finish();
    return { ...this.seed };
  }
}

/** Earliest enemy burst (the reference bot sits fully geared and quiet for the first half minute). */
export const FIRST_BURST_MIN = 40;

/**
 * Burst times: the first ~15% into the par (40-60 s), then every 60-90 s; gaps start longer for calm
 * areas (low aggression) and shrink by 4 s per burst, never below 60 s. Bursts stop at `end`.
 */
export function burstTimes(par: number, ai: number, end: number): number[] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
  const out: number[] = [];
  let t = clamp(par * 0.15, FIRST_BURST_MIN, 60);
  for (let k = 0; t <= end; k++) {
    out.push(t);
    t += clamp(90 - 2.5 * ai - 4 * k, 60, 90);
  }
  return out;
}

const PLURAL: Record<WeaponKind, string> = { turret: 'Turrets', laser: 'Lasers', pulsar: 'Pulsars', bomber: 'Bombers' };

function groupText(group: StructureGroup): string {
  if (group === 'weapons') return 'The aliens upgrade their defences!';
  if (group === 'towers') return 'The aliens upgrade their spawn towers!';
  return `The aliens upgrade their ${PLURAL[group as WeaponKind] ?? group}!`;
}

function inGroup(kind: StructureKind, group: StructureGroup): boolean {
  if (group === 'weapons') return (WEAPONS as readonly string[]).includes(kind);
  if (group === 'towers') return kind === 'basicOps' || kind === 'specialOps';
  return kind === group;
}

export interface BurstPlan {
  par: number;
  /** Aggression 1..10: shorter gaps and wider "all defences" bursts. */
  ai: number;
  /** No burst after this second (the finale belongs to the waves). */
  end: number;
  /** Bursts never raise a structure past this level. */
  cap: number;
}

/**
 * Authors the enemy's action bursts over its preplaced structures: (1) every structure of its main weapon
 * kind, (2) every spawn tower, (3) rebuild losses + its second weapon kind, then rebuild + the lowest
 * `2 + ceil(ai/2)` defences. A burst whose target is (predicted) maxed falls back to defences, then towers,
 * then a plain rebuild. The prediction assumes nothing was destroyed; at runtime every burst is tolerant.
 */
export function scheduleBursts(s: Script, plan: BurstPlan): number[] {
  const mine = s.pre.filter((p) => p.owner === s.enemy).map((p) => ({ kind: p.kind, level: p.level }));
  const maxLevel = (k: StructureKind) => Math.min(plan.cap, costs(k).up.length);
  const count = (k: WeaponKind) => mine.filter((m) => m.kind === k).length;
  const first = (k: WeaponKind) => mine.findIndex((m) => m.kind === k);
  const order = WEAPONS.filter((k) => count(k) > 0).sort((a, b) => count(b) - count(a) || first(a) - first(b));
  const wide = 2 + Math.ceil(plan.ai / 2);
  const eligible = (group: StructureGroup, max?: number) =>
    mine.map((m, i) => ({ m, i })).filter(({ m }) => inGroup(m.kind, group) && m.level < maxLevel(m.kind))
      .sort((a, b) => a.m.level - b.m.level || a.i - b.i).slice(0, max ?? Infinity);
  const times = burstTimes(plan.par, plan.ai, plan.end);
  times.forEach((t, k) => {
    if (k >= 2) s.rebuildAll(t, 'The aliens rebuild their lost structures!');
    const wanted: [StructureGroup, number | undefined][] =
      k === 0 && order[0] ? [[order[0], undefined]]
        : k === 1 ? [['towers', undefined]]
          : k === 2 && order[1] ? [[order[1], undefined]] : [];
    wanted.push(['weapons', wide], ['towers', undefined]);
    for (const [group, max] of wanted) {
      const picked = eligible(group, max);
      if (picked.length === 0) continue;
      for (const { m } of picked) m.level++;
      s.upgradeAll(t, group, { max, cap: plan.cap, text: groupText(group) });
      return;
    }
  });
  return times;
}
