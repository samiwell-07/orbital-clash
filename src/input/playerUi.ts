import type { MenuId, PlayerUi, UnitKind } from '../types';
import { TUNING } from './bindings';

export type AttackEvent = { t: 'select'; kind: UnitKind | null } | { t: 'lock'; locked: boolean };

/** Per-player menu state machine (none/build/attack/pause) plus the attack hold-to-lock timer. */
export class PlayerUiMachine {
  readonly state: PlayerUi = { menu: 'none', buildIndex: 0, attackIndex: -1 };
  private heldIdx = -1;
  private holdTime = 0;
  private locked = false;

  get menu(): MenuId {
    return this.state.menu;
  }

  toggleBuild(): AttackEvent[] {
    return this.switchTo(this.state.menu === 'build' ? 'none' : 'build');
  }

  toggleAttack(): AttackEvent[] {
    return this.switchTo(this.state.menu === 'attack' ? 'none' : 'attack');
  }

  /** Back button: closes the build or attack menu. Returns whether a menu was open. */
  back(): { closed: boolean; events: AttackEvent[] } {
    if (this.state.menu === 'none' || this.state.menu === 'pause') return { closed: false, events: [] };
    return { closed: true, events: this.switchTo('none') };
  }

  setPause(on: boolean): AttackEvent[] {
    return this.switchTo(on ? 'pause' : 'none');
  }

  moveBuild(step: number, count: number): void {
    if (count <= 0) {
      this.state.buildIndex = 0;
      return;
    }
    this.state.buildIndex = (((this.state.buildIndex + step) % count) + count) % count;
  }

  clampBuild(count: number): void {
    this.state.buildIndex = Math.max(0, Math.min(Math.max(0, count - 1), this.state.buildIndex));
  }

  /**
   * Attack menu tick. `stickIdx` is the unit sector under the right stick (-1 neutral).
   * Tilting selects (and the sim releases units while held); releasing deselects unless locked;
   * holding the same direction for attackLockSec locks; tilting again unlocks.
   */
  updateAttack(stickIdx: number, kinds: readonly UnitKind[], dt: number): AttackEvent[] {
    if (this.state.menu !== 'attack') return [];
    const ev: AttackEvent[] = [];
    const idx = stickIdx >= 0 && stickIdx < kinds.length ? stickIdx : -1;
    if (idx !== this.heldIdx) {
      this.holdTime = 0;
      if (idx >= 0) {
        if (this.locked) {
          this.locked = false;
          ev.push({ t: 'lock', locked: false });
        }
        ev.push({ t: 'select', kind: kinds[idx] });
        this.state.attackIndex = idx;
      } else if (!this.locked) {
        ev.push({ t: 'select', kind: null });
        this.state.attackIndex = -1;
      }
      this.heldIdx = idx;
    } else if (idx >= 0 && !this.locked) {
      this.holdTime += dt;
      if (this.holdTime + 1e-9 >= TUNING.attackLockSec) {
        this.locked = true;
        ev.push({ t: 'lock', locked: true });
      }
    }
    return ev;
  }

  private switchTo(menu: MenuId): AttackEvent[] {
    const ev: AttackEvent[] = [];
    if (this.state.menu === 'attack' && menu !== 'attack') {
      if (this.locked) ev.push({ t: 'lock', locked: false });
      if (this.state.attackIndex >= 0) ev.push({ t: 'select', kind: null });
      this.locked = false;
      this.heldIdx = -1;
      this.holdTime = 0;
      this.state.attackIndex = -1;
    }
    this.state.menu = menu;
    return ev;
  }
}
