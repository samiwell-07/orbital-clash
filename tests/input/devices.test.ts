import { describe, expect, it } from 'vitest';
import { DeviceTracker, deviceLabel } from '../../src/input/devices';
import { createKeyboard } from '../../src/input/keyboard';
import { PAD, TUNING } from '../../src/input/bindings';
import type { GamepadLike } from '../../src/input/gamepad';
import type { DeviceFrame, DeviceId } from '../../src/types/input';

function fakePad() {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  const axes = [0, 0, 0, 0];
  const pad: GamepadLike = { connected: true, axes, buttons };
  const set = (i: number, v: boolean): void => {
    buttons[i] = { pressed: v, value: v ? 1 : 0 };
  };
  return { pad, set, axes };
}

function setup(pads: (GamepadLike | null)[] = []) {
  const kb = createKeyboard(null);
  const t = new DeviceTracker();
  const step = (dt = 0.016): Record<DeviceId, DeviceFrame> => {
    const frames = t.update(pads, kb, dt);
    kb.endFrame();
    return Object.fromEntries(frames.map((f) => [f.id, f])) as Record<DeviceId, DeviceFrame>;
  };
  return { kb, step };
}

describe('DeviceTracker', () => {
  it('reports all six devices; disconnected pads have every flag false', () => {
    const { step } = setup();
    const f = step();
    expect(Object.keys(f)).toEqual(['pad0', 'pad1', 'pad2', 'pad3', 'kb1', 'kb2']);
    expect(f.pad2).toEqual({ id: 'pad2', connected: false, confirm: false, back: false, left: false, right: false, start: false, alt: false });
    expect(f.kb1.connected).toBe(true);
    expect(deviceLabel('pad3')).toBe('Controller 4');
    expect(deviceLabel('kb2')).toBe('Keyboard (IJKL)');
  });

  it('pad confirm fires once per press, back and start on their own buttons', () => {
    const p = fakePad();
    const { step } = setup([p.pad]);
    step();
    p.set(PAD.X, true);
    expect(step().pad0.confirm).toBe(true);
    expect(step().pad0.confirm).toBe(false);
    p.set(PAD.X, false);
    step();
    p.set(PAD.X, true);
    p.set(PAD.O, true);
    p.set(PAD.START, true);
    const f = step().pad0;
    expect(f).toMatchObject({ confirm: true, back: true, start: true, alt: false });
  });

  it('alt fires once per press: pad Y / Triangle, keyboard R (kb1) and H (kb2)', () => {
    const p = fakePad();
    const { kb, step } = setup([p.pad]);
    step();
    p.set(PAD.TRIANGLE, true);
    kb.press('KeyR');
    let f = step();
    expect([f.pad0.alt, f.kb1.alt, f.kb2.alt]).toEqual([true, true, false]);
    f = step();
    expect([f.pad0.alt, f.kb1.alt]).toEqual([false, false]);
    kb.press('KeyH');
    expect(step().kb2.alt).toBe(true);
  });

  it('a pad connecting with A already held needs a fresh press', () => {
    const p = fakePad();
    const pads: (GamepadLike | null)[] = [null];
    const { step } = setup(pads);
    step();
    p.set(PAD.X, true);
    pads[0] = p.pad;
    expect(step().pad0).toMatchObject({ connected: true, confirm: false });
    p.set(PAD.X, false);
    step();
    p.set(PAD.X, true);
    expect(step().pad0.confirm).toBe(true);
  });

  it('stick right fires on press, then repeats after the nav delay', () => {
    const p = fakePad();
    const { step } = setup([p.pad]);
    step();
    p.axes[0] = 0.9;
    const fires: number[] = [];
    const dt = 0.05;
    for (let i = 0; i < 12; i++) if (step(dt).pad0.right) fires.push(i);
    const firstRepeat = Math.ceil(TUNING.navDelaySec / dt - 1e-9);
    expect(fires.slice(0, 2)).toEqual([0, firstRepeat]);
    expect(fires.length).toBeGreaterThan(2);
  });

  it('kb1 confirms with E or Enter, kb2 with U; A/D and J/L steer only their own set', () => {
    const { kb, step } = setup();
    step();
    kb.press('KeyE');
    let f = step();
    expect(f.kb1.confirm).toBe(true);
    expect(f.kb2.confirm).toBe(false);
    kb.release('KeyE');
    step();
    kb.press('Enter');
    expect(step().kb1.confirm).toBe(true);
    kb.release('Enter');
    kb.press('KeyU');
    f = step();
    expect(f.kb2.confirm).toBe(true);
    expect(f.kb1.confirm).toBe(false);
    kb.press('KeyA');
    kb.press('KeyL');
    f = step();
    expect(f.kb1).toMatchObject({ left: true, right: false });
    expect(f.kb2).toMatchObject({ left: false, right: true });
    kb.press('Backspace');
    expect(step().kb1.back).toBe(true);
  });
});
