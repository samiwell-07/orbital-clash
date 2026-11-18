import type { Emit, PlayerId, ScriptAction, World } from '@/types';

export interface CompiledEvent {
  /** Declared position in Mission.timeline (before the stable time sort). */
  index: number;
  atSec: number;
  tick: number;
  player: PlayerId;
  action: ScriptAction;
}

/** Per-world campaign bookkeeping. A new World (restart) always starts from a fresh state. */
export interface CampaignState {
  setupDone: boolean;
  compiled: CompiledEvent[] | null;
  errors: string[];
  /** Set by the first mission error; the timeline stops firing afterwards. */
  errored: boolean;
  /** Enemy structures ever placed; destroyed = placed - alive. */
  enemyPlaced: number;
  objectives: { id: string; text: string; atSec: number }[];
  lastHits: number;
  finished: boolean;
  won: boolean;
  finishSec: number;
}

const states = new WeakMap<World, CampaignState>();

export function campaignState(w: World): CampaignState {
  let s = states.get(w);
  if (!s) {
    s = {
      setupDone: false, compiled: null, errors: [], errored: false, enemyPlaced: 0,
      objectives: [], lastHits: 0, finished: false, won: false, finishSec: 0,
    };
    states.set(w, s);
  }
  return s;
}

export function isCampaign(w: World): boolean {
  return w.settings.mode === 'campaign' && w.settings.mission !== null;
}

export function humanIds(w: World): PlayerId[] {
  return w.players.filter((p) => p.controller === 'human').map((p) => p.id);
}

export function scriptIds(w: World): PlayerId[] {
  return w.players.filter((p) => p.controller === 'script').map((p) => p.id);
}

/** Surface a mission error: emitted as missionError and the mission is marked as errored. */
export function failMission(w: World, text: string, emit: Emit): void {
  const st = campaignState(w);
  st.errors.push(text);
  st.errored = true;
  emit({ t: 'missionError', text });
}

export function missionErrors(w: World): readonly string[] {
  return campaignState(w).errors;
}

export function isMissionErrored(w: World): boolean {
  return campaignState(w).errored;
}
