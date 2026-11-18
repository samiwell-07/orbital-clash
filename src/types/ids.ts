// Core identifiers shared by every module. Pure types and const tables, no logic.

export type PlayerId = 0 | 1 | 2 | 3;
export type TeamId = number;
export type EntityId = number;

export const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

/** Four Basic Ops units (manual: Scouts, Tanks, Drones, Torpedoes). */
export type BasicUnitKind = 'scout' | 'tank' | 'drone' | 'torpedo';
/** Four Special Ops units built from the Hammer spawn tower. */
export type SpecialUnitKind = 'hammer' | 'switch' | 'thief' | 'carrier';
/** Bionic Swarm layer: transforming snake/dragon armies (PDF notes). */
export type BionicUnitKind = 'snake' | 'dragon';
export type UnitKind = BasicUnitKind | SpecialUnitKind | BionicUnitKind;

export const BASIC_UNITS: readonly BasicUnitKind[] = ['scout', 'tank', 'drone', 'torpedo'];
export const SPECIAL_UNITS: readonly SpecialUnitKind[] = ['hammer', 'switch', 'thief', 'carrier'];
export const BIONIC_UNITS: readonly BionicUnitKind[] = ['snake', 'dragon'];
export const ALL_UNITS: readonly UnitKind[] = [...BASIC_UNITS, ...SPECIAL_UNITS, ...BIONIC_UNITS];

/** Defensive weapons (manual: Turret, Laser, Pulsar, Bomber). */
export type WeaponKind = 'turret' | 'laser' | 'pulsar' | 'bomber';
export const WEAPONS: readonly WeaponKind[] = ['turret', 'laser', 'pulsar', 'bomber'];

/** Spawn towers: Basic Ops (selectable output), Special Ops (Hammer tower). */
export type SpawnTowerKind = 'basicOps' | 'specialOps';
/** Structures that exist in the Bionic Swarm layer or support the economy. */
export type SupportKind = 'harvester' | 'researchLab' | 'missileSilo' | 'missileDefense' | 'gateway' | 'waypoint';
export type StructureKind = WeaponKind | SpawnTowerKind | SupportKind;

/** Combat layer: ground units path through the maze; air units fly straight. */
export type Layer = 'ground' | 'air';
/** What a weapon may shoot (manual: ground only, air only, or both). */
export type TargetMask = 'ground' | 'air' | 'both';

export type Difficulty = 'beginner' | 'casual' | 'normal' | 'expert';
export type CometId = 'kreios' | 'hathor' | 'aether' | 'helios';
/** Visual palette of a map: the four base comets plus the Bionic Swarm worlds seen in screenshots. */
export type PaletteId = CometId | 'gaia' | 'kronos';
export type GameMode = 'campaign' | 'battle';
/** Rules profile: original game vs Bionic Swarm expansion. */
export type Profile = 'base' | 'bionic';

/** Ship/base colours: blue, red, purple, orange-yellow (seen in screenshots). */
export const PLAYER_COLORS: readonly number[] = [0x3aa0ff, 0xff4a4a, 0xb55cff, 0xffb02e];
