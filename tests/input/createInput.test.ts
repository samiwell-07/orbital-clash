import { describe, expect, it } from 'vitest';
import { PlayerUiMachine, type AttackEvent } from '../../src/input/playerUi';
import { createInput } from '../../src/input/createInput';
import { createKeyboard } from '../../src/input/keyboard';
import { PAD } from '../../src/input/bindings';
import type { GamepadLike } from '../../src/input/gamepad';
import type { Intent, StructureKind, UnitKind } from '../../src/types';

const UNITS: UnitKind[] = ['scout', 'tank', 'drone', 'torpedo'];

describe('PlayerUiMachine', () => {
  it('toggles menus and wraps the build index', () => {
    const m = new PlayerUiMachine();
    m.toggleBuild();
    expect(m.menu).toBe('build');
    m.moveBuild(-1, 4);
    expect(m.state.buildIndex).toBe(3);
    m.moveBuild(1, 4);
    expect(m.state.buildIndex).toBe(0);
    m.toggleAttack();
    expect(m.menu).toBe('attack');
    expect(m.back().closed).toBe(true);
    expect(m.back().closed).toBe(false);
  });

  it('selects on tilt, deselects on release, locks after 0.8 s, unlocks on next tilt', () => {
    const m = new PlayerUiMachine();
    m.toggleAttack();
    expect(m.updateAttack(1, UNITS, 0.1)).toEqual([{ t: 'select', kind: 'tank' }]);
    expect(m.state.attackIndex).toBe(1);
    const early: AttackEvent[] = [];
    for (let i = 0; i < 7; i++) early.push(...m.updateAttack(1, UNITS, 0.1));
    expect(early).toEqual([]);
    expect(m.updateAttack(1, UNITS, 0.1)).toEqual([{ t: 'lock', locked: true }]);
    expect(m.updateAttack(-1, UNITS, 0.1)).toEqual([]);
    expect(m.state.attackIndex).toBe(1);
    expect(m.updateAttack(2, UNITS, 0.1)).toEqual([
      { t: 'lock', locked: false },
      { t: 'select', kind: 'drone' },
    ]);
    expect(m.updateAttack(-1, UNITS, 0.1)).toEqual([{ t: 'select', kind: null }]);
    expect(m.state.attackIndex).toBe(-1);
  });

  it('changing direction resets the lock timer; closing the menu releases the attack', () => {
    const m = new PlayerUiMachine();
    m.toggleAttack();
    m.updateAttack(0, UNITS, 0.1);
    for (let i = 0; i < 6; i++) m.updateAttack(0, UNITS, 0.1);
    m.updateAttack(3, UNITS, 0.1);
    for (let i = 0; i < 7; i++) expect(m.updateAttack(3, UNITS, 0.1)).toEqual([]);
    expect(m.updateAttack(3, UNITS, 0.1)).toEqual([{ t: 'lock', locked: true }]);
    expect(m.toggleAttack()).toEqual([
      { t: 'lock', locked: false },
      { t: 'select', kind: null },
    ]);
  });
});

function fakePad() {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  const axes = [0, 0, 0, 0];
  const pad: GamepadLike = { connected: true, axes, buttons };
  const set = (i: number, v: boolean): void => {
    buttons[i] = { pressed: v, value: v ? 1 : 0 };
  };
  return { pad, set, axes };
}

function setup(withPad = true, structure?: (tx: number, ty: number) => StructureKind | null) {
  const f = fakePad();
  const kb = createKeyboard(null);
  const items: StructureKind[] = ['turret', 'laser', 'basicOps'];
  const input = createInput({
    players: [0],
    getBuildItems: () => items,
    getAttackUnits: () => UNITS,
    getCursor: () => ({ tx: 5, ty: 6 }),
    getStructureKindAt: structure,
    getGamepads: () => (withPad ? [f.pad] : []),
    keyboard: kb,
  });
  const frame = (dt = 0.1): Intent[] => input.poll(dt);
  return { f, kb, input, frame };
}

describe('createInput (gamepad)', () => {
  it('emits analog move every poll with deadzone', () => {
    const { f, frame } = setup();
    f.axes[0] = 0.1;
    expect(frame()[0]).toEqual({ t: 'move', player: 0, ax: 0, ay: 0 });
    f.axes[0] = 0.6;
    f.axes[1] = -0.3;
    expect(frame()[0]).toEqual({ t: 'move', player: 0, ax: 0.6, ay: -0.3 });
  });

  it('R1 opens build menu, dpad picks, X builds on cursor tile, O closes', () => {
    const { f, input, frame } = setup();
    f.set(PAD.R1, true);
    frame();
    f.set(PAD.R1, false);
    expect(input.ui(0).menu).toBe('build');
    f.set(PAD.DOWN, true);
    frame();
    f.set(PAD.DOWN, false);
    frame();
    expect(input.ui(0).buildIndex).toBe(1);
    f.set(PAD.X, true);
    expect(frame()).toContainEqual({ t: 'build', player: 0, kind: 'laser', tx: 5, ty: 6 });
    f.set(PAD.X, false);
    f.set(PAD.O, true);
    const closing = frame();
    expect(input.ui(0).menu).toBe('none');
    expect(closing.some((i) => i.t === 'upgrade')).toBe(false);
  });

  it('O upgrades, Square recycles, Triangle repairs when no menu is open', () => {
    const { f, frame } = setup();
    for (const [btn, t] of [
      [PAD.O, 'upgrade'],
      [PAD.SQUARE, 'recycle'],
      [PAD.TRIANGLE, 'repair'],
    ] as const) {
      f.set(btn, true);
      expect(frame()).toContainEqual({ t, player: 0, tx: 5, ty: 6 });
      f.set(btn, false);
      frame();
    }
  });

  it('only acts on structures when getStructureKindAt says one is there', () => {
    const { f, frame } = setup(true, () => null);
    f.set(PAD.O, true);
    expect(frame().some((i) => i.t === 'upgrade')).toBe(false);
  });

  it('hold X on a spawn tower cycles output at 0.4 s then every 0.6 s', () => {
    const { f, frame } = setup(true, () => 'basicOps');
    f.set(PAD.X, true);
    const frames: number[] = [];
    for (let i = 0; i < 20; i++) {
      if (frame(0.1).some((x) => x.t === 'cycleOutput')) frames.push(i);
    }
    expect(frames).toEqual([4, 10, 16]);
  });

  it('hold X does nothing over a non-spawn structure', () => {
    const { f, frame } = setup(true, () => 'turret');
    f.set(PAD.X, true);
    for (let i = 0; i < 10; i++) expect(frame(0.1).some((x) => x.t === 'cycleOutput')).toBe(false);
  });

  it('R3 attack menu: right stick selects, holds to lock, unlocks on tilt; L1 cycles target', () => {
    const { f, input, frame } = setup();
    f.set(PAD.R3, true);
    frame();
    f.set(PAD.R3, false);
    expect(input.ui(0).menu).toBe('attack');
    f.axes[2] = 1;
    expect(frame()).toContainEqual({ t: 'attackSelect', player: 0, kind: 'tank' });
    expect(input.ui(0).attackIndex).toBe(1);
    const all: Intent[] = [];
    for (let i = 0; i < 8; i++) all.push(...frame());
    expect(all).toContainEqual({ t: 'attackLock', player: 0, locked: true });
    f.axes[2] = 0;
    frame();
    f.axes[3] = 1;
    const unlock = frame();
    expect(unlock).toContainEqual({ t: 'attackLock', player: 0, locked: false });
    expect(unlock).toContainEqual({ t: 'attackSelect', player: 0, kind: 'drone' });
    f.set(PAD.L1, true);
    expect(frame()).toContainEqual({ t: 'cycleTarget', player: 0 });
  });

  it('L2 grabs while held and drops on release', () => {
    const { f, frame } = setup();
    f.set(PAD.L2, true);
    expect(frame()).toContainEqual({ t: 'grab', player: 0 });
    expect(frame()).toContainEqual({ t: 'grab', player: 0 });
    f.set(PAD.L2, false);
    expect(frame()).toContainEqual({ t: 'drop', player: 0 });
    expect(frame().some((i) => i.t === 'drop')).toBe(false);
  });

  it('Start emits one pause intent, opens the pause menu and mutes other intents', () => {
    const { f, input, frame } = setup();
    f.set(PAD.START, true);
    expect(frame().filter((i) => i.t === 'pause')).toHaveLength(1);
    f.set(PAD.START, false);
    expect(input.ui(0).menu).toBe('pause');
    f.set(PAD.O, true);
    expect(frame().some((i) => i.t === 'upgrade')).toBe(false);
    f.set(PAD.O, false);
    frame();
    f.set(PAD.START, true);
    expect(frame().some((i) => i.t === 'pause')).toBe(true);
    expect(input.ui(0).menu).toBe('none');
  });
});

describe('createInput (keyboard fallback)', () => {
  it('drives a player without a pad from WASD/E/Shift', () => {
    const { kb, input, frame } = setup(false);
    kb.press('KeyD');
    expect(frame()[0]).toEqual({ t: 'move', player: 0, ax: 1, ay: 0 });
    kb.release('KeyD');
    kb.press('ShiftLeft');
    frame();
    kb.release('ShiftLeft');
    expect(input.ui(0).menu).toBe('build');
    kb.press('KeyE');
    expect(frame()).toContainEqual({ t: 'build', player: 0, kind: 'turret', tx: 5, ty: 6 });
  });

  it('second keyboard player uses the IJKL set; a padded player keeps the pad', () => {
    const f = fakePad();
    const kb = createKeyboard(null);
    const input = createInput({
      players: [0, 1],
      getBuildItems: () => [],
      getAttackUnits: () => UNITS,
      getCursor: () => ({ tx: 0, ty: 0 }),
      getGamepads: () => [f.pad],
      keyboard: kb,
    });
    kb.press('KeyW');
    kb.press('KeyL');
    f.axes[1] = 0.5;
    const out = input.poll(0.016);
    expect(out.find((i) => i.t === 'move' && i.player === 0)).toMatchObject({ ax: 0, ay: 0.5 });
    expect(out.find((i) => i.t === 'move' && i.player === 1)).toMatchObject({ ax: 0, ay: -1 });
  });

  it('two keyboard players: P1 on WASD, P2 on IJKL', () => {
    const kb = createKeyboard(null);
    const input = createInput({
      players: [0, 1],
      getBuildItems: () => [],
      getAttackUnits: () => UNITS,
      getCursor: () => ({ tx: 0, ty: 0 }),
      getGamepads: () => [],
      keyboard: kb,
    });
    kb.press('KeyW');
    kb.press('KeyL');
    const out = input.poll(0.016);
    expect(out.find((i) => i.t === 'move' && i.player === 0)).toMatchObject({ ax: 0, ay: -1 });
    expect(out.find((i) => i.t === 'move' && i.player === 1)).toMatchObject({ ax: 1, ay: 0 });
  });

  it('nav() reports menu navigation from any device', () => {
    const { kb, input } = setup(false);
    kb.press('ArrowDown');
    input.poll(0.016);
    expect(input.nav().down).toBe(true);
    kb.release('ArrowDown');
    kb.press('Enter');
    input.poll(0.016);
    expect(input.nav().confirm).toBe(true);
  });
});
