import type { PlayerId, PrePlacedStructure, StructureKind, TimelineEvent, UnitKind } from '@/types';
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
  return { build: SUPPORT_DEFS[kind as keyof typeof SUPPORT_DEFS].buildCost, up: [] };
}

function defaultOutput(kind: StructureKind, output?: UnitKind): UnitKind | null {
  return output ?? (kind === 'basicOps' ? 'scout' : kind === 'specialOps' ? 'hammer' : null);
}

type Op = (t: number) => void;

/**
 * Authoring helper for one enemy's script. Operations may be declared in any order; `finish()` replays
 * them chronologically. Every build/upgrade is preceded by an exact thorium grant (the mission funds the
 * enemy explicitly) and the stored army that releases need is seeded, so a release never asks for units
 * that production cannot have delivered.
 */
export class Script {
  readonly pre: (PrePlacedStructure & { owner: PlayerId })[] = [];
  private readonly out: TimelineEvent[] = [];
  private readonly ops: { t: number; seq: number; run: Op }[] = [];
  private readonly towers = new Map<string, Tower>();
  private readonly avail: Partial<Record<UnitKind, number>> = {};
  private readonly seed: UnitStock = {};
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
    for (const tw of this.towers.values()) {
      if (!tw.output || (tw.kind !== 'basicOps' && tw.kind !== 'specialOps')) continue;
      const mult = SPAWN_TOWER_DEFS[tw.kind].spawnMult;
      const rate = mult[Math.min(mult.length - 1, tw.level)] / UNIT_DEFS[tw.output].spawnSeconds;
      this.avail[tw.output] = (this.avail[tw.output] ?? 0) + CREDIT * dt * rate;
    }
  }

  private tower(tx: number, ty: number): Tower {
    const tw = this.towers.get(`${tx},${ty}`);
    if (!tw) throw new Error(`script: no structure declared at ${tx},${ty}`);
    return tw;
  }

  preplace(kind: StructureKind, tx: number, ty: number, level = 0, output?: UnitKind): void {
    this.pre.push({ kind, tx, ty, level, output, owner: this.enemy });
    this.towers.set(`${tx},${ty}`, { kind, level, output: defaultOutput(kind, output) });
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
      this.push(t, { a: 'release', kind, count });
    });
  }

  releaseAll(t: number): void {
    this.later(t, () => {
      this.accrue(t);
      for (const k of Object.keys(this.avail) as UnitKind[]) this.avail[k] = 0;
      this.push(t, { a: 'release', kind: 'all', count: 'all' });
    });
  }

  /** Replays the declared operations in time order; safe to call repeatedly. */
  finish(): void {
    if (this.done) return;
    this.done = true;
    for (const op of [...this.ops].sort((a, b) => a.t - b.t || a.seq - b.seq)) op.run(op.t);
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
