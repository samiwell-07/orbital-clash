import type { NewGameOptions, Difficulty, DeviceId, Mission, Profile, PlayerId, Seat } from '@/types';
import { getMission } from '@/data/areas';
import { startCampaign, HUMAN_SLOT_IDS } from '@/sim/modes/campaign';
import { startBattle } from '@/sim/modes/battle';
import { AREAS_PER_COMET, EXPANSION_ORDER, isCometUnlocked, type SaveData } from '@/meta';
import type { BattleConfig, Command } from '@/ui';

export type StartCommand = Extract<Command, { t: 'startCampaign' | 'startBattle' }>;

/** Continue a numbered run with the same seats/difficulty. Resurgence is a separate replay. */
export function nextAreaCommand(cmd: StartCommand, save: SaveData): StartCommand | null {
  if (cmd.t !== 'startCampaign' || cmd.resurgence) return null;
  if (cmd.index < AREAS_PER_COMET - 1) return { ...cmd, index: cmd.index + 1 };
  const packIndex = EXPANSION_ORDER.indexOf(cmd.cometId);
  const next = packIndex < 0 ? undefined : EXPANSION_ORDER[packIndex + 1];
  return next && isCometUnlocked(save, next) ? { ...cmd, cometId: next, index: 0 } : null;
}

/** What a running session needs to remember beyond the simulation itself. */
export interface RunSpec {
  kind: 'campaign' | 'battle';
  options: NewGameOptions;
  humans: PlayerId[];
  /** Lobby device per human player; empty = legacy routing (pad index = player id, keyboards in order). Online: `peer` owns it. */
  bindings: { player: PlayerId; device: DeviceId; peer: number }[];
  difficulty: Difficulty;
  mission: Mission | null;
  title: string;
  command: StartCommand;
}

function battleSlots(cfg: BattleConfig, seats: readonly Seat[]) {
  let human = 0;
  return cfg.slots.map((s, i) => ({
    id: i as PlayerId,
    team: s.team,
    controller: s.human ? ('human' as const) : ('adaptive' as const),
    strength: s.strength,
    colorIndex: s.human ? seats[human++]?.colorIndex : undefined,
  }));
}

const bind = (humans: readonly PlayerId[], seats: readonly Seat[]) =>
  seats.length >= humans.length ? humans.map((player, i) => ({ player, device: seats[i].device, peer: seats[i].peer ?? 0 })) : [];

/** `seed` overrides the battle's random seed (online: every peer must use the host's). */
export function buildRun(cmd: StartCommand, difficulty: Difficulty = 'normal', seed?: number): RunSpec | string {
  if (cmd.t === 'startCampaign') {
    const mission = getMission(cmd.cometId, cmd.index, cmd.resurgence);
    if (!mission) return `Unknown area ${cmd.cometId} ${cmd.index}`;
    const coop = Math.min(3, Math.max(1, cmd.seats.length));
    const options = startCampaign({
      mission, difficulty: cmd.difficulty, humanPlayers: coop, humanColors: cmd.seats.map((s) => s.colorIndex), seed: 1000 + mission.index,
    });
    const humans = HUMAN_SLOT_IDS.slice(0, coop) as PlayerId[];
    return {
      kind: 'campaign', options, humans, bindings: bind(humans, cmd.seats), difficulty: cmd.difficulty,
      mission, title: mission.name, command: cmd,
    };
  }
  const cfg = cmd.setup;
  const players = battleSlots(cfg, cmd.seats);
  try {
    const options = startBattle({
      players, mapId: cfg.mapId, maxHits: cfg.maxHits, thoriumRate: cfg.thoriumRate,
      timeLimitSec: cfg.timeLimitSec, difficulty, seed: seed ?? (Date.now() & 0xffff) + 1,
    });
    options.settings.profile = cfg.profile as Profile;
    const humans = players.filter((p) => p.controller === 'human').map((p) => p.id);
    return {
      kind: 'battle', options, humans, bindings: bind(humans, cmd.seats), difficulty,
      mission: null, title: 'Battle', command: cmd,
    };
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
