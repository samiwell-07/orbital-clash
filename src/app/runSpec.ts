import type { NewGameOptions, Difficulty, Mission, Profile, PlayerId } from '@/types';
import { getMission } from '@/data/areas';
import { startCampaign, HUMAN_SLOT_IDS } from '@/sim/modes/campaign';
import { startBattle } from '@/sim/modes/battle';
import type { BattleConfig, Command } from '@/ui';

export type StartCommand = Extract<Command, { t: 'startCampaign' | 'startBattle' }>;

/** What a running session needs to remember beyond the simulation itself. */
export interface RunSpec {
  kind: 'campaign' | 'battle';
  options: NewGameOptions;
  humans: PlayerId[];
  difficulty: Difficulty;
  mission: Mission | null;
  title: string;
  command: StartCommand;
}

function battleSlots(cfg: BattleConfig) {
  return cfg.slots.map((s, i) => ({
    id: i as PlayerId,
    team: s.team,
    controller: s.human ? ('human' as const) : ('adaptive' as const),
    strength: s.strength,
  }));
}

export function buildRun(cmd: StartCommand, difficulty: Difficulty = 'normal'): RunSpec | string {
  if (cmd.t === 'startCampaign') {
    const mission = getMission(cmd.cometId, cmd.index, cmd.resurgence);
    if (!mission) return `Unknown area ${cmd.cometId} ${cmd.index}`;
    const coop = Math.min(3, Math.max(1, cmd.coop));
    const options = startCampaign({ mission, difficulty: cmd.difficulty, humanPlayers: coop, seed: 1000 + mission.index });
    return {
      kind: 'campaign', options, humans: HUMAN_SLOT_IDS.slice(0, coop) as PlayerId[], difficulty: cmd.difficulty,
      mission, title: mission.name, command: cmd,
    };
  }
  const cfg = cmd.setup;
  const players = battleSlots(cfg);
  try {
    const options = startBattle({
      players, mapId: cfg.mapId, maxHits: cfg.maxHits, thoriumRate: cfg.thoriumRate,
      timeLimitSec: cfg.timeLimitSec, difficulty, seed: (Date.now() & 0xffff) + 1,
    });
    options.settings.profile = cfg.profile as Profile;
    return {
      kind: 'battle', options, humans: players.filter((p) => p.controller === 'human').map((p) => p.id), difficulty,
      mission: null, title: 'Battle', command: cmd,
    };
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
