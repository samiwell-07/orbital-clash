import type { CometId, PlayerId, StructureKind, UnitKind, Difficulty, Profile } from './ids';

/** Authored map: terrain mask plus pre-placed rocks, base slots and enemy layout. */
export interface MapDef {
  id: string;
  name: string;
  w: number;
  h: number;
  /** One string per row, w chars: '.' floor, '#' cliff/rock, 'o' crater. */
  rows: readonly string[];
  /** Start tile per player slot (null = chosen by player in Battle). */
  baseTiles: readonly ({ tx: number; ty: number } | null)[];
  /** Thorium abundance 1..3 (symbols shown under the Battle map). */
  thoriumLevel: 1 | 2 | 3;
  /** Initial drifting rock count and spawn edge hints. */
  rockCount: number;
  palette: CometId;
}

export interface PrePlacedStructure {
  kind: StructureKind;
  tx: number;
  ty: number;
  level: number;
  output?: UnitKind;
}

/** Scripted enemy actions. Validated at mission load; failures surface as missionError. */
export type ScriptAction =
  | { a: 'build'; kind: StructureKind; tx: number; ty: number; level?: number; output?: UnitKind }
  | { a: 'upgrade'; tx: number; ty: number }
  | { a: 'setOutput'; tx: number; ty: number; output: UnitKind }
  | { a: 'release'; kind: UnitKind | 'all'; count: number | 'all' }
  | { a: 'grantThorium'; amount: number }
  | { a: 'unlock'; key: string }
  | { a: 'message'; text: string }
  | { a: 'objective'; id: string; text: string };

export interface TimelineEvent {
  /** Seconds since mission start; converted to ticks once at load. */
  atSec: number;
  player: PlayerId;
  action: ScriptAction;
}

export interface Objective {
  id: string;
  text: string;
  type: 'destroyBase' | 'survive' | 'destroyStructures' | 'thorium';
  value: number;
}

/** One campaign area (e.g. Kreios 1). */
export interface Mission {
  id: string;
  comet: CometId;
  index: number;
  name: string;
  profile: Profile;
  map: MapDef;
  startThorium: number;
  /** Tech keys unlocked at start for the human players. */
  unlocked: readonly string[];
  /** Tech key this area newly teaches (shown in briefing). */
  teaches: string | null;
  preplaced: readonly (PrePlacedStructure & { owner: PlayerId })[];
  timeline: readonly TimelineEvent[];
  objectives: readonly Objective[];
  parTimeSec: number;
  resurgence: boolean;
  /** Hint strings ("no hints" in Resurgence areas). */
  hints: readonly string[];
  /** Max hits the enemy base can take, by difficulty. */
  enemyHits: Readonly<Record<Difficulty, number>>;
}
