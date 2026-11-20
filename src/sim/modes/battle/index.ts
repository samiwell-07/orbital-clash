export { BATTLE_CONFIG, scaleHits, scaleThorium, clampStrength } from './config';
export {
  startBattle, validateBattleSetup, BattleSetupError, FREE_BASE_SUFFIX,
  type BattleSetup, type BattlePlayerSetup, type BattleController,
} from './setup';
export { battleInitSystem, battleBonusSystem, battleClock, awardBonusDirect } from './systems';
export { AdaptiveAI, aiSystem, AI_TUNING } from './ai';
export { battleMapSummaries, BATTLE_MAPS, battleMapById, type BattleMapSummary } from '@/data/battle-maps';
