import { STAGE_ORDER, registerSystem } from '@/sim/core';
import { weaponSystem } from './weaponSystem';
import { projectileSystem } from './projectiles';

export * from './targeting';
export * from './damage';
export { weaponSystem } from './weaponSystem';
export { projectileSystem } from './projectiles';
export { hitRock } from './rocks';

/** Registers the 'combat' and 'projectiles' pipeline stages. Idempotent (systems are replaced by name). */
export function registerCombatSystems(): void {
  registerSystem('combat', STAGE_ORDER.combat, weaponSystem);
  registerSystem('projectiles', STAGE_ORDER.projectiles, projectileSystem);
}
