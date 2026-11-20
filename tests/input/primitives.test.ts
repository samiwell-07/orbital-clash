import { describe, expect, it } from 'vitest';
import {
  applyDeadzone,
  EdgeDetector,
  emptySnapshot,
  HoldRepeater,
  snapshotGamepad,
  stickToIndex,
  type GamepadLike,
} from '../../src/input/gamepad';
import { createKeyboard, keyboardSnapshot } from '../../src/input/keyboard';
import { KEY_SETS, PAD } from '../../src/input/bindings';
import { MenuNav, NO_NAV, rawNav } from '../../src/input/menuNav';
import { tileUnderShip } from '../../src/input/cursor';

describe('deadzone', () => {
  it('zeroes small tilt and preserves analog magnitude above it', () => {
    expect(applyDeadzone(0.1, 0.1, 0.18)).toEqual({ x: 0, y: 0 });
    expect(applyDeadzone(0.5, 0, 0.18)).toEqual({ x: 0.5, y: 0 });
  });
  it('clamps diagonal keyboard input to the unit circle', () => {
    const v = applyDeadzone(1, 1, 0.18);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });
});

describe('stickToIndex', () => {
  it('maps four directions clockwise from up', () => {
    expect(stickToIndex(0, -1, 4, 0.5)).toBe(0);
    expect(stickToIndex(1, 0, 4, 0.5)).toBe(1);
    expect(stickToIndex(0, 1, 4, 0.5)).toBe(2);
    expect(stickToIndex(-1, 0, 4, 0.5)).toBe(3);
  });
  it('returns -1 below the tilt threshold or with no units', () => {
    expect(stickToIndex(0.3, 0, 4, 0.5)).toBe(-1);
    expect(stickToIndex(1, 0, 0, 0.5)).toBe(-1);
  });
  it('handles up-left wraparound and other counts', () => {
    expect(stickToIndex(-0.1, -1, 4, 0.5)).toBe(0);
    expect(stickToIndex(0, 1, 8, 0.5)).toBe(4);
    expect(stickToIndex(1, 0, 1, 0.5)).toBe(0);
  });
});

describe('EdgeDetector', () => {
  it('reports pressed and released once', () => {
    const ed = new EdgeDetector();
    expect(ed.update([true, false]).pressed).toEqual([true, false]);
    const held = ed.update([true, false]);
    expect(held.pressed).toEqual([false, false]);
    expect(held.down).toEqual([true, false]);
    expect(ed.update([false, false]).released).toEqual([true, false]);
  });
});

describe('HoldRepeater', () => {
  it('fires at the hold threshold then every repeat interval', () => {
    const r = new HoldRepeater(0.4, 0.6);
    r.update(true, 0);
    const fires: number[] = [];
    let t = 0;
    for (let i = 0; i < 20; i++) {
      t += 0.1;
      if (r.update(true, 0.1) > 0) fires.push(Math.round(t * 10) / 10);
    }
    expect(fires).toEqual([0.4, 1.0, 1.6]);
  });
  it('does not fire for a short tap and restarts after release', () => {
    const r = new HoldRepeater(0.4, 0.6);
    r.update(true, 0);
    expect(r.update(true, 0.3)).toBe(0);
    r.update(false, 0.1);
    r.update(true, 0);
    expect(r.update(true, 0.3)).toBe(0);
    expect(r.update(true, 0.1)).toBe(1);
  });
  it('fireOnPress pulses immediately', () => {
    const r = new HoldRepeater(0.35, 0.12, true);
    expect(r.update(true, 0.016)).toBe(1);
    expect(r.update(true, 0.016)).toBe(0);
  });
});

describe('snapshotGamepad', () => {
  it('reads axes and buttons, treating analog triggers as pressed past half', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    buttons[PAD.X] = { pressed: true, value: 1 };
    buttons[PAD.L2] = { pressed: false, value: 0.8 };
    buttons[PAD.R2] = { pressed: false, value: 0.2 };
    const g: GamepadLike = { connected: true, axes: [0.5, -2, Number.NaN, 0.25], buttons };
    const s = snapshotGamepad(g);
    expect(s.axes).toEqual([0.5, -1, 0, 0.25]);
    expect(s.buttons[PAD.X]).toBe(true);
    expect(s.buttons[PAD.L2]).toBe(true);
    expect(s.buttons[PAD.R2]).toBe(false);
  });
});

describe('keyboard', () => {
  it('maps P1/P2 sets to a virtual pad', () => {
    const kb = createKeyboard(null);
    kb.press('KeyD');
    kb.press('KeyW');
    kb.press('ArrowLeft');
    kb.press('KeyE');
    const s = keyboardSnapshot(kb, KEY_SETS[0]);
    expect(s.axes).toEqual([1, -1, -1, 0]);
    expect(s.buttons[PAD.X]).toBe(true);
    expect(s.buttons[PAD.LEFT]).toBe(true);
    kb.press('KeyL');
    expect(keyboardSnapshot(kb, KEY_SETS[1]).axes[0]).toBe(1);
  });
  it('a tap shorter than a frame still registers once', () => {
    const kb = createKeyboard(null);
    kb.press('KeyE');
    kb.release('KeyE');
    expect(keyboardSnapshot(kb, KEY_SETS[0]).buttons[PAD.X]).toBe(true);
    kb.endFrame();
    expect(keyboardSnapshot(kb, KEY_SETS[0]).buttons[PAD.X]).toBe(false);
  });
});

describe('menu nav', () => {
  it('pulses on press, repeats while held, confirm fires once', () => {
    const nav = new MenuNav();
    const held = { ...NO_NAV, down: true, confirm: true };
    const first = nav.update(held, 0.016);
    expect(first.down && first.confirm).toBe(true);
    const second = nav.update(held, 0.016);
    expect(second.down || second.confirm).toBe(false);
    let pulses = 0;
    for (let i = 0; i < 60; i++) if (nav.update(held, 0.016).down) pulses++;
    expect(pulses).toBeGreaterThanOrEqual(5);
  });
  it('rawNav combines dpad, left stick and keys', () => {
    const a = emptySnapshot();
    a.axes[1] = -0.9;
    const b = emptySnapshot();
    b.buttons[PAD.RIGHT] = true;
    const kb = createKeyboard(null);
    kb.press('Enter');
    expect(rawNav([a, b], kb)).toEqual({ ...NO_NAV, up: true, right: true, confirm: true });
  });
});

describe('tileUnderShip', () => {
  it('floors the position', () => {
    expect(tileUnderShip({ x: 3.9, y: 0.1 })).toEqual({ tx: 3, ty: 0 });
  });
});
