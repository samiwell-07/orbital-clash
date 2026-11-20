import { AXIS, NAV_KEYS, PAD, TUNING } from './bindings';
import { HoldRepeater, type PadSnapshot } from './gamepad';
import type { KeyDown } from './keyboard';

export interface NavState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

export const NO_NAV: Readonly<NavState> = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
};

/** Held directions from any device: dpad or left stick, ORed together. */
export function rawNav(snaps: readonly PadSnapshot[], kb: KeyDown | null): NavState {
  const n = { ...NO_NAV };
  const t = TUNING.navStick;
  for (const s of snaps) {
    n.up ||= s.buttons[PAD.UP] || s.axes[AXIS.LY] < -t;
    n.down ||= s.buttons[PAD.DOWN] || s.axes[AXIS.LY] > t;
    n.left ||= s.buttons[PAD.LEFT] || s.axes[AXIS.LX] < -t;
    n.right ||= s.buttons[PAD.RIGHT] || s.axes[AXIS.LX] > t;
    n.confirm ||= s.buttons[PAD.X];
    n.back ||= s.buttons[PAD.O];
  }
  if (kb) {
    n.confirm ||= NAV_KEYS.confirm.some((c) => kb.isDown(c));
    n.back ||= NAV_KEYS.back.some((c) => kb.isDown(c));
  }
  return n;
}

/** Turns held directions into press+repeat pulses; confirm/back fire once per press. */
export class MenuNav {
  private readonly dirs = {
    up: new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true),
    down: new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true),
    left: new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true),
    right: new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true),
  };
  private prevConfirm = false;
  private prevBack = false;

  update(raw: NavState, dt: number): NavState {
    const out: NavState = {
      up: this.dirs.up.update(raw.up, dt) > 0,
      down: this.dirs.down.update(raw.down, dt) > 0,
      left: this.dirs.left.update(raw.left, dt) > 0,
      right: this.dirs.right.update(raw.right, dt) > 0,
      confirm: raw.confirm && !this.prevConfirm,
      back: raw.back && !this.prevBack,
    };
    this.prevConfirm = raw.confirm;
    this.prevBack = raw.back;
    return out;
  }
}
