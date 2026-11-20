// Global constants. Gameplay tuning for individual units/weapons lives in src/data.

export const TICK_HZ = 60;
export const TICK_DT = 1 / TICK_HZ;
export const MAX_STEPS_PER_FRAME = 5;

/** Map size in tiles (campaign and battle plateaus fit within these). */
export const MAP_H = 30;
export const MAP_W = MAP_H;

/** Manual: a base can hold up to 1000 units. */
export const STORAGE_CAP = 1000;
export const MAX_PLAYERS = 4;
export const MAX_COOP_PLAYERS = 4;

/** Manual: 1 to 100 hits before a base falls. */
export const MIN_HITS = 1;
export const MAX_HITS = 100;
export const DEFAULT_HITS = 10;

/** Timed battle: when the clock reaches 0 spawning runs at 8x. */
export const OVERTIME_SPAWN_MULT = 8;

/** Ship cursor physics. tiles/sec. */
export const SHIP_ACCEL = 40;
export const SHIP_MAX_SPEED = 11;
export const SHIP_DRAG = 6;

/** Ship health: starts at 25, +10 max per health token (cap 100), -20 max per death (floor 25). */
export const SHIP_HP_START = 25;
export const SHIP_HP_PER_TOKEN = 10;
export const SHIP_HP_CAP = 100;
export const SHIP_DEATH_PENALTY = 20;
export const SHIP_RESPAWN_S = 1.5;
/** Seconds for a full (SHIP_HP_CAP) heal while hovering over the own base. */
export const SHIP_FULL_HEAL_S = 8;
/** Max distance (tiles) from the base centre that still counts as over the base. */
export const SHIP_HEAL_RADIUS = 0.6;
/** Weapon damage multiplier against ships (ships fly on the air layer). */
export const SHIP_DAMAGE_MULT = 0.4;
/** Hit radius of a ship for homing shots (tiles). */
export const SHIP_HIT_RADIUS = 0.35;
/** Chance a fully harvested rock also drops a health token, by rock size. */
export const HEALTH_TOKEN_CHANCE: Readonly<Record<1 | 2 | 3, number>> = { 1: 0.1, 2: 0.35, 3: 0.8 };

/** Attack-menu pips: white = 1, blue = 10, red = 100 units. */
export const PIP_VALUES = [1, 10, 100] as const;

/** Recycle refund fraction at full health; scales with hp ratio. */
export const RECYCLE_FULL = 0.7;
/** Repair cost fraction of build cost at 0 hp. */
export const REPAIR_FULL = 0.5;

/** Difficulty multipliers applied to scripted enemy hits and start thorium. */
export const DIFFICULTY_MULT = {
  beginner: { enemy: 0.6, thorium: 1.5, penaltyPerHit: 0 },
  casual: { enemy: 0.8, thorium: 1.2, penaltyPerHit: 0 },
  normal: { enemy: 1.0, thorium: 1.0, penaltyPerHit: 5 },
  expert: { enemy: 1.4, thorium: 0.8, penaltyPerHit: 10 },
} as const;

export const SAVE_KEY = 'orbital-clash.save.v1';
