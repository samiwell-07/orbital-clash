import { STAGE_ORDER, registerIntentHandler, registerSystem } from '@/sim/core';
import { weaponSystem } from './weaponSystem';
import { projectileSystem } from './projectiles';
import { handleMissileIntent, siloSystem } from './missiles';

export * from './targeting';
export * from './damage';
export { weaponSystem } from './weaponSystem';
export { projectileSystem } from './projectiles';
export { fireMissiles, handleMissileIntent, siloLoaded, siloSystem } from './missiles';

let handlerRegistered = false;

/** Registers the 'combat', silo reload and 'projectiles' stages plus the missile intent. Idempotent. */
export function registerCombatSystems(): void {
  registerSystem('combat', STAGE_ORDER.combat, weaponSystem);
  registerSystem('combat.silo', STAGE_ORDER.combat + 1, siloSystem);
  registerSystem('projectiles', STAGE_ORDER.projectiles, projectileSystem);
  if (!handlerRegistered) {
    handlerRegistered = true;
    registerIntentHandler(handleMissileIntent);
  }
}
