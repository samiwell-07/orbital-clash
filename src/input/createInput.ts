import type { InputApi, Intent, PlayerId, PlayerUi } from '../types';
import type { DeviceFrame, DeviceId } from '../types/input';
import { KEY_SETS, PAD } from './bindings';
import { DeviceTracker, idleFrames, isPadDevice, snapshotFor } from './devices';
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
  /**
   * Lobby seats: each listed player reads ONLY its bound device (no fallback). Players missing from the map get no input.
   * Omit to keep the legacy mapping (pad index = player id, otherwise keyboard sets in order).
   */
  bindings?: ReadonlyMap<PlayerId, DeviceId>;
}

export interface InputController extends InputApi {
  isPaused(): boolean;
  /** Lets the shell close the pause overlay (e.g. a "Resume" menu item) without a Start press. */
  setPaused(on: boolean): Intent[];
  readonly keyboard: KeyboardState;
  /** This poll's per-device lobby input (all six devices, with or without bindings). */
  devices(): readonly DeviceFrame[];
  /** Bound players whose bound pad is disconnected (keyboards are never missing). Empty without bindings. */
  missing(): readonly PlayerId[];
  /** Device currently bound to the player; null without bindings or when unbound. */
  bound(player: PlayerId): DeviceId | null;
}

const NO_UI: PlayerUi = { menu: 'none', buildIndex: 0, attackIndex: -1, attackShown: false, missileCharge: 0 };

export function createInput(opts: CreateInputOptions): InputController {
  const getPads = opts.getGamepads ?? defaultGetGamepads();
  const ownsKeyboard = !opts.keyboard;
  const keyboard = opts.keyboard ?? createKeyboard();
  const controllers = new Map<PlayerId, PlayerController>();
  for (const p of opts.players) controllers.set(p, new PlayerController(p, opts));
  const menuNav = new MenuNav();
  let nav: NavState = NO_NAV;
  let paused = false;
  const tracker = new DeviceTracker();
  let frames: readonly DeviceFrame[] = idleFrames();
  const bindings = opts.bindings ? new Map(opts.bindings) : null;
  let missing: PlayerId[] = [];
  /** Players just rebound by pressing A: mask A until released so the claim press doesn't build. */
  const maskX = new Set<PlayerId>();

  const rebind = (): void => {
    if (!bindings) return;
    const isMissing = (p: PlayerId): boolean => {
      const d = bindings.get(p);
      return !!d && isPadDevice(d) && !frames.find((f) => f.id === d)?.connected;
    };
    const taken = new Set(bindings.values());
    for (const f of frames) {
      if (!isPadDevice(f.id) || !f.connected || !f.confirm || taken.has(f.id)) continue;
      const p = opts.players.find(isMissing);
      if (p === undefined) break;
      bindings.set(p, f.id);
      taken.add(f.id);
      maskX.add(p);
    }
    missing = opts.players.filter(isMissing);
  };

  const boundSnapshot = (p: PlayerId, pads: ReturnType<GetGamepads>): PadSnapshot => {
    const d = bindings?.get(p);
    const snap = (d && snapshotFor(d, pads, keyboard)) ?? emptySnapshot();
    if (maskX.has(p)) {
      if (snap.buttons[PAD.X]) snap.buttons[PAD.X] = false;
      else maskX.delete(p);
    }
    return snap;
  };

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
      frames = tracker.update(pads, keyboard, dt);
      rebind();
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
        const snap = bindings
          ? boundSnapshot(p, pads)
          : (readGamepad(pads, p) ?? keySnaps[keyRank++] ?? emptySnapshot());
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
    devices: () => frames,
    missing: () => missing,
    bound: (player) => bindings?.get(player) ?? null,

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
