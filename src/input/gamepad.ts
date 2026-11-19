import { AXIS, PAD_BUTTON_COUNT, TUNING } from './bindings';

/** Minimal shape of a browser Gamepad so tests can inject fakes. */
export interface GamepadLike {
  connected: boolean;
  axes: ArrayLike<number>;
  buttons: ArrayLike<{ pressed: boolean; value: number }>;
}
export type GetGamepads = () => ArrayLike<GamepadLike | null | undefined>;

/** Device-independent pad state; keyboards are converted into the same shape. */
export interface PadSnapshot {
  /** LX, LY, RX, RY in -1..1 (y down). */
  axes: number[];
  buttons: boolean[];
  /** Real pads move the ship with the D-pad; keyboards use their pick keys only for menus/attacks. */
  dpadMoves: boolean;
}

export function emptySnapshot(): PadSnapshot {
  return { axes: [0, 0, 0, 0], buttons: new Array<boolean>(PAD_BUTTON_COUNT).fill(false), dpadMoves: false };
}

export function snapshotGamepad(g: GamepadLike): PadSnapshot {
  const snap = emptySnapshot();
  snap.dpadMoves = true;
  for (const i of [AXIS.LX, AXIS.LY, AXIS.RX, AXIS.RY]) {
    const v = g.axes[i];
    snap.axes[i] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  }
  for (let i = 0; i < PAD_BUTTON_COUNT; i++) {
    const b = g.buttons[i];
    snap.buttons[i] = !!b && (b.pressed || b.value > TUNING.triggerThreshold);
  }
  return snap;
}

export function defaultGetGamepads(): GetGamepads {
  return () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
        return navigator.getGamepads();
      }
    } catch {
      /* gamepads unavailable (insecure context) */
    }
    return [];
  };
}

/** Pad index = player slot. Null when no connected pad at that index. */
export function readGamepad(list: ReturnType<GetGamepads>, index: number): PadSnapshot | null {
  const g = list[index];
  return g && g.connected ? snapshotGamepad(g) : null;
}

/** Radial deadzone: zero inside it, otherwise the raw analog value clamped to the unit circle. */
export function applyDeadzone(x: number, y: number, deadzone: number): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (mag < deadzone || mag === 0) return { x: 0, y: 0 };
  const k = mag > 1 ? 1 / mag : 1;
  return { x: x * k, y: y * k };
}

/**
 * Maps a stick direction to one of `count` evenly spaced sectors, index 0 = up,
 * increasing clockwise. -1 when the tilt is below `threshold`.
 */
export function stickToIndex(x: number, y: number, count: number, threshold: number): number {
  if (count <= 0 || Math.hypot(x, y) < threshold) return -1;
  let angle = Math.atan2(x, -y);
  if (angle < 0) angle += Math.PI * 2;
  const sector = (Math.PI * 2) / count;
  return Math.floor((angle + sector / 2) / sector + 1e-9) % count;
}

export interface Edges {
  down: boolean[];
  pressed: boolean[];
  released: boolean[];
}

export class EdgeDetector {
  private prev: boolean[] = [];

  update(cur: readonly boolean[]): Edges {
    const pressed = cur.map((d, i) => d && !this.prev[i]);
    const released = cur.map((d, i) => !d && !!this.prev[i]);
    this.prev = cur.slice();
    return { down: cur.slice(), pressed, released };
  }
}

const EPS = 1e-9;

/** Counts how many times a held input fires this update: after `first` s, then every `repeat` s. */
export class HoldRepeater {
  private held = false;
  private t = 0;
  private nextAt: number;

  constructor(
    private readonly first: number,
    private readonly repeat: number,
    private readonly fireOnPress = false,
  ) {
    this.nextAt = first;
  }

  update(down: boolean, dt: number): number {
    if (!down) {
      this.held = false;
      return 0;
    }
    let fires = 0;
    if (!this.held) {
      this.held = true;
      this.t = 0;
      this.nextAt = this.first;
      if (this.fireOnPress) fires++;
    } else {
      this.t += dt;
    }
    while (this.t + EPS >= this.nextAt) {
      fires++;
      this.nextAt += this.repeat;
    }
    return fires;
  }

  reset(): void {
    this.held = false;
  }
}
