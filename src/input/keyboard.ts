import { AXIS, KEY_SETS, PAD, type DirKeys, type KeySet, type PadButtonName } from './bindings';
import { emptySnapshot, type PadSnapshot } from './gamepad';

export interface KeyEventLike {
  code: string;
  target?: unknown;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  preventDefault?: () => void;
}
export interface KeyTargetLike {
  addEventListener(type: string, fn: (e: KeyEventLike) => void): void;
  removeEventListener(type: string, fn: (e: KeyEventLike) => void): void;
}

const BOUND_CODES: ReadonlySet<string> = new Set(
  KEY_SETS.flatMap((s) => [
    ...Object.values(s.move).flat(),
    ...Object.values(s.pick).flat(),
    ...Object.values(s.buttons).flat(),
  ]),
);

/** Key state by KeyboardEvent.code. A key tapped between two polls still counts as down once. */
export class KeyboardState {
  private down = new Set<string>();
  private tapped = new Set<string>();
  private readonly onDown = (e: KeyEventLike): void => {
    if (isEditable(e.target)) return;
    this.press(e.code);
    if (BOUND_CODES.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault?.();
  };
  private readonly onUp = (e: KeyEventLike): void => this.release(e.code);
  private readonly onBlur = (): void => this.clear();

  constructor(private readonly target: KeyTargetLike | null) {
    target?.addEventListener('keydown', this.onDown);
    target?.addEventListener('keyup', this.onUp);
    target?.addEventListener('blur', this.onBlur);
  }

  press(code: string): void {
    this.down.add(code);
    this.tapped.add(code);
  }
  release(code: string): void {
    this.down.delete(code);
  }
  isDown(code: string): boolean {
    return this.down.has(code) || this.tapped.has(code);
  }
  /** Call once per poll after reading, so taps shorter than a frame register exactly once. */
  endFrame(): void {
    this.tapped.clear();
  }
  clear(): void {
    this.down.clear();
    this.tapped.clear();
  }
  dispose(): void {
    this.target?.removeEventListener('keydown', this.onDown);
    this.target?.removeEventListener('keyup', this.onUp);
    this.target?.removeEventListener('blur', this.onBlur);
    this.clear();
  }
}

function isEditable(t: unknown): boolean {
  const tag = (t as { tagName?: string } | null | undefined)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function createKeyboard(target?: KeyTargetLike | null): KeyboardState {
  const t = target === undefined ? (typeof window !== 'undefined' ? window : null) : target;
  return new KeyboardState(t as KeyTargetLike | null);
}

export type KeyDown = Pick<KeyboardState, 'isDown'>;

function anyDown(kb: KeyDown, codes: readonly string[] | undefined): boolean {
  return !!codes && codes.some((c) => kb.isDown(c));
}

const axisOf = (kb: KeyDown, neg: readonly string[], pos: readonly string[]): number =>
  (anyDown(kb, pos) ? 1 : 0) - (anyDown(kb, neg) ? 1 : 0);

/** Converts a keyboard key set to a virtual pad: move -> left stick, pick -> dpad + right stick. */
export function keyboardSnapshot(kb: KeyDown, set: KeySet): PadSnapshot {
  const snap = emptySnapshot();
  const { move, pick }: { move: DirKeys; pick: DirKeys } = set;
  snap.axes[AXIS.LX] = axisOf(kb, move.left, move.right);
  snap.axes[AXIS.LY] = axisOf(kb, move.up, move.down);
  snap.axes[AXIS.RX] = axisOf(kb, pick.left, pick.right);
  snap.axes[AXIS.RY] = axisOf(kb, pick.up, pick.down);
  for (const name of Object.keys(set.buttons) as PadButtonName[]) {
    snap.buttons[PAD[name]] = anyDown(kb, set.buttons[name]);
  }
  snap.buttons[PAD.UP] = anyDown(kb, pick.up);
  snap.buttons[PAD.DOWN] = anyDown(kb, pick.down);
  snap.buttons[PAD.LEFT] = anyDown(kb, pick.left);
  snap.buttons[PAD.RIGHT] = anyDown(kb, pick.right);
  return snap;
}
