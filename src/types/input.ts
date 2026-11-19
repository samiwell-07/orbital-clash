import type { PlayerId, StructureKind, UnitKind } from './ids';

/**
 * Commands from the input layer (gamepad/keyboard/AI/script) into the simulation.
 * Pad mapping (Xbox / PlayStation), as in the original game: left stick or D-pad move, RB/R1 build menu,
 * A/Cross build (hold on a spawn tower: cycle output), B/Circle upgrade, X/Square recycle, Y/Triangle repair,
 * right stick attack (RS/R3 only shows the attack menu), LB/L1 target, RT/R2 grab, hold LT/L2 missile.
 */
export type Intent =
  | { t: 'move'; player: PlayerId; ax: number; ay: number }
  | { t: 'build'; player: PlayerId; kind: StructureKind; tx: number; ty: number }
  | { t: 'buildBase'; player: PlayerId; tx: number; ty: number }
  | { t: 'upgrade'; player: PlayerId; tx: number; ty: number }
  | { t: 'recycle'; player: PlayerId; tx: number; ty: number }
  | { t: 'repair'; player: PlayerId; tx: number; ty: number }
  | { t: 'cycleOutput'; player: PlayerId; tx: number; ty: number }
  | { t: 'attackSelect'; player: PlayerId; kind: UnitKind | null }
  | { t: 'attackLock'; player: PlayerId; locked: boolean }
  | { t: 'cycleTarget'; player: PlayerId }
  | { t: 'fireMissile'; player: PlayerId }
  | { t: 'grab'; player: PlayerId }
  | { t: 'drop'; player: PlayerId }
  /** Toggles pause; with `on`, sets that state instead (online play, so two presses a few steps apart don't cancel). */
  | { t: 'pause'; on?: boolean };

export type MenuId = 'none' | 'build' | 'pause';

/** A physical input device: browser gamepad index 0-3, or one of the two keyboard key sets (kb1 = WASD, kb2 = IJKL). */
export type DeviceId = 'pad0' | 'pad1' | 'pad2' | 'pad3' | 'kb1' | 'kb2';
export const DEVICE_IDS: readonly DeviceId[] = ['pad0', 'pad1', 'pad2', 'pad3', 'kb1', 'kb2'];

/** One device's lobby-relevant input this frame. All flags are edges (left/right also auto-repeat while held). */
export interface DeviceFrame {
  id: DeviceId;
  /** Pads: connected right now. Keyboards: always true. */
  connected: boolean;
  /** Pad A / Cross; keyboard E (kb1) or U (kb2). */
  confirm: boolean;
  /** Pad B / Circle; keyboard Q (kb1) or O (kb2). */
  back: boolean;
  /** D-pad / left stick; keyboard move keys (A/D, J/L). */
  left: boolean;
  right: boolean;
  /** Pad Menu / Start; keyboard Esc/P (kb1) or Numpad0 (kb2). */
  start: boolean;
  /** Pad Y / Triangle; keyboard R (kb1) or the IJKL set's Repair key (kb2). Lobby: open the room online. */
  alt?: boolean;
  /** Online lobby: the room peer this device belongs to (absent = 0 = this machine / the host). */
  peer?: number;
}

/** A lobby seat: which device controls the player and which PLAYER_COLORS index they chose. Seat 0 = P1. */
export interface Seat {
  device: DeviceId;
  colorIndex: number;
  /** Online: room peer that owns the device (absent = 0 = host / local). */
  peer?: number;
}

/** Per-player UI-facing input state (what menus are open, which build item highlighted). */
export interface PlayerUi {
  menu: MenuId;
  buildIndex: number;
  /** Right-stick direction picks this attack unit index; -1 none. */
  attackIndex: number;
  /** RS/R3 toggles the attack-menu display; the right stick attacks either way. */
  attackShown: boolean;
  /** Missile button hold progress, 0..1 (fires at 1). */
  missileCharge: number;
}

export interface InputApi {
  /** Collect intents for this frame for all local human players. */
  poll(dt: number): Intent[];
  ui(player: PlayerId): PlayerUi;
  /** True when menu navigation actions (confirm/back/up/down) fire this frame. */
  nav(): { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; back: boolean };
  dispose(): void;
}
