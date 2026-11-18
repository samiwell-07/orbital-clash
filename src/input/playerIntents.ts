import type { Intent, PlayerId, PlayerUi, StructureKind, UnitKind } from '../types';
import { AXIS, PAD, TUNING } from './bindings';
import { applyDeadzone, EdgeDetector, HoldRepeater, stickToIndex, type PadSnapshot } from './gamepad';
import { PlayerUiMachine, type AttackEvent } from './playerUi';

export interface PlayerHooks {
  getBuildItems: (p: PlayerId) => readonly StructureKind[];
  getAttackUnits: (p: PlayerId) => readonly UnitKind[];
  getCursor: (p: PlayerId) => { tx: number; ty: number };
  /** When given, upgrade/recycle/repair/cycleOutput are only emitted over an existing structure. */
  getStructureKindAt?: (tx: number, ty: number) => StructureKind | null | undefined;
  /** When given and false, X (no menu open) founds the base instead of idling. */
  hasBase?: (p: PlayerId) => boolean;
}

const DIR_BUTTONS = [
  { pad: PAD.UP, step: -1 },
  { pad: PAD.LEFT, step: -1 },
  { pad: PAD.DOWN, step: 1 },
  { pad: PAD.RIGHT, step: 1 },
] as const;

/** One local human: turns a per-frame PadSnapshot into intents and drives its menu state. */
export class PlayerController {
  private readonly machine = new PlayerUiMachine();
  private readonly edges = new EdgeDetector();
  private readonly xHold = new HoldRepeater(TUNING.cycleHoldSec, TUNING.cycleRepeatSec);
  private readonly dirRepeat = DIR_BUTTONS.map(() => new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true));
  private holdTile = '';
  private grabbing = false;

  constructor(
    readonly player: PlayerId,
    private readonly hooks: PlayerHooks,
  ) {}

  get ui(): PlayerUi {
    return this.machine.state;
  }

  /** Pushes intents for this frame into `out`. Returns true when Start was pressed. */
  update(snap: PadSnapshot, dt: number, paused: boolean, out: Intent[]): boolean {
    const e = this.edges.update(snap.buttons);
    const move = paused ? { x: 0, y: 0 } : applyDeadzone(snap.axes[AXIS.LX], snap.axes[AXIS.LY], TUNING.moveDeadzone);
    out.push({ t: 'move', player: this.player, ax: move.x, ay: move.y });
    if (paused) {
      this.xHold.reset();
      this.releaseGrab(false, out);
      return e.pressed[PAD.START];
    }

    const items = this.hooks.getBuildItems(this.player);
    const units = this.hooks.getAttackUnits(this.player);
    this.machine.clampBuild(items.length);

    if (e.pressed[PAD.R1]) this.emitAttack(this.machine.toggleBuild(), out);
    if (e.pressed[PAD.R3]) this.emitAttack(this.machine.toggleAttack(), out);
    if (e.pressed[PAD.L1]) out.push({ t: 'cycleTarget', player: this.player });

    const cur = this.hooks.getCursor(this.player);
    const kindAt = this.hooks.getStructureKindAt?.(cur.tx, cur.ty);
    const overStructure = this.hooks.getStructureKindAt ? !!kindAt : true;
    const menu = this.machine.menu;

    if (e.pressed[PAD.O]) {
      const back = this.machine.back();
      this.emitAttack(back.events, out);
      if (!back.closed && overStructure) out.push({ t: 'upgrade', player: this.player, tx: cur.tx, ty: cur.ty });
    }

    if (menu === 'build') {
      this.xHold.reset();
      DIR_BUTTONS.forEach((d, i) => {
        if (this.dirRepeat[i].update(snap.buttons[d.pad], dt) > 0) this.machine.moveBuild(d.step, items.length);
      });
      const kind = items[this.machine.state.buildIndex];
      if (e.pressed[PAD.X] && kind) out.push({ t: 'build', player: this.player, kind, tx: cur.tx, ty: cur.ty });
    } else {
      this.dirRepeat.forEach((r) => r.update(false, dt));
    }

    if (menu === 'attack') {
      const idx = stickToIndex(snap.axes[AXIS.RX], snap.axes[AXIS.RY], units.length, TUNING.attackTilt);
      this.emitAttack(this.machine.updateAttack(idx, units, dt), out);
    }

    if (menu === 'none') this.freeActions(e, snap, dt, cur, kindAt, overStructure, out);

    this.updateGrab(snap, out);
    return e.pressed[PAD.START];
  }

  /** Close menus when the game pauses/resumes; releasing a held attack pushes its intents. */
  setPause(on: boolean, out: Intent[]): void {
    this.emitAttack(this.machine.setPause(on), out);
  }

  private freeActions(
    e: { pressed: boolean[] },
    snap: PadSnapshot,
    dt: number,
    cur: { tx: number; ty: number },
    kindAt: StructureKind | null | undefined,
    overStructure: boolean,
    out: Intent[],
  ): void {
    const { tx, ty } = cur;
    const p = this.player;
    const baseMissing = this.hooks.hasBase ? !this.hooks.hasBase(p) : false;
    if (e.pressed[PAD.X] && baseMissing) out.push({ t: 'buildBase', player: p, tx, ty });
    if (e.pressed[PAD.SQUARE] && overStructure) out.push({ t: 'recycle', player: p, tx, ty });
    if (e.pressed[PAD.TRIANGLE] && overStructure) out.push({ t: 'repair', player: p, tx, ty });

    const tile = `${tx},${ty}`;
    if (tile !== this.holdTile) this.xHold.reset();
    this.holdTile = tile;
    const spawn = this.hooks.getStructureKindAt ? kindAt === 'basicOps' || kindAt === 'specialOps' : true;
    const fires = this.xHold.update(snap.buttons[PAD.X] && !baseMissing, dt);
    for (let i = 0; i < fires && spawn; i++) out.push({ t: 'cycleOutput', player: p, tx, ty });
  }

  /** Grab every frame while L2/R2 is held (the sim picks up a nearby rock); drop on release. */
  private updateGrab(snap: PadSnapshot, out: Intent[]): void {
    const held = snap.buttons[PAD.L2] || snap.buttons[PAD.R2];
    if (held) out.push({ t: 'grab', player: this.player });
    this.releaseGrab(held, out);
  }

  private releaseGrab(held: boolean, out: Intent[]): void {
    if (this.grabbing && !held) out.push({ t: 'drop', player: this.player });
    this.grabbing = held;
  }

  private emitAttack(events: readonly AttackEvent[], out: Intent[]): void {
    for (const ev of events) {
      if (ev.t === 'select') out.push({ t: 'attackSelect', player: this.player, kind: ev.kind });
      else out.push({ t: 'attackLock', player: this.player, locked: ev.locked });
    }
  }
}
