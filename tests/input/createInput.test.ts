import { describe, expect, it } from 'vitest';
import { PlayerUiMachine, type AttackEvent } from '../../src/input/playerUi';
import { createInput } from '../../src/input/createInput';
import { createKeyboard } from '../../src/input/keyboard';
import { PAD } from '../../src/input/bindings';
import type { GamepadLike } from '../../src/input/gamepad';
import type { Intent, PlayerId, StructureKind, UnitKind } from '../../src/types';
import type { DeviceId } from '../../src/types/input';

const UNITS: UnitKind[] = ['scout', 'tank', 'drone', 'torpedo'];

describe('PlayerUiMachine', () => {
  it('toggles the build menu, wraps the build index and toggles the attack display', () => {
    const m = new PlayerUiMachine();
    m.toggleBuild();
    expect(m.menu).toBe('build');
    m.moveBuild(-1, 4);
    expect(m.state.buildIndex).toBe(3);
    m.moveBuild(1, 4);
    expect(m.state.buildIndex).toBe(0);
    for (const [step, want] of [[4, 4], [4, 8], [4, 9], [4, 0], [-4, 9], [-4, 5], [-4, 1], [-4, 0]] as const) {
      m.jumpBuild(step, 10);
      expect(m.state.buildIndex).toBe(want);
    }
    m.toggleAttackDisplay();
    expect(m.state.attackShown).toBe(true);
    expect(m.menu).toBe('build');
    expect(m.back().closed).toBe(true);
    expect(m.back().closed).toBe(false);
    expect(m.state.attackShown).toBe(true);
  });

  it('selects on tilt, deselects on release, locks after 0.8 s, unlocks on next tilt (menu not required)', () => {
    const m = new PlayerUiMachine();
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

  it('changing direction resets the lock timer; pausing drops a held pick but keeps a lock', () => {
    const m = new PlayerUiMachine();
    m.updateAttack(0, UNITS, 0.1);
    for (let i = 0; i < 6; i++) m.updateAttack(0, UNITS, 0.1);
    m.updateAttack(3, UNITS, 0.1);
    for (let i = 0; i < 7; i++) expect(m.updateAttack(3, UNITS, 0.1)).toEqual([]);
    expect(m.updateAttack(3, UNITS, 0.1)).toEqual([{ t: 'lock', locked: true }]);
    expect(m.setPause(true)).toEqual([]);
    m.setPause(false);
    expect(m.updateAttack(-1, UNITS, 0.1)).toEqual([]);
    const held = new PlayerUiMachine();
    held.updateAttack(2, UNITS, 0.1);
    expect(held.setPause(true)).toEqual([{ t: 'select', kind: null }]);
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

function setup(
  withPad = true,
  structure?: (tx: number, ty: number) => StructureKind | null,
  hasBase?: (p: PlayerId) => boolean,
) {
  const f = fakePad();
  const kb = createKeyboard(null);
  const items: StructureKind[] = ['turret', 'laser', 'basicOps'];
  const input = createInput({
    players: [0],
    getBuildItems: () => items,
    getAttackUnits: () => UNITS,
    getCursor: () => ({ tx: 5, ty: 6 }),
    getStructureKindAt: structure,
    hasBase,
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
    for (let i = 0; i < 10; i++) {
      const out = frame(0.1);
      expect(out.some((x) => x.t === 'cycleOutput' || x.t === 'build')).toBe(false);
    }
  });

  it('X on an empty tile with no menu open builds the last picked item; holding it does not cycle the new tower', () => {
    let at: StructureKind | null = null;
    const { f, input, frame } = setup(true, () => at, () => true);
    f.set(PAD.R1, true);
    frame();
    f.set(PAD.R1, false);
    f.set(PAD.UP, true);
    frame();
    f.set(PAD.UP, false);
    f.set(PAD.R1, true);
    frame();
    f.set(PAD.R1, false);
    expect(input.ui(0)).toMatchObject({ menu: 'none', buildIndex: 2 });
    f.set(PAD.X, true);
    expect(frame()).toContainEqual({ t: 'build', player: 0, kind: 'basicOps', tx: 5, ty: 6 });
    at = 'basicOps';
    for (let i = 0; i < 10; i++) expect(frame().some((x) => x.t === 'cycleOutput' || x.t === 'build')).toBe(false);
    f.set(PAD.X, false);
    frame();
    f.set(PAD.X, true);
    const held: Intent[] = [];
    for (let i = 0; i < 5; i++) held.push(...frame());
    expect(held.some((x) => x.t === 'build')).toBe(false);
    expect(held).toContainEqual({ t: 'cycleOutput', player: 0, tx: 5, ty: 6 });
  });

  it('X with no base founds the base instead of quick-building', () => {
    const { f, frame } = setup(true, () => null, () => false);
    f.set(PAD.X, true);
    const out = frame();
    expect(out).toContainEqual({ t: 'buildBase', player: 0, tx: 5, ty: 6 });
    expect(out.some((x) => x.t === 'build')).toBe(false);
  });

  it('right stick attacks without opening anything; R3 only shows the menu; L1 cycles target', () => {
    const { f, input, frame } = setup();
    f.axes[2] = 1;
    expect(frame()).toContainEqual({ t: 'attackSelect', player: 0, kind: 'tank' });
    expect(input.ui(0).attackIndex).toBe(1);
    expect(input.ui(0).attackShown).toBe(false);
    const all: Intent[] = [];
    for (let i = 0; i < 8; i++) all.push(...frame());
    expect(all).toContainEqual({ t: 'attackLock', player: 0, locked: true });
    f.axes[2] = 0;
    f.set(PAD.R3, true);
    expect(frame().some((i) => i.t.startsWith('attack'))).toBe(false);
    f.set(PAD.R3, false);
    expect(input.ui(0).attackShown).toBe(true);
    f.axes[3] = 1;
    const unlock = frame();
    expect(unlock).toContainEqual({ t: 'attackLock', player: 0, locked: false });
    expect(unlock).toContainEqual({ t: 'attackSelect', player: 0, kind: 'drone' });
    f.set(PAD.L1, true);
    expect(frame()).toContainEqual({ t: 'cycleTarget', player: 0 });
  });

  it('D-pad moves the ship (no build menu) and picks build items when the build menu is open', () => {
    const { f, input, frame } = setup();
    f.set(PAD.UP, true);
    f.set(PAD.RIGHT, true);
    const m = frame()[0] as Extract<Intent, { t: 'move' }>;
    expect(m.ax).toBeCloseTo(Math.SQRT1_2);
    expect(m.ay).toBeCloseTo(-Math.SQRT1_2);
    f.set(PAD.UP, false);
    f.set(PAD.RIGHT, false);
    f.set(PAD.R1, true);
    frame();
    f.set(PAD.R1, false);
    f.set(PAD.DOWN, true);
    expect(frame()[0]).toEqual({ t: 'move', player: 0, ax: 0, ay: 0 });
    expect(input.ui(0).buildIndex).toBe(1);
  });

  it('RT grabs while held and drops on release; LT does not grab', () => {
    const { f, frame } = setup();
    f.set(PAD.L2, true);
    expect(frame().some((i) => i.t === 'grab')).toBe(false);
    f.set(PAD.L2, false);
    f.set(PAD.R2, true);
    expect(frame()).toContainEqual({ t: 'grab', player: 0 });
    expect(frame()).toContainEqual({ t: 'grab', player: 0 });
    f.set(PAD.R2, false);
    expect(frame()).toContainEqual({ t: 'drop', player: 0 });
    expect(frame().some((i) => i.t === 'drop')).toBe(false);
  });

  it('holding LT for 3 s fires one missile; releasing earlier cancels', () => {
    const { f, input, frame } = setup();
    const fired = (n: number): number => {
      let count = 0;
      for (let i = 0; i < n; i++) count += frame(0.1).filter((x) => x.t === 'fireMissile').length;
      return count;
    };
    f.set(PAD.L2, true);
    expect(fired(25)).toBe(0);
    expect(input.ui(0).missileCharge).toBeGreaterThan(0.75);
    f.set(PAD.L2, false);
    frame();
    expect(input.ui(0).missileCharge).toBe(0);
    f.set(PAD.L2, true);
    expect(fired(30)).toBe(0);
    expect(fired(1)).toBe(1);
    expect(fired(40)).toBe(0);
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

  it('E on an empty tile quick-builds the last picked item with the menu closed', () => {
    const { kb, frame } = setup(false, () => null, () => true);
    kb.press('KeyE');
    expect(frame()).toContainEqual({ t: 'build', player: 0, kind: 'turret', tx: 5, ty: 6 });
  });

  it('keyboard arrows attack but never move the ship', () => {
    const { kb, frame } = setup(false);
    kb.press('ArrowRight');
    const out = frame();
    expect(out[0]).toEqual({ t: 'move', player: 0, ax: 0, ay: 0 });
    expect(out).toContainEqual({ t: 'attackSelect', player: 0, kind: 'tank' });
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

describe('createInput (device bindings)', () => {
  function bound(bindings: Map<PlayerId, DeviceId>, players: PlayerId[]) {
    const pads = [fakePad(), fakePad(), fakePad()];
    const list: (GamepadLike | null)[] = pads.map((p) => p.pad);
    const kb = createKeyboard(null);
    const input = createInput({
      players,
      bindings,
      getBuildItems: () => [],
      getAttackUnits: () => UNITS,
      getCursor: () => ({ tx: 0, ty: 0 }),
      hasBase: () => false,
      getGamepads: () => list,
      keyboard: kb,
    });
    const moves = (): Record<number, { ax: number; ay: number }> => {
      const out = input.poll(0.016);
      return Object.fromEntries(
        out.filter((i) => i.t === 'move').map((i) => [i.player, { ax: i.ax, ay: i.ay }]),
      );
    };
    return { pads, list, kb, input, moves };
  }

  it('each campaign player reads only its own pad; keyboard keys do nothing for padded players', () => {
    const { pads, kb, input, moves } = bound(new Map<PlayerId, DeviceId>([[0, 'pad0'], [2, 'pad1']]), [0, 2]);
    pads[1].axes[0] = 1;
    expect(moves()).toEqual({ 0: { ax: 0, ay: 0 }, 2: { ax: 1, ay: 0 } });
    pads[1].axes[0] = 0;
    pads[0].axes[1] = 1;
    expect(moves()).toEqual({ 0: { ax: 0, ay: 1 }, 2: { ax: 0, ay: 0 } });
    pads[0].axes[1] = 0;
    pads[2].axes[0] = 1;
    kb.press('KeyD');
    kb.press('KeyL');
    expect(moves()).toEqual({ 0: { ax: 0, ay: 0 }, 2: { ax: 0, ay: 0 } });
    expect(input.bound(2)).toBe('pad1');
    expect(input.missing()).toEqual([]);
  });

  it('a player bound to kb2 uses IJKL only', () => {
    const { pads, kb, moves } = bound(new Map<PlayerId, DeviceId>([[0, 'kb2']]), [0]);
    pads[0].axes[0] = 1;
    kb.press('KeyD');
    expect(moves()[0]).toEqual({ ax: 0, ay: 0 });
    kb.press('KeyI');
    expect(moves()[0]).toEqual({ ax: 0, ay: -1 });
  });

  it('an unplugged pad makes its player missing; an unbound pad pressing A takes over', () => {
    const { pads, list, input, moves } = bound(new Map<PlayerId, DeviceId>([[0, 'pad0'], [2, 'pad1']]), [0, 2]);
    pads[1].axes[0] = 1;
    list[1] = null;
    expect(moves()[2]).toEqual({ ax: 0, ay: 0 });
    expect(input.missing()).toEqual([2]);
    expect(input.devices().find((d) => d.id === 'pad1')?.connected).toBe(false);
    pads[0].set(PAD.X, true);
    moves();
    expect(input.bound(2)).toBe('pad1');
    pads[2].set(PAD.X, true);
    const out = input.poll(0.016);
    expect(out.some((i) => i.t !== 'move')).toBe(false);
    expect(input.missing()).toEqual([]);
    expect(input.bound(2)).toBe('pad2');
    pads[2].axes[0] = -1;
    expect(moves()).toEqual({ 0: { ax: 0, ay: 0 }, 2: { ax: -1, ay: 0 } });
  });

  it('devices() reports per-device frames without bindings too', () => {
    const { f, input, frame } = setup();
    frame();
    f.set(PAD.X, true);
    frame();
    expect(input.devices().find((d) => d.id === 'pad0')?.confirm).toBe(true);
    expect(input.missing()).toEqual([]);
    expect(input.bound(0)).toBeNull();
  });
});
