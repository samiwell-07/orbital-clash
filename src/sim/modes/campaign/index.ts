import { STAGE_ORDER, registerSystem } from '@/sim/core';
import { objectivesSystem } from './objectives';
import { timelineSystem } from './timeline';

export { setReleaseHandler } from './actions';
export type { ReleaseHandler } from './actions';
export { compile } from './timeline';
export type { CompileResult } from './timeline';
export { timelineSystem } from './timeline';
export { applyMissionSetup, startCampaign, scaleCount, ENEMY_ID, HUMAN_SLOT_IDS } from './setup';
export type { CampaignParams } from './setup';
export { objectivesSystem, objectiveProgress, campaignResult } from './objectives';
export type { CampaignResult, ObjectiveProgress } from './objectives';
export { isMissionErrored, missionErrors, campaignState } from './state';

/** Idempotent: registers the campaign systems in the shared pipeline (they ignore non-campaign worlds). */
export function registerCampaignSystems(): void {
  registerSystem('timeline', STAGE_ORDER.timeline, timelineSystem);
  registerSystem('campaign.objectives', STAGE_ORDER.victory + 1, objectivesSystem);
}

registerCampaignSystems();
