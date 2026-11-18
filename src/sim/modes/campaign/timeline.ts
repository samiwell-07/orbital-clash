import type { System } from '@/types';
import { executeAction } from './actions';
import { compile } from './compile';
import { applyMissionSetup } from './setup';
import { campaignState, failMission, isCampaign } from './state';

export { compile } from './compile';
export type { CompileResult } from './compile';

/**
 * Pipeline stage 'timeline'. Fires every compiled event whose tick is due exactly once, in declared
 * order, tracked by world.timelineCursor. Halts after victory/defeat or a surfaced mission error.
 */
export const timelineSystem: System = (w, _dt, emit) => {
  if (!isCampaign(w) || w.over) return;
  const st = campaignState(w);
  if (st.errored) return;
  const mission = w.settings.mission;
  if (!mission) return;
  if (!st.compiled) {
    const result = compile(mission, w.settings.difficulty);
    st.compiled = result.events;
    const setupErrors = applyMissionSetup(w, emit).map((e) => `${mission.id}: ${e}`);
    for (const e of result.errors.length > 0 ? result.errors : setupErrors) failMission(w, e, emit);
    if (st.errored) return;
  }
  const events = st.compiled;
  while (w.timelineCursor < events.length && events[w.timelineCursor].tick <= w.tick) {
    const e = events[w.timelineCursor++];
    const err = executeAction(w, e.player, e.action, { dry: false }, emit);
    if (err) {
      failMission(w, `${mission.id}: event #${e.index} @${e.atSec}s: ${err}`, emit);
      return;
    }
    if (w.over) return;
  }
};
