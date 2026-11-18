import type { InputApi, Intent, PlayerId, PlayerUi } from '../types';
import { KEY_SETS } from './bindings';
import { defaultGetGamepads, emptySnapshot, readGamepad, type GetGamepads, type PadSnapshot } from './gamepad';
import { createKeyboard, keyboardSnapshot, type KeyboardState } from './keyboard';
import { MenuNav, NO_NAV, rawNav, type NavState } from './menuNav';
import { PlayerController, type PlayerHooks } from './playerIntents';

export interface CreateInputOptions extends PlayerHooks {
  players: readonly PlayerId[];
  /** Injectable for tests; defaults to navigator.getGamepads. */
  getGamepads?: GetGamepads;
  /** Injectable key state; defaults to a window listener (disposed with the input). */
  keyboard?: KeyboardState;
}

export interface InputController extends InputApi {
  isPaused(): boolean;
  /** Lets the shell close the pause overlay (e.g. a "Resume" menu item) without a Start press. */
  setPaused(on: boolean): Intent[];
  readonly keyboard: KeyboardState;
}

const NO_UI: PlayerUi = { menu: 'none', buildIndex: 0, attackIndex: -1 };

export function createInput(opts: CreateInputOptions): InputController {
  const getPads = opts.getGamepads ?? defaultGetGamepads();
  const ownsKeyboard = !opts.keyboard;
  const keyboard = opts.keyboard ?? createKeyboard();
  const controllers = new Map<PlayerId, PlayerController>();
  for (const p of opts.players) controllers.set(p, new PlayerController(p, opts));
  const menuNav = new MenuNav();
  let nav: NavState = NO_NAV;
  let paused = false;

  const applyPause = (on: boolean, out: Intent[]): void => {
    paused = on;
    for (const c of controllers.values()) c.setPause(on, out);
  };

  return {
    keyboard,
    isPaused: () => paused,

    poll(dt) {
      const out: Intent[] = [];
      const pads = getPads();
      const keySnaps = KEY_SETS.map((s) => keyboardSnapshot(keyboard, s));
      const padSnaps: PadSnapshot[] = [];
      for (let i = 0; i < 4; i++) {
        const s = readGamepad(pads, i);
        if (s) padSnaps.push(s);
      }

      // Players without a pad share the keyboard sets in order (first = WASD, second = IJKL).
      let keyRank = 0;
      let startPressed = false;
      for (const [p, c] of controllers) {
        const snap = readGamepad(pads, p) ?? keySnaps[keyRank++] ?? emptySnapshot();
        if (c.update(snap, dt, paused, out)) startPressed = true;
      }
      if (startPressed) {
        out.push({ t: 'pause' });
        applyPause(!paused, out);
      }

      nav = menuNav.update(rawNav([...padSnaps, ...keySnaps], keyboard), dt);
      keyboard.endFrame();
      return out;
    },

    ui: (player) => controllers.get(player)?.ui ?? NO_UI,
    nav: () => nav,

    setPaused(on) {
      const out: Intent[] = [];
      if (on !== paused) {
        out.push({ t: 'pause' });
        applyPause(on, out);
      }
      return out;
    },

    dispose() {
      if (ownsKeyboard) keyboard.dispose();
    },
  };
}
