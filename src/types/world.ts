import type { PlayerId, TeamId, UnitKind, GameMode, Difficulty, Profile, CometId, StructureKind } from './ids';
import type { Structure, Unit, Projectile, Rock, Ship } from './entities';
import type { Tech } from './defs';
import type { SimEvent } from './events';
import type { Mission } from './mission';

export type Controller = 'human' | 'script' | 'adaptive' | 'none';

/** Attack menu state (R3): picked unit type, lock bar, target enemy. */
export interface AttackState {
  selected: UnitKind | null;
  /** Locked attack keeps releasing the selected unit without holding the stick. */
  locked: boolean;
  targetPlayer: PlayerId;
}

export interface PlayerStats {
  kills: number;
  unitsLost: number;
  unitsLaunched: number;
  thoriumEarned: number;
  structuresBuilt: number;
  basesDestroyed: number;
  /** Campaign time penalties (seconds), applied as they occur. */
  penaltySec: number;
}

export interface Player {
  id: PlayerId;
  team: TeamId;
  controller: Controller;
  alive: boolean;
  thorium: number;
  tech: Record<string, boolean>;
  /** Base position (tile), set after the base is built. */
  baseTx: number;
  baseTy: number;
  baseBuilt: boolean;
  hits: number;
  maxHits: number;
  /** Stored units waiting at the base, by kind. Sum capped at STORAGE_CAP (1000). */
  stored: Partial<Record<UnitKind, number>>;
  attack: AttackState;
  ship: Ship;
  stats: PlayerStats;
}

export type Terrain = 0 | 1 | 2; // 0 floor, 1 rock/cliff (blocked), 2 crater (blocked, decorative)

export interface Grid {
  w: number;
  h: number;
  terrain: Uint8Array;
  /** Structure id occupying the tile, 0 when empty. */
  occupant: Int32Array;
}

/** Per-target-player distance field; ground units descend it toward the base. */
export interface FlowField {
  target: PlayerId;
  dist: Uint16Array;
  version: number;
}

export interface WorldSettings {
  mode: GameMode;
  profile: Profile;
  difficulty: Difficulty;
  maxHits: number;
  /** Battle: 0.5..2.0 thorium rate. */
  thoriumRate: number;
  /** Battle: seconds; 0 = untimed. At 0 left, spawn runs at 8x. */
  timeLimitSec: number;
  /** Per-player strength 0..1 scales start thorium and hit count. */
  strength: number[];
  mission: Mission | null;
  comet: CometId | null;
  seed: number;
}

export interface World {
  tick: number;
  timeSec: number;
  nextId: number;
  paused: boolean;
  over: boolean;
  winnerTeam: TeamId | -1;
  settings: WorldSettings;
  grid: Grid;
  flows: (FlowField | null)[];
  players: Player[];
  structures: Map<number, Structure>;
  units: Unit[];
  projectiles: Projectile[];
  rocks: Rock[];
  /** Events produced during the current tick, drained by renderer/audio/UI each frame. */
  events: SimEvent[];
  /** Deterministic RNG state (mulberry32). */
  rng: number;
  /** Mission timeline cursor: index of next event to fire. */
  timelineCursor: number;
}

export type Emit = (e: SimEvent) => void;
/** A system mutates the world for one fixed step. Order is defined in sim/pipeline.ts. */
export type System = (w: World, dt: number, emit: Emit) => void;

export type { StructureKind, Tech };
