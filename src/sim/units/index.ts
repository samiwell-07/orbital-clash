import { registerScout, registerTank, registerDrone, registerTorpedo } from './basic';
import { registerHammer } from './hammer';
import { registerSwitch } from './switch';
import { registerThief } from './thief';
import { registerCarrier } from './carrier';
import { registerSnake, registerDragon } from './bionic';

export { registerScout, registerTank, registerDrone, registerTorpedo } from './basic';
export { registerHammer } from './hammer';
export { registerSwitch } from './switch';
export { registerThief } from './thief';
export { registerCarrier } from './carrier';
export { registerSnake, registerDragon } from './bionic';

/** Registers every unit behaviour / arrival hook with the army module. Idempotent. */
export function registerUnitBehaviors(): void {
  registerScout();
  registerTank();
  registerDrone();
  registerTorpedo();
  registerHammer();
  registerSwitch();
  registerThief();
  registerCarrier();
  registerSnake();
  registerDragon();
}
