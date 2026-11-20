import { registerIntentHandler, registerSystem, STAGE_ORDER } from '@/sim/core';
import { handleShipIntent, shipSystem } from './ship';
import { handleRockIntent, rocksSystem } from './rocks';
import { meteorSystem } from './meteors';
import { harvestSystem } from './harvest';
import { handleResearchIntent } from './research';
import { shipHealthSystem } from './shipHealth';

export { addThorium, spendThorium, awardBaseKillBonus } from './thorium';
export { handleRockIntent, rocksSystem, releaseRock } from './rocks';
export { applyHealthToken, damageShip, destroyShip, hasShip, shipHealthSystem, shipTargetable } from './shipHealth';
export {
  spawnInitialRocks, spawnMeteor, meteorSystem, setWorldMap, thoriumLevelOf, mapThoriumFactor, meteorInterval,
} from './meteors';
export { handleShipIntent, shipSystem } from './ship';
export { harvestSystem, harvesterRange } from './harvest';
export { hasResearchLab, purchasableResearch, unlockResearch, handleResearchIntent } from './research';
export type { ResearchResult } from './research';
export { ECON } from './tuning';

let registered = false;

/** Idempotent: wires ship, ship health, rock, meteor, harvester and research handling into the sim pipeline. */
export function registerEconomySystems(): void {
  if (!registered) {
    registered = true;
    for (const h of [handleShipIntent, handleRockIntent, handleResearchIntent]) registerIntentHandler(h);
  }
  registerSystem('economy.ship', STAGE_ORDER.rocks - 5, shipSystem);
  registerSystem('economy.rocks', STAGE_ORDER.rocks, rocksSystem);
  registerSystem('economy.meteors', STAGE_ORDER.rocks + 1, meteorSystem);
  registerSystem('economy.harvest', STAGE_ORDER.economy, harvestSystem);
  registerSystem('economy.shipHealth', STAGE_ORDER.projectiles + 5, shipHealthSystem);
}
