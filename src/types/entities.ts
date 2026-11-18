import type { EntityId, PlayerId, StructureKind, UnitKind, Layer } from './ids';

/** All positions are in TILE units (1 tile = 1.0). x grows right, y grows down (top-down map). */
export interface Vec2 {
  x: number;
  y: number;
}

export interface Structure {
  id: EntityId;
  kind: StructureKind;
  owner: PlayerId;
  tx: number;
  ty: number;
  /** 0-based upgrade level; corner marks shown = level; maxLevel => platform grows. */
  level: number;
  hp: number;
  maxHp: number;
  /** Seconds until next shot / unit spawn. */
  cooldown: number;
  targetId: EntityId | 0;
  /** Spawn towers only: the unit type this tower currently produces. */
  output: UnitKind | null;
  /** Special effect timers (e.g. stun, buildAnim). */
  buildProgress: number;
  /** Scripted campaign flag: structure belongs to the scripted enemy. */
  scripted: boolean;
}

export type UnitState = 'marching' | 'attacking' | 'dead';

export interface Unit {
  id: EntityId;
  kind: UnitKind;
  owner: PlayerId;
  /** Player whose base this unit is attacking. */
  targetPlayer: PlayerId;
  x: number;
  y: number;
  /** Height above ground (air units, hopping animation), for rendering. */
  z: number;
  heading: number;
  hp: number;
  maxHp: number;
  layer: Layer;
  state: UnitState;
  /** Index in the launched train: 0 = head. Used for snake-style marching. */
  trainIndex: number;
  /** Distance travelled along the route (tiles), used for ordered snake motion. */
  travelled: number;
  /** Per-kind scratch: carrier cargo count, thief loot, switch timer, etc. */
  aux: number;
}

export interface Projectile {
  id: EntityId;
  owner: PlayerId;
  kind: 'bullet' | 'pulse' | 'bomb' | 'torpedo' | 'missile';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  damage: number;
  splash: number;
  targetId: EntityId | 0;
  life: number;
  layerMask: 'ground' | 'air' | 'both';
}

export type RockState = 'drifting' | 'grabbed' | 'landed' | 'smashed';

export interface Rock {
  id: EntityId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: 1 | 2 | 3;
  thorium: number;
  state: RockState;
  /** Player whose ship holds this rock, else 0 sentinel via carriedBy = -1. */
  carriedBy: PlayerId | -1;
  spin: number;
}

export interface Ship {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Tile under the ship, the build/upgrade cursor. */
  cursorTx: number;
  cursorTy: number;
  carrying: EntityId | 0;
}
