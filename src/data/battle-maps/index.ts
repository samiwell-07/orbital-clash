import { registerMap } from '@/sim/core/defaultMap';
import { BATTLE_MAPS } from './summaries';

export type { BattleMapSummary } from './summaries';
export { BATTLE_MAPS, battleMapById, battleMapSummaries } from './summaries';

for (const m of BATTLE_MAPS) registerMap(m);
