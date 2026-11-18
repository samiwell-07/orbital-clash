// Combat tuning (projectile speeds, fuses). Weapon stats themselves live in src/data/weapons.ts.

export const BULLET_SPEED = 16;
export const PULSE_SPEED = 10;
export const BOMB_SPEED = 12;
/** Proximity fuse for homing splash shots (tiles). */
export const SHOT_FUSE = 0.4;
/** Extra seconds a shot may live beyond its straight-line flight time. */
export const SHOT_SLACK = 0.5;
/** Missiles / torpedo projectiles detonate this close to an enemy structure or base (tiles). */
export const IMPACT_FUSE = 0.6;
export const MISSILE_BASE_HITS = 3;
export const TORPEDO_BASE_HITS = 2;
/** Radius used to hit drifting rocks (tiles) = ROCK_RADIUS_BASE + size * ROCK_RADIUS_PER_SIZE. */
export const ROCK_RADIUS_BASE = 0.3;
export const ROCK_RADIUS_PER_SIZE = 0.2;
