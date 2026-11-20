import type { MenuId, PlayerUi, UnitKind } from '../types';
import { TUNING } from './bindings';

export type AttackEvent = { t: 'select'; kind: UnitKind | null } | { t: 'lock'; locked: boolean };

/**
 * Per-player menu state machine (none/build/pause), the attack-menu display toggle and the
 * right-stick hold-to-lock timer. The right stick attacks whether or not the attack menu is shown.
 */
export class PlayerUiMachine {
  readonly state: PlayerUi = { menu: 'none', buildIndex: 0, attackIndex: -1, attackShown: false, missileCharge: 0 };
  private heldIdx = -1;
  private holdTime = 0;
  private locked = false;

  get menu(): MenuId {
    return this.state.menu;
  }

  toggleBuild(): void {
    this.state.menu = this.state.menu === 'build' ? 'none' : 'build';
  }

  /** RS/R3: show or hide the attack menu (display only). */
  toggleAttackDisplay(): void {
    this.state.attackShown = !this.state.attackShown;
  }

  /** Back button: closes the build menu. Returns whether it was open. */
  back(): { closed: boolean } {
    if (this.state.menu !== 'build') return { closed: false };
    this.state.menu = 'none';
    return { closed: true };
  }

  /** Pausing drops a held (unlocked) attack pick; a locked attack stays locked. */
  setPause(on: boolean): AttackEvent[] {
    const ev = on ? this.release() : [];
    this.state.menu = on ? 'pause' : 'none';
    this.state.missileCharge = 0;
    return ev;
  }

  moveBuild(step: number, count: number): void {
    if (count <= 0) {
      this.state.buildIndex = 0;
      return;
    }
    this.state.buildIndex = (((this.state.buildIndex + step) % count) + count) % count;
  }

  /** Jumps by `step` items, stopping at the first/last item; wraps only when already at that edge. */
  jumpBuild(step: number, count: number): void {
    if (count <= 0) {
      this.state.buildIndex = 0;
      return;
    }
    const last = count - 1;
    const i = this.state.buildIndex;
    if (step > 0) this.state.buildIndex = i >= last ? 0 : Math.min(last, i + step);
    else this.state.buildIndex = i <= 0 ? last : Math.max(0, i + step);
  }

  clampBuild(count: number): void {
    this.state.buildIndex = Math.max(0, Math.min(Math.max(0, count - 1), this.state.buildIndex));
  }

  /**
   * Right-stick tick. `stickIdx` is the unit sector under the stick (-1 neutral).
   * Tilting selects (and the sim releases units while held); releasing deselects unless locked;
   * holding the same direction for attackLockSec locks; tilting again unlocks.
   */
  updateAttack(stickIdx: number, kinds: readonly UnitKind[], dt: number): AttackEvent[] {
    if (this.state.menu === 'pause') return [];
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

  private release(): AttackEvent[] {
    const ev: AttackEvent[] = [];
    if (!this.locked && this.state.attackIndex >= 0) {
      ev.push({ t: 'select', kind: null });
      this.state.attackIndex = -1;
    }
    this.heldIdx = -1;
    this.holdTime = 0;
    return ev;
  }
}
