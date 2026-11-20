import type { Difficulty, Emit, Mission, NewGameOptions, PlayerId, PlayerSlot, UnitKind, World } from '@/types';
import { DEFAULT_HITS, DIFFICULTY_MULT, MAX_COOP_PLAYERS } from '@/config/constants';
import '@/data/areas';
import { seedFor } from '@/data/areas/seeds';
import { placeStructure } from './actions';
import { campaignState, scriptIds } from './state';

export const HUMAN_SLOT_IDS: readonly PlayerId[] = [0, 2, 3];
export const ENEMY_ID: PlayerId = 1;

export interface CampaignParams {
  mission: Mission;
  difficulty: Difficulty;
  /** 1-3 humans (co-op): one team, each with their own base on map.baseTiles[id] (createWorld places them). */
  humanPlayers?: number;
  /** Lobby colour (PLAYER_COLORS index) per human, in HUMAN_SLOT_IDS order. */
  humanColors?: readonly number[];
  seed?: number;
}

/** Enemy strength scales scripted release counts and stored seeds (never below 1). */
export function scaleCount(n: number, difficulty: Difficulty): number {
  return Math.max(1, Math.round(n * DIFFICULTY_MULT[difficulty].enemy));
}

/** NewGameOptions for createSim. Call applyMissionSetup(sim.world) afterwards (the timeline also does it on tick 0). */
export function startCampaign(p: CampaignParams): NewGameOptions {
  const humans = Math.min(MAX_COOP_PLAYERS, Math.max(1, Math.floor(p.humanPlayers ?? 1)));
  const humanSlots = HUMAN_SLOT_IDS.slice(0, humans).map((id, i): PlayerSlot => ({ id, team: 0, controller: 'human', colorIndex: p.humanColors?.[i] }));
  const enemySlot: PlayerSlot = { id: ENEMY_ID, team: 1, controller: 'script' };
  const slots = [...humanSlots, enemySlot].sort((a, b) => a.id - b.id);
  return {
    settings: {
      mode: 'campaign', profile: p.mission.profile, difficulty: p.difficulty, maxHits: DEFAULT_HITS,
      thoriumRate: 1, timeLimitSec: 0, strength: [0.5, 0.5, 0.5, 0.5], mission: p.mission,
      comet: p.mission.comet, seed: p.seed ?? 1,
    },
    slots,
    mapId: p.mission.map.id,
  };
}

/** Seeds the scripted players' stored army, scaled by enemy strength. */
function seedStored(w: World, mission: Mission): void {
  const seed = seedFor(mission.id);
  const m = DIFFICULTY_MULT[w.settings.difficulty].enemy / DIFFICULTY_MULT.expert.enemy;
  for (const id of scriptIds(w)) {
    for (const [kind, n] of Object.entries(seed) as [UnitKind, number][]) {
      w.players[id].stored[kind] = Math.max(1, Math.ceil(n * m));
    }
  }
}

/**
 * Places the mission's preplaced structures and stored-unit seeds. Idempotent per world.
 * Returns explicit errors (bad tile, ...); callers surface them as missionError.
 */
export function applyMissionSetup(w: World, emit?: Emit): string[] {
  const mission = w.settings.mission;
  const st = campaignState(w);
  if (!mission || st.setupDone) return [];
  st.setupDone = true;
  const push: Emit = emit ?? ((e) => { w.events.push(e); });
  const errors: string[] = [];
  for (const s of mission.preplaced) {
    const err = placeStructure(w, s.owner, s, { strict: false }, push);
    if (err) errors.push(`preplaced ${err}`);
  }
  seedStored(w, mission);
  const first = HUMAN_SLOT_IDS.find((id) => w.players[id]?.controller === 'human');
  if (mission.teaches && first !== undefined) push({ t: 'techUnlocked', owner: first, key: mission.teaches });
  return errors;
}
