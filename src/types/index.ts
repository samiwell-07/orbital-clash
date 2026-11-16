/**
 * Shared type contract for Orbital Clash (v2: swarm trains, harvesters, research, sidebar HUD).
 * Every system operates on the plain-data `World` defined here.
 */

/** 0 = Player 1 (left, blue). 1 = Player 2 (purple) or AI (red), on the right. */
export type Team = 0 | 1;

export interface Vec2 {
  x: number;
  y: number;
}

export interface GridPos {
  col: number;
  row: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- Grid

/** 'rock' = natural impassable obstacle/crater. 'base' = part of a team base. */
export type CellType = 'empty' | 'rock' | 'base';

export interface Cell {
  type: CellType;
  /** Id of the tower occupying this cell, or null. */
  towerId: number | null;
  /** Owner team when type === 'base', otherwise null. */
  baseTeam: Team | null;
  /** Cosmetic 0..1 noise value for terrain shading. */
  shade: number;
  /** Id of the obstacle formation this rock cell belongs to (for rendering whole craters), else -1. */
  obstacleId: number;
}

export interface GridData {
  cols: number;
  rows: number;
  /** Row-major: index = row * cols + col. */
  cells: Cell[];
  /** Incremented whenever passability changes (tower built/sold). */
  version: number;
}

/**
 * Per-team BFS distance field (in steps) from every cell to the TARGET base of that team's units.
 * `dist[team][i]` = steps for a unit of `team` from cell i to reach base of otherTeam(team); -1 = unreachable.
 */
export interface FlowFields {
  version: number;
  dist: [Int32Array, Int32Array];
}

/** Bucketed spatial index of live units (rebuilt every sim step). See systems/Spatial.ts. */
export interface SpatialIndex {
  cellSize: number;
  cols: number;
  rows: number;
  /** head[cell] = index into `items` of first unit in that bucket, -1 if empty. */
  head: Int32Array;
  /** next[i] = index of next unit in same bucket, -1 terminates. */
  next: Int32Array;
  items: Unit[];
  count: number;
}

// ---------------------------------------------------------------- Definitions (static data)

/** laser = red laser, cannon = fireball mortar, cryo = blue frost wave, plasma = yellow/white plasma stream, refinery = Harvest Station. */
export type TowerKind = 'laser' | 'cannon' | 'cryo' | 'plasma' | 'refinery';
/** scout = Swarmer, tank = Juggernaut, shielded = Aegis (hybrid), bomber = air unit. */
export type UnitKind = 'scout' | 'tank' | 'shielded' | 'bomber';
export type ResearchKind = 'maxLevel3' | 'swarmSpeed' | 'doubleHarvest';

/** Stats for one upgrade level of a tower. Distances in TILES, times in SECONDS. */
export interface TowerLevelStats {
  /** Cost to build (level 0) or to upgrade INTO this level (levels 1, 2). */
  cost: number;
  damage: number;
  range: number;
  fireInterval: number;
  splashRadius: number;
  /** Speed multiplier applied to slowed units (0.5 = half speed). 1 = no slow. */
  slowFactor: number;
  slowDuration: number;
  projectileSpeed: number;
  /** Refinery only: radius in tiles within which landed rocks are pulled in. */
  magnetRadius: number;
  /** Refinery only: pull speed in tiles/second. */
  magnetStrength: number;
  /** Refinery only: seconds to refine one rock. */
  refineTime: number;
  /** Refinery only: multiplier on rock value. */
  valueMultiplier: number;
  /** Refinery only: number of harvester drones this station operates. */
  harvesters: number;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  description: string;
  hitsGround: boolean;
  hitsAir: boolean;
  /** Exactly 3 levels (index 0..2). Level index 2 requires research 'maxLevel3'. */
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

export interface UnitDef {
  kind: UnitKind;
  name: string;
  description: string;
  /** Units are bought in squads: `packCost` buys `packSize` units into the wave buffer. */
  packCost: number;
  packSize: number;
  maxHp: number;
  maxShield: number;
  shieldRegen: number;
  shieldRegenDelay: number;
  /** Multiplier on LASER/PLASMA damage dealt to shield points. */
  shieldLaserMult: number;
  /** Tiles per second. */
  speed: number;
  /** Air units fly straight over the maze; only towers with hitsAir can target them. */
  air: boolean;
  baseDamage: number;
  /** Money for the team that kills ONE unit. */
  bounty: number;
  /** Render/collision radius in PIXELS. */
  radius: number;
}

export interface ResearchDef {
  kind: ResearchKind;
  name: string;
  description: string;
  /** Cost in research energy (cyan bar). */
  cost: number;
}

/** Sidebar/hotkey slots. */
export type BuildAction =
  | { type: 'build'; kind: TowerKind }
  | { type: 'send'; kind: UnitKind }
  | { type: 'research'; kind: ResearchKind }
  | { type: 'launch' }
  | { type: 'upgrade' }
  | { type: 'sell' };

/** World/AI tuning. Single player levels are 1-based and unbounded; versus uses level 0. */
export interface LevelDef {
  level: number;
  aiStartMoney: number;
  aiIncomeMult: number;
  aiThinkInterval: number;
  aiUnitHpMult: number;
  aiDroneSpeed: number;
  /** Fraction of AI money spent on offense (0..1). */
  aiAggression: number;
  /** AI launches its buffer when it holds at least this many units. */
  aiLaunchSize: number;
  meteorInterval: number;
  /** Rocks per shower cluster [min, max]. */
  rocksPerShower: [number, number];
}

// ---------------------------------------------------------------- Entities (runtime)

export interface Tower {
  id: number;
  team: Team;
  kind: TowerKind;
  level: 0 | 1 | 2;
  col: number;
  row: number;
  /** Pixel center (map space). */
  x: number;
  y: number;
  cooldown: number;
  targetId: number | null;
  /** Turret angle in radians. */
  angle: number;
  /** Money invested (build + upgrades), for sell refund. */
  totalSpent: number;
  /** Refinery: rock ids queued for refining. */
  refineQueue: number[];
  refineProgress: number;
  flash: number;
  buildAnim: number;
}

export interface Unit {
  id: number;
  team: Team;
  kind: UnitKind;
  air: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  sinceDamage: number;
  /** Base speed in tiles/second (swarmSpeed research already applied at spawn). */
  speed: number;
  /** Next waypoint cell (ground units follow FlowFields cell to cell). */
  nextCol: number;
  nextRow: number;
  slowTimer: number;
  slowFactor: number;
  alive: boolean;
  angle: number;
  hitFlash: number;
  age: number;
  /** Index of this unit inside its launched train (0 = head). For rendering serpent segments. */
  trainIndex: number;
}

/** missile = cannon fireball. */
export type ProjectileKind = 'missile';

export interface Projectile {
  id: number;
  team: Team;
  kind: ProjectileKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  targetId: number | null;
  speed: number;
  damage: number;
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  alive: boolean;
  angle: number;
  trailTimer: number;
}

export type BeamStyle = 'laser' | 'plasma';

export interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  team: Team;
  style: BeamStyle;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

export interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export type RockState = 'falling' | 'landed' | 'carried' | 'magnet' | 'refining';

/** One Thorium crystal cluster sitting on (or falling to) a tile. */
export interface ThoriumRock {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  startX: number;
  startY: number;
  state: RockState;
  value: number;
  fallTimer: number;
  fallDuration: number;
  /** Team whose ship (cursor) carries it. */
  carriedBy: Team | null;
  /** Harvester id carrying it (state 'carried'), else null. */
  harvesterId: number | null;
  /** Refinery tower id pulling / refining it. */
  magnetTowerId: number | null;
  /** Harvester id that has reserved it as a mining target. */
  reservedBy: number | null;
  pulse: number;
  size: number;
  alive: boolean;
}

export type HarvesterState = 'idle' | 'toRock' | 'returning';

/** Automated mining drone owned by a Harvest Station (refinery). Flies; never blocks or is targeted. */
export interface Harvester {
  id: number;
  team: Team;
  stationId: number;
  x: number;
  y: number;
  state: HarvesterState;
  targetRockId: number | null;
  /** Rock ids currently carried. Capacity 1, or 2 with 'doubleHarvest'. */
  cargo: number[];
  angle: number;
  alive: boolean;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface Base {
  team: Team;
  col: number;
  row: number;
  w: number;
  h: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

/** The player's ship: grid cursor + flying collector that can carry one rock. */
export interface CursorState {
  col: number;
  row: number;
  x: number;
  y: number;
  carryingRockId: number | null;
  failFlash: number;
  moveRepeat: number;
}

export type ControllerKind = 'p1' | 'p2' | 'ai';

export interface PlayerStats {
  kills: number;
  rocksRefined: number;
  unitsSent: number;
  moneyEarned: number;
  launches: number;
}

export interface PlayerState {
  team: Team;
  controller: ControllerKind;
  /** Palette key: 'blue' (P1), 'purple' (P2 versus), 'red' (AI). */
  palette: PaletteKey;
  money: number;
  /** Research energy (cyan bar). */
  research: number;
  researched: Record<ResearchKind, boolean>;
  selectedTower: TowerKind;
  cursor: CursorState;
  /** Wave buffer: units bought, all launched together as one train. */
  queue: UnitKind[];
  spawnCells: GridPos[];
  unitHpMult: number;
  incomeMult: number;
  stats: PlayerStats;
}

export type PaletteKey = 'blue' | 'purple' | 'red';

export interface PendingSpawn {
  team: Team;
  kind: UnitKind;
  delay: number;
  trainIndex: number;
}

// ---------------------------------------------------------------- Events

export type GameEvent =
  | { type: 'build'; team: Team; kind: TowerKind; x: number; y: number }
  | { type: 'upgrade'; team: Team; kind: TowerKind; level: number; x: number; y: number }
  | { type: 'sell'; team: Team; refund: number; x: number; y: number }
  | { type: 'buildFail'; team: Team; reason: string; col: number; row: number }
  | { type: 'shot'; team: Team; kind: TowerKind; x: number; y: number }
  | { type: 'explosion'; x: number; y: number; big: boolean }
  | { type: 'unitKilled'; killerTeam: Team; kind: UnitKind; bounty: number; x: number; y: number }
  | { type: 'baseHit'; team: Team; damage: number }
  | { type: 'meteorShower'; count: number }
  | { type: 'rockLanded'; x: number; y: number }
  | { type: 'rockPickup'; team: Team }
  | { type: 'rockDrop'; team: Team }
  | { type: 'rockRefined'; team: Team; value: number; x: number; y: number }
  | { type: 'unitQueued'; team: Team; kind: UnitKind; count: number }
  | { type: 'notEnoughMoney'; team: Team }
  | { type: 'research'; team: Team; kind: ResearchKind }
  | { type: 'waveLaunched'; team: Team; count: number }
  | { type: 'gameOver'; winner: Team };

export type GameEventType = GameEvent['type'];

// ---------------------------------------------------------------- World

export type GameMode = 'single' | 'versus';

export interface World {
  mode: GameMode;
  level: LevelDef;
  grid: GridData;
  flow: FlowFields;
  spatial: SpatialIndex;
  bases: [Base, Base];
  players: [PlayerState, PlayerState];
  towers: Tower[];
  units: Unit[];
  harvesters: Harvester[];
  projectiles: Projectile[];
  beams: Beam[];
  rings: Ring[];
  rocks: ThoriumRock[];
  particles: Particle[];
  texts: FloatingText[];
  pendingSpawns: PendingSpawn[];
  events: GameEvent[];
  /** Match time in seconds (counts up; shown as 00:00 in the sidebar). */
  time: number;
  /** Total launches by both teams. */
  waveNumber: number;
  meteorTimer: number;
  shake: number;
  winner: Team | null;
  nextId: number;
  rng: () => number;
}

// ---------------------------------------------------------------- Screens / view

export type ScreenState = 'menu' | 'howto' | 'playing' | 'paused' | 'gameover';

export interface MenuView {
  title: string;
  subtitle: string;
  items: string[];
  selected: number;
  lines: string[];
}

export interface ViewState {
  screen: ScreenState;
  menu: MenuView | null;
  fps: number;
  realTime: number;
  level: number;
  muted: boolean;
  banner: { text: string; color: string; time: number } | null;
}

export type SfxName =
  | 'laser'
  | 'cannon'
  | 'cryo'
  | 'plasma'
  | 'explosion'
  | 'bigExplosion'
  | 'build'
  | 'upgrade'
  | 'sell'
  | 'error'
  | 'pickup'
  | 'drop'
  | 'cash'
  | 'meteor'
  | 'baseHit'
  | 'wave'
  | 'queue'
  | 'research'
  | 'menuMove'
  | 'menuSelect'
  | 'victory'
  | 'defeat';
