import type { Difficulty, Objective, System, World } from '@/types';
import { DIFFICULTY_MULT, TICK_DT } from '@/config/constants';
import { campaignState, humanIds, isCampaign, scriptIds } from './state';

export interface ObjectiveProgress {
  id: string;
  text: string;
  type: Objective['type'];
  value: number;
  current: number;
  done: boolean;
}

export interface CampaignResult {
  missionId: string;
  comet: string;
  index: number;
  resurgence: boolean;
  difficulty: Difficulty;
  finished: boolean;
  won: boolean;
  /** Mission errors surfaced during the run (the result is not trustworthy when true). */
  errored: boolean;
  timeSec: number;
  penaltySec: number;
  totalSec: number;
  parTimeSec: number;
  /** Docs rule: total <= par 3 stars, <= 1.5x par 2 stars, else 1. */
  stars: 1 | 2 | 3;
}

function enemyAlive(w: World): number {
  let n = 0;
  for (const s of w.structures.values()) if (w.players[s.owner].controller === 'script') n++;
  return n;
}

function currentValue(w: World, o: Objective): number {
  const humans = humanIds(w).map((id) => w.players[id]);
  switch (o.type) {
    case 'destroyBase':
      return scriptIds(w).every((id) => !w.players[id].alive) ? 1 : 0;
    case 'survive':
      return w.timeSec;
    case 'thorium':
      return humans.reduce((a, p) => a + p.stats.thoriumEarned, 0);
    case 'destroyStructures':
      return Math.max(0, campaignState(w).enemyPlaced - enemyAlive(w));
  }
}

function isDone(w: World, o: Objective): boolean {
  const v = currentValue(w, o);
  return o.type === 'destroyBase' ? v >= 1 : v >= o.value;
}

/** HUD helper: progress of every mission objective. A mission is won as soon as any one is met. */
export function objectiveProgress(w: World): ObjectiveProgress[] {
  const m = w.settings.mission;
  if (!m) return [];
  return m.objectives.map((o) => ({
    id: o.id, text: o.text, type: o.type, value: o.value, current: currentValue(w, o), done: isDone(w, o),
  }));
}

export function campaignResult(w: World): CampaignResult | null {
  const m = w.settings.mission;
  if (!m) return null;
  const st = campaignState(w);
  const timeSec = st.finished ? st.finishSec : w.timeSec;
  const penaltySec = humanIds(w).reduce<number>((a, id) => a + w.players[id].stats.penaltySec, 0);
  const totalSec = timeSec + penaltySec;
  const stars = totalSec <= m.parTimeSec ? 3 : totalSec <= m.parTimeSec * 1.5 ? 2 : 1;
  return {
    missionId: m.id, comet: m.comet, index: m.index, resurgence: m.resurgence, difficulty: w.settings.difficulty,
    finished: st.finished, won: st.won, errored: st.errored, timeSec, penaltySec, totalSec, parTimeSec: m.parTimeSec, stars,
  };
}

/** Time penalties are applied as hits occur (normal/expert only). */
function applyPenalties(w: World): void {
  const humans = humanIds(w);
  if (humans.length === 0) return;
  const st = campaignState(w);
  const hits = humans.reduce<number>((a, id) => a + Math.ceil(w.players[id].hits - 1e-9), 0);
  const delta = hits - st.lastHits;
  if (delta > 0) w.players[humans[0]].stats.penaltySec += delta * DIFFICULTY_MULT[w.settings.difficulty].penaltyPerHit;
  st.lastHits = Math.max(st.lastHits, hits);
}

function endMission(w: World, winnerTeam: number, loserTeam: number, emit: (e: { t: 'victory' | 'defeat'; team: number }) => void): void {
  w.over = true;
  w.winnerTeam = winnerTeam;
  emit({ t: 'victory', team: winnerTeam });
  emit({ t: 'defeat', team: loserTeam });
}

/** Runs after the core victory system: penalties, co-op defeat, alternative objectives, final result. */
export const objectivesSystem: System = (w, _dt, emit) => {
  if (!isCampaign(w)) return;
  const st = campaignState(w);
  const mission = w.settings.mission;
  const humans = humanIds(w);
  if (!mission || humans.length === 0 || st.finished) return;
  applyPenalties(w);
  const humanTeam = w.players[humans[0]].team;
  const enemy = scriptIds(w)[0];
  const enemyTeam = enemy === undefined ? -1 : w.players[enemy].team;
  if (!w.over) {
    if (!w.players[humans[0]].alive) endMission(w, enemyTeam, humanTeam, emit);
    else if (mission.objectives.some((o) => isDone(w, o))) endMission(w, humanTeam, enemyTeam, emit);
  }
  if (w.over) {
    st.finished = true;
    st.won = w.winnerTeam === humanTeam;
    st.finishSec = (w.tick + 1) * TICK_DT;
  }
};
