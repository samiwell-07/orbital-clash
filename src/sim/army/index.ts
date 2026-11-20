import { registerIntentHandler, registerSystem, STAGE_ORDER } from '@/sim/core';
import { handleAttackIntent } from './attackIntents';
import { launchSystem } from './launch';
import { marchSystem } from './march';
import { productionSystem } from './production';

export * from './constants';
export * from './hooks';
export * from './storage';
export * from './production';
export * from './launch';
export * from './march';
export * from './attackIntents';
export { chewFor } from './chew';
export { spacingFor } from './train';

let registered = false;

/** Registers production, launch, movement and the attack-menu intent handler. Safe to call repeatedly. */
export function registerArmySystems(): void {
  if (registered) return;
  registered = true;
  registerSystem('army.production', STAGE_ORDER.production, productionSystem);
  registerSystem('army.launch', STAGE_ORDER.launch, launchSystem);
  registerSystem('army.march', STAGE_ORDER.movement, marchSystem);
  registerIntentHandler(handleAttackIntent);
}
