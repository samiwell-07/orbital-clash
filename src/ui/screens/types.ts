import type { CometId, Difficulty, PaletteId, Profile } from '../../types';
import type { SaveData } from '../../meta/saveSchema';
import type { Settings } from '../../meta/settings';
import type { Ctx } from '../theme';

/** Campaign area as shown on the map and in the briefing. Provided by the campaign data (screens never import sim code). */
export interface AreaSummary {
  cometId: CometId;
  /** 0-based index within the comet (0..6). Resurgence maps use their own 0-based index. */
  index: number;
  resurgence: boolean;
  name: string;
  /** Overall area number (1..28); optional, derived from comet order when absent. */
  number?: number;
  /** Research key this area newly teaches (e.g. 'tank'), if any. */
  teaches: string | null;
  objectives: readonly string[];
  parTimeSec: number;
  /** Short flavour/briefing paragraph. */
  briefing?: string;
}

/** Battle map entry for the picker. `rows` (optional) draws a mini terrain preview ('#' cliff, 'o' crater, '.' floor). */
export interface BattleMapSummary {
  id: string;
  name: string;
  /** Thorium abundance symbols 1..3. */
  thoriumLevel: 1 | 2 | 3;
  palette: PaletteId;
  maxPlayers: number;
  rows?: readonly string[];
}

export interface BattleSlotConfig {
  human: boolean;
  /** Same team number = allied. 0..3. */
  team: number;
  /** 0.1..1 strength (scales max hits and start thorium). */
  strength: number;
}

/** Everything a Battle needs. `slots.length` is the player count (2-4); slot i is PlayerId i. */
export interface BattleConfig {
  mapId: string;
  slots: BattleSlotConfig[];
  maxHits: number;
  thoriumRate: number;
  /** 0 = untimed. */
  timeLimitSec: number;
  profile: Profile;
}

export interface ResultsProps {
  mode: 'campaign' | 'battle';
  won: boolean;
  /** Title names a winner (or a draw) rather than Victory/Defeat for the viewer; drawn in a neutral color. */
  neutral?: boolean;
  title: string;
  timeSec: number;
  penaltySec: number;
  parTimeSec?: number;
  score?: number;
  rank?: string;
  difficulty?: Difficulty;
  /** Leaderboard board key; with `qualifies` the screen asks for a name. */
  boardKey?: string;
  qualifies?: boolean;
  trophyNames?: readonly string[];
  hasNext?: boolean;
  newBestTime?: boolean;
}

/** Commands the shell consumes. Everything the UI wants done outside itself. */
export type Command =
  | { t: 'startCampaign'; cometId: CometId; index: number; resurgence: boolean; difficulty: Difficulty; coop: number }
  | { t: 'startBattle'; setup: BattleConfig }
  | { t: 'resume' }
  | { t: 'restart' }
  | { t: 'nextArea' }
  | { t: 'quitToTitle' }
  | { t: 'quit' }
  | { t: 'settingsChanged'; settings: Settings }
  | { t: 'submitScore'; boardKey: string; name: string; score: number; timeSec: number };

export interface UiNav {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  confirm: boolean;
  back: boolean;
}

/** Data the shell keeps fresh; screens read it each frame. */
export interface UiData {
  save: SaveData;
  areas: readonly AreaSummary[];
  maps: readonly BattleMapSummary[];
}

export interface ScreenCtx {
  data: UiData;
}

/** Screens draw in design space (1920x1080 for 16:9, 1440x1080 for 4:3) over an already painted backdrop. */
export interface Screen {
  readonly id: string;
  update(nav: UiNav, dt: number, ctx: ScreenCtx): ScreenResult;
  draw(g: Ctx, size: { w: number; h: number }, nowSec: number, ctx: ScreenCtx): void;
}

export type ScreenResult =
  | Command
  | { t: 'push'; screen: Screen }
  | { t: 'replace'; screen: Screen }
  | { t: 'pop' }
  | { t: 'popAll' }
  | null;

export const NO_NAV: UiNav = { up: false, down: false, left: false, right: false, confirm: false, back: false };
