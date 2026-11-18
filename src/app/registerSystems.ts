import { registerBuildSystems } from '@/sim/build';
import { registerEconomySystems } from '@/sim/economy';
import { registerArmySystems, addStored, launchBatch } from '@/sim/army';
import { registerCombatSystems } from '@/sim/combat';
import { registerUnitBehaviors } from '@/sim/units';
import { registerCampaignSystems, setReleaseHandler } from '@/sim/modes/campaign';
import '@/sim/modes/battle';
import '@/data/areas';
import '@/data/battle-maps';

let done = false;

/** Registers every simulation system exactly once and binds the campaign release hook to the army launcher. */
export function registerAllSystems(): void {
  if (done) return;
  done = true;
  registerBuildSystems();
  registerEconomySystems();
  registerArmySystems();
  registerCombatSystems();
  registerUnitBehaviors();
  registerCampaignSystems();
  // The campaign script drains stored counts before calling us, so put them back and launch as one train.
  setReleaseHandler((w, owner, kind, count, emit) => {
    addStored(w, owner, kind, count);
    launchBatch(w, owner, kind, count, emit);
  });
}
