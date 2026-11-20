// Typed binding tables: standard-mapping gamepad indices, keyboard sets and tuning.
// Keys are KeyboardEvent.code values.

export const PAD = {
  X: 0,
  O: 1,
  SQUARE: 2,
  TRIANGLE: 3,
  L1: 4,
  R1: 5,
  L2: 6,
  R2: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
} as const;
export type PadButtonName = keyof typeof PAD;
export const PAD_BUTTON_COUNT = 16;

/** Standard mapping axes: left stick moves the ship, right stick picks the attack unit. */
export const AXIS = { LX: 0, LY: 1, RX: 2, RY: 3 } as const;

export const TUNING = {
  moveDeadzone: 0.18,
  /** Right-stick tilt needed to pick an attack unit. */
  attackTilt: 0.5,
  /** Seconds the same direction must be held to lock the attack. */
  attackLockSec: 0.8,
  /** Hold X on a spawn tower: first cycleOutput after this, then repeat. */
  cycleHoldSec: 0.4,
  cycleRepeatSec: 0.6,
  navStick: 0.5,
  navDelaySec: 0.35,
  navRepeatSec: 0.12,
  triggerThreshold: 0.5,
} as const;

export interface DirKeys {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
}

export interface KeySet {
  id: string;
  /** `pick` keys drive the dpad (build menu) AND the right stick (attack unit); they never move the ship. */
  move: DirKeys;
  pick: DirKeys;
  buttons: Partial<Record<PadButtonName, readonly string[]>>;
}

export const KEY_SETS: readonly KeySet[] = [
  {
    id: 'P1',
    move: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
    pick: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
    buttons: {
      X: ['KeyE'],
      O: ['KeyQ'],
      SQUARE: ['KeyF'],
      TRIANGLE: ['KeyR'],
      R1: ['ShiftLeft', 'ShiftRight', 'Tab'],
      R3: ['Space', 'KeyV'],
      L1: ['BracketRight', 'BracketLeft'],
      R2: ['KeyG'],
      L2: ['KeyC'],
      START: ['Escape', 'KeyP'],
    },
  },
  {
    id: 'P2',
    move: { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'] },
    pick: { up: ['Numpad8'], down: ['Numpad2'], left: ['Numpad4'], right: ['Numpad6'] },
    buttons: {
      X: ['KeyU'],
      O: ['KeyO'],
      SQUARE: ['KeyY'],
      TRIANGLE: ['KeyH'],
      R1: ['KeyN'],
      R3: ['KeyM'],
      L1: ['Comma', 'Period'],
      R2: ['KeyB'],
      L2: ['Semicolon'],
      START: ['Numpad0'],
    },
  },
];

/** Extra menu-only keys (nav): any device. */
export const NAV_KEYS = { confirm: ['Enter', 'NumpadEnter'], back: ['Backspace'] } as const;

/**
 * Human-readable table (docs/HUD help screens), matching the original game's controller screen.
 * Browsers expose Xbox and PlayStation pads with the same standard layout, so both columns share one binding.
 */
export const BINDING_ROWS: readonly { action: string; xbox: string; ps: string; p1: string; p2: string }[] = [
  { action: 'Move ship', xbox: 'Left stick / D-pad', ps: 'Left stick / D-pad', p1: 'W A S D', p2: 'I J K L' },
  { action: 'Build menu (open/close)', xbox: 'RB', ps: 'R1', p1: 'Shift / Tab', p2: 'N' },
  { action: 'Pick build item (build menu open)', xbox: 'D-pad (←/→ skip 4)', ps: 'D-pad (←/→ skip 4)', p1: 'Arrow keys', p2: 'Numpad 8 4 2 6' },
  { action: 'Build / modify, confirm', xbox: 'A', ps: 'Cross', p1: 'E', p2: 'U' },
  { action: 'Empty tile, menu closed: build last picked item', xbox: 'A', ps: 'Cross', p1: 'E', p2: 'U' },
  { action: 'Hold on spawn tower: cycle output', xbox: 'Hold A', ps: 'Hold Cross', p1: 'Hold E', p2: 'Hold U' },
  { action: 'Upgrade tower (build menu: close)', xbox: 'B', ps: 'Circle', p1: 'Q', p2: 'O' },
  { action: 'Recycle tower', xbox: 'X', ps: 'Square', p1: 'F', p2: 'Y' },
  { action: 'Repair tower', xbox: 'Y', ps: 'Triangle', p1: 'R', p2: 'H' },
  { action: 'Attack: pick unit (hold 0.8 s = lock)', xbox: 'Right stick', ps: 'Right stick', p1: 'Arrow keys', p2: 'Numpad 8 4 2 6' },
  { action: 'Show / hide attack menu', xbox: 'RS click', ps: 'R3', p1: 'Space / V', p2: 'M' },
  { action: 'Target enemy (Battle)', xbox: 'LB', ps: 'L1', p1: '] / [', p2: ', / .' },
  { action: 'Grab rock (hold) / drop (release)', xbox: 'RT', ps: 'R2', p1: 'G', p2: 'B' },
  { action: 'Missile (hold 3 s, release early to cancel)', xbox: 'LT', ps: 'L2', p1: 'C', p2: ';' },
  { action: 'Pause', xbox: 'Menu', ps: 'Start', p1: 'Esc / P', p2: 'Numpad 0' },
  { action: 'Menu confirm / back (any device)', xbox: 'A / B', ps: 'Cross / Circle', p1: 'Enter / Backspace', p2: 'Enter / Backspace' },
];
