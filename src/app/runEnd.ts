import type { SimEvent, World, PlayerId } from '@/types';
import { PLAYER_COLORS } from '@/types';
import { campaignResult } from '@/sim/modes/campaign';
import {
  applyTrophyEvent, boardKey, computeRank, computeScore, drainTrophyNotifications, qualifies, recordAreaComplete,
  submitScore, saveSave, type SaveData,
} from '@/meta';
import type { ResultsProps } from '@/ui';
import type { Session } from './session';
import { rangeAt } from './session';
import type { TerrainLayer } from '@/render/terrain';

const TROPHY_EVENTS = new Set<SimEvent['t']>(['unitLaunched', 'structureBuilt', 'baseHit', 'baseDestroyed', 'rockSmashed']);

/** Feeds the few sim events trophies care about into the save (filtered: thousands of events fire per second). */
export function feedTrophies(save: SaveData, events: readonly SimEvent[], now: number): SaveData {
  let s = save;
  for (const e of events) if (TROPHY_EVENTS.has(e.t)) s = applyTrophyEvent(s, e, now).save;
  return s;
}

export function updateCursors(terrain: TerrainLayer | undefined, session: Session): void {
  if (!terrain) return;
  const w = session.sim.world;
  terrain.setCursors(
    session.spec.humans.map((id: PlayerId) => {
      const sh = w.players[id].ship;
      return { tx: sh.cursorTx, ty: sh.cursorTy, color: PLAYER_COLORS[id], range: rangeAt(w, sh.cursorTx, sh.cursorTy) };
    }),
  );
}

export interface Finish {
  save: SaveData;
  props: ResultsProps;
}

/** Turns a finished world into the results screen props and updates the save (progress, trophies). */
export function finishRun(session: Session, save: SaveData): Finish {
  const w: World = session.sim.world;
  const { spec } = session;
  const humanTeam = w.players[spec.humans[0] ?? 0].team;

  if (spec.kind === 'battle') {
    const won = w.winnerTeam === humanTeam;
    let next = applyTrophyEvent(save, { t: 'battleEnd', won, players: w.players.filter((p) => p.controller !== 'none').length }).save;
    next = { ...next, trophies: drainTrophyNotifications(next.trophies).progress };
    return { save: next, props: { mode: 'battle', won, title: won ? 'Victory' : 'Defeat', timeSec: w.timeSec, penaltySec: 0 } };
  }

  const res = campaignResult(w);
  const mission = spec.mission;
  if (!res || !mission) return { save, props: { mode: 'campaign', won: false, title: spec.title, timeSec: w.timeSec, penaltySec: 0 } };
  const base: ResultsProps = {
    mode: 'campaign', won: res.won, title: spec.title, timeSec: res.timeSec, penaltySec: res.penaltySec,
    parTimeSec: res.parTimeSec, difficulty: res.difficulty,
  };
  if (!res.won) return { save, props: base };

  const score = computeScore(res.timeSec, res.penaltySec, res.parTimeSec, res.difficulty);
  const rec = recordAreaComplete(save, {
    cometId: mission.comet, index: mission.index, difficulty: res.difficulty, timeSec: res.timeSec,
    penaltySec: res.penaltySec, score, parTimeSec: res.parTimeSec, resurgence: mission.resurgence,
    coopPlayers: spec.humans.length,
  });
  const key = boardKey(mission.comet, mission.index, res.difficulty, mission.resurgence);
  const drained = drainTrophyNotifications(rec.save.trophies);
  const names = drained.notifications.map((t) => t.name);
  return {
    save: { ...rec.save, trophies: drained.progress },
    props: {
      ...base, rank: computeRank(res.timeSec, res.penaltySec, res.parTimeSec, res.difficulty), score, boardKey: key,
      qualifies: qualifies(rec.save.leaderboards, key, score), trophyNames: names,
      hasNext: !mission.resurgence && mission.index < 6, newBestTime: rec.newBestTime,
    },
  };
}

export function submitToBoard(save: SaveData, key: string, name: string, score: number, timeSec: number): SaveData {
  const boards = { ...save.leaderboards };
  submitScore(boards, key, name, score, timeSec);
  const next = { ...save, leaderboards: boards };
  saveSave(next);
  return next;
}
