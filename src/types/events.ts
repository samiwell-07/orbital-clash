import type { PlayerId, UnitKind, StructureKind, EntityId } from './ids';

/** Events emitted by the simulation; consumed by render fx, audio, HUD, trophies. Never read back by sim. */
export type SimEvent =
  | { t: 'structureBuilt'; id: EntityId; kind: StructureKind; owner: PlayerId; tx: number; ty: number }
  | { t: 'structureUpgraded'; id: EntityId; level: number }
  | { t: 'structureRecycled'; id: EntityId; refund: number; owner: PlayerId }
  | { t: 'structureRepaired'; id: EntityId; cost: number }
  | { t: 'structureDestroyed'; id: EntityId; kind: StructureKind; owner: PlayerId; x: number; y: number }
  | { t: 'structureHit'; id: EntityId; x: number; y: number }
  | { t: 'unitSpawned'; owner: PlayerId; kind: UnitKind; fromId: EntityId }
  | { t: 'unitLaunched'; owner: PlayerId; kind: UnitKind; count: number }
  | { t: 'unitDied'; id: EntityId; kind: UnitKind; owner: PlayerId; x: number; y: number; killer: PlayerId | -1 }
  | { t: 'shot'; from: EntityId; kind: StructureKind; x: number; y: number; tx: number; ty: number }
  | { t: 'beam'; owner: PlayerId; x: number; y: number; tx: number; ty: number }
  | { t: 'explosion'; x: number; y: number; radius: number; big: boolean }
  | { t: 'rockSpawned'; id: EntityId; x: number; y: number }
  | { t: 'rockGrabbed'; id: EntityId; owner: PlayerId }
  | { t: 'rockSmashed'; id: EntityId; x: number; y: number; thorium: number; owner: PlayerId }
  | { t: 'thorium'; owner: PlayerId; amount: number }
  | { t: 'baseBuilt'; owner: PlayerId; tx: number; ty: number }
  | { t: 'baseHit'; target: PlayerId; attacker: PlayerId; hitsLeft: number }
  | { t: 'baseDestroyed'; target: PlayerId; attacker: PlayerId | -1 }
  | { t: 'attackLocked'; owner: PlayerId; locked: boolean }
  | { t: 'techUnlocked'; owner: PlayerId; key: string }
  | { t: 'message'; text: string; owner: PlayerId | -1 }
  | { t: 'missionError'; text: string }
  | { t: 'victory'; team: number }
  | { t: 'defeat'; team: number }
  | { t: 'timeUp' }
  | { t: 'denied'; owner: PlayerId; reason: string };
