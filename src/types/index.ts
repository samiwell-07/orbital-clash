/**
 * Shared type contract for Orbital Clash.
 * Every system operates on the plain-data `World` defined here.
 */

/** 0 = Player 1 (left, cyan). 1 = Player 2 / AI (right, orange). */
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

/** 'rock' = natural impassable outcrop. 'base' = part of a team base. */
export type CellType = 'empty' | 'rock' | 'base';

export interface Cell {
  type: CellType;
  /** Id of the tower occupying this cell, or null. */
  towerId: number | null;
  /** Owner team when type === 'base', otherwise null. */
  baseTeam: Team | null;
  /** Cosmetic 0..1 noise value for terrain shading. */
  shade: number;
}

export interface GridData {
  cols: number;
  rows: number;
  /** Row-major: index = row * cols + col. */
  cells: Cell[];
  /** Incremented whenever passability changes (tower built/sold). */
  version: number;
}

// ---------------------------------------------------------------- Definitions (static data)

export type TowerKind = 'laser' | 'cannon' | 'cryo' | 'refinery';
export type UnitKind = 'scout' | 'tank' | 'shielded';

/** Stats for one upgrade level of a tower. Distances are in TILES, times in SECONDS. */
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
  /** Refinery only: radius in tiles within which rocks are pulled in. */
  magnetRadius: number;
  /** Refinery only: pull speed in tiles/second. */
  magnetStrength: number;
  /** Refinery only: seconds to refine one rock into money. */
  refineTime: number;
  /** Refinery only: multiplier on rock value. */
  valueMultiplier: number;
}

export interface TowerDef {
  kind: TowerKind;
  name: string;
  description: string;
  /** Exactly 3 levels (index 0..2). */
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

export interface UnitDef {
  kind: UnitKind;
  name: string;
  description: string;
  cost: number;
  maxHp: number;
  maxShield: number;
  /** Shield points regenerated per second (after shieldRegenDelay without damage). */
  shieldRegen: number;
  shieldRegenDelay: number;
  /** Multiplier on LASER damage dealt to shield points (0.5 = lasers half as effective). */
  shieldLaserMult: number;
  /** Tiles per second. */
  speed: number;
  /** Damage dealt to the enemy base on arrival. */
  baseDamage: number;
  /** Money awarded to the team that kills it. */
  bounty: number;
  /** Collision/render radius in PIXELS. */
  radius: number;
}

export type BuildAction =
  | { type: 'build'; kind: TowerKind }
  | { type: 'send'; kind: UnitKind };

/** AI / world tuning for a given single-player level (1-based, unbounded). */
export interface LevelDef {
  level: number;
  /** Starting money for team 1 (AI or P2). */
  aiStartMoney: number;
  /** Multiplier for AI passive wave income. */
  aiIncomeMult: number;
  /** Seconds between AI decisions. */
  aiThinkInterval: number;
  /** HP multiplier for units sent by the AI. */
  aiUnitHpMult: number;
  /** AI drone speed in tiles/second. */
  aiDroneSpeed: number;
  /** Fraction of AI money spent on offense (0..1). */
  aiAggression: number;
  meteorInterval: number;
  rocksPerShower: [number, number];
  waveInterval: number;
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
  /** Turret angle in radians (render). */
  angle: number;
  /** Money invested (build + upgrades) – used for sell refund. */
  totalSpent: number;
  /** Refinery: rock ids currently queued for refining. */
  refineQueue: number[];
  refineProgress: number;
  /** Visual flash timer (seconds) after firing / refining. */
  flash: number;
  /** Visual build-in animation 0..1. */
  buildAnim: number;
}

export interface Unit {
  id: number;
  team: Team;
  kind: UnitKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  /** Seconds since last damage (for shield regen). */
  sinceDamage: number;
  /** Base speed in tiles/second. */
  speed: number;
  /** Current path in cells (path[pathIndex] = next waypoint). */
  path: GridPos[];
  pathIndex: number;
  /** grid.version the path was computed for. */
  pathVersion: number;
  slowTimer: number;
  slowFactor: number;
  alive: boolean;
  angle: number;
  hitFlash: number;
  /** Seconds alive (for render bobbing). */
  age: number;
}

export type ProjectileKind = 'missile' | 'cryo';

export interface Projectile {
  id: number;
  team: Team;
  kind: ProjectileKind;
  x: number;
  y: number;
  /** Target position (updated while target alive). */
  tx: number;
  ty: number;
  targetId: number | null;
  /** Pixels per second. */
  speed: number;
  damage: number;
  /** Pixels. */
  splashRadius: number;
  slowFactor: number;
  slowDuration: number;
  alive: boolean;
  angle: number;
  trailTimer: number;
}

/** Instant laser beam visual. */
export interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  team: Team;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

/** Expanding ring visual (cryo pulse, explosion shockwave, build ping). */
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

export interface ThoriumRock {
  id: number;
  x: number;
  y: number;
  /** Landing target (falling) – pixel coordinates. */
  targetX: number;
  targetY: number;
  /** Fall start position (for trail interpolation). */
  startX: number;
  startY: number;
  state: RockState;
  value: number;
  fallTimer: number;
  fallDuration: number;
  /** Team whose drone is carrying it (state 'carried'). */
  carriedBy: Team | null;
  /** Refinery tower id pulling / refining it (state 'magnet' | 'refining'). */
  magnetTowerId: number | null;
  /** Random phase for glow pulsing. */
  pulse: number;
  size: number;
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
  /** Velocity multiplier per second (e.g. 0.1 = strong drag). */
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
  /** Top-left cell. */
  col: number;
  row: number;
  /** Size in cells. */
  w: number;
  h: number;
  /** Pixel center. */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

export interface CursorState {
  col: number;
  row: number;
  /** Smoothed pixel position of the drone (map space) for rendering & carrying. */
  x: number;
  y: number;
  carryingRockId: number | null;
  /** Red flash timer after an invalid action. */
  failFlash: number;
  /** Key auto-repeat timer for keyboard movement. */
  moveRepeat: number;
}

export type ControllerKind = 'p1' | 'p2' | 'ai';

export interface PlayerStats {
  kills: number;
  rocksRefined: number;
  unitsSent: number;
  moneyEarned: number;
}

export interface PlayerState {
  team: Team;
  controller: ControllerKind;
  money: number;
  selectedTower: TowerKind;
  cursor: CursorState;
  /** Units bought, launched at next wave. */
  queue: UnitKind[];
  /** Cells adjacent to this team's base where its units spawn. */
  spawnCells: GridPos[];
  /** HP multiplier for this team's units. */
  unitHpMult: number;
  /** Multiplier for passive wave income. */
  incomeMult: number;
  stats: PlayerStats;
}

export interface PendingSpawn {
  team: Team;
  kind: UnitKind;
  delay: number;
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
  | { type: 'unitQueued'; team: Team; kind: UnitKind }
  | { type: 'notEnoughMoney'; team: Team }
  | { type: 'waveLaunched'; wave: number; counts: [number, number] }
  | { type: 'gameOver'; winner: Team };

export type GameEventType = GameEvent['type'];

// ---------------------------------------------------------------- World

export type GameMode = 'single' | 'versus';

export interface World {
  mode: GameMode;
  level: LevelDef;
  grid: GridData;
  bases: [Base, Base];
  players: [PlayerState, PlayerState];
  towers: Tower[];
  units: Unit[];
  projectiles: Projectile[];
  beams: Beam[];
  rings: Ring[];
  rocks: ThoriumRock[];
  /** Fixed-size pool; reuse inactive slots. */
  particles: Particle[];
  texts: FloatingText[];
  pendingSpawns: PendingSpawn[];
  /** Events emitted this frame; drained by Game (audio/UI) each frame. */
  events: GameEvent[];
  /** Total simulated seconds. */
  time: number;
  /** Seconds until the next wave launches. */
  waveTimer: number;
  waveNumber: number;
  /** Seconds until the next meteor shower. */
  meteorTimer: number;
  /** Screen-shake intensity in pixels (decays). */
  shake: number;
  winner: Team | null;
  nextId: number;
  /** Deterministic RNG for gameplay: returns [0,1). */
  rng: () => number;
}

// ---------------------------------------------------------------- Screens / view

export type ScreenState = 'menu' | 'howto' | 'playing' | 'paused' | 'gameover';

export interface MenuView {
  title: string;
  subtitle: string;
  items: string[];
  selected: number;
  /** Extra lines (e.g. game-over stats). */
  lines: string[];
}

/** Everything the renderer needs beyond the World. */
export interface ViewState {
  screen: ScreenState;
  /** Menu overlay (menu/paused/gameover/howto screens), null while playing. */
  menu: MenuView | null;
  fps: number;
  /** Real (unscaled) seconds since start, for UI animation. */
  realTime: number;
  /** Single-player level being played or highest unlocked (menu). */
  level: number;
  muted: boolean;
  /** Short banner message (e.g. "WAVE 3 LAUNCHED"), with remaining time. */
  banner: { text: string; color: string; time: number } | null;
}

export type SfxName =
  | 'laser'
  | 'cannon'
  | 'cryo'
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
  | 'menuMove'
  | 'menuSelect'
  | 'victory'
  | 'defeat';
