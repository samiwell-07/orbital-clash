// Army tuning (release rate, train spacing, structure chewing). Unit stats stay in src/data.

/** Units released from a base per second while an attack is selected or locked. */
export const RELEASE_RATE = 12;

/** Arc-length between recorded path points of a train. */
export const TRAIN_STEP = 0.1;
/** Fixed gap between consecutive train members = max(MIN_SPACING, radius * SPACING_PER_RADIUS). */
export const SPACING_PER_RADIUS = 1.6;
export const MIN_SPACING = 0.3;

/** A unit within this distance of the target base centre (or inside its tile) has arrived. */
export const ARRIVE_RADIUS = 0.6;
/** Rendered height of flying units. */
export const AIR_HEIGHT = 1;

/** Blocked ground units hit the structure they chew at this rate (hits/s x structureDamage). */
export const CHEW_HITS_PER_SEC = 2;
/** Tile-centre distance within which a unit damages the chewed structure. */
export const CHEW_RANGE = 1.8;

/** Output of a Basic Ops tower whose `output` has not been chosen yet. */
export const DEFAULT_BASIC_OUTPUT = 'scout';
