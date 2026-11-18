import type { PlayerId, StructureKind, UnitKind } from './ids';

/**
 * Commands from the input layer (gamepad/keyboard/AI/script) into the simulation.
 * Mapping from PS3 pad: R1 build menu, X build/hold-X cycle, O upgrade, Square recycle,
 * Triangle repair, R3 attack menu, right stick pick unit, L1 cycle target.
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
  | { t: 'grab'; player: PlayerId }
  | { t: 'drop'; player: PlayerId }
  | { t: 'pause' };

export type MenuId = 'none' | 'build' | 'attack' | 'pause';

/** Per-player UI-facing input state (what menus are open, which build item highlighted). */
export interface PlayerUi {
  menu: MenuId;
  buildIndex: number;
  /** attack-menu stick direction picks this unit index; -1 none */
  attackIndex: number;
}

export interface InputApi {
  /** Collect intents for this frame for all local human players. */
  poll(dt: number): Intent[];
  ui(player: PlayerId): PlayerUi;
  /** True when menu navigation actions (confirm/back/up/down) fire this frame. */
  nav(): { up: boolean; down: boolean; left: boolean; right: boolean; confirm: boolean; back: boolean };
  dispose(): void;
}
