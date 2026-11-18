import type { System } from '@/types';
import { registerIntentHandler, registerSystem, STAGE_ORDER } from '@/sim/core';
import { BUILD_SECONDS } from './info';
import { handlePlace } from './place';
import { handleUpgrade } from './upgrade';
import { handleRecycle } from './recycle';
import { handleRepair } from './repair';
import { handleCycleOutput } from './outputs';

/** Construction animation: buildProgress 0 -> 1 over BUILD_SECONDS. */
export const buildSystem: System = (w, dt) => {
  for (const s of w.structures.values()) {
    if (s.buildProgress < 1) s.buildProgress = Math.min(1, s.buildProgress + dt / BUILD_SECONDS);
  }
};

let registered = false;

/** Idempotent: wires the build intent handlers and the construction system into the sim pipeline. */
export function registerBuildSystems(): void {
  if (!registered) {
    registered = true;
    for (const h of [handlePlace, handleUpgrade, handleRecycle, handleRepair, handleCycleOutput]) {
      registerIntentHandler(h);
    }
  }
  registerSystem('build.construction', STAGE_ORDER.build, buildSystem);
}
