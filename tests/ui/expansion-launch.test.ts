import { expect, it } from 'vitest';
import { buildRun } from '@/app/runSpec';
import { missionSummaries } from '@/data/areas';
import { newSave } from '@/meta/saveSchema';
import { createWorld } from '@/sim/core';
import { createCampaignPacks } from '@/ui/screens/campaignPacks';
import { createCampaignScreen } from '@/ui/screens/campaign';
import { NO_NAV, type ScreenCtx, type ScreenResult } from '@/ui/screens/types';
import type { DeviceFrame } from '@/types';

function pushed(result: ScreenResult) {
  if (result?.t !== 'push') throw new Error('Expected to open the next screen');
  return result.screen;
}

it.each([false, true])('temporarily opens gated Resurgences without changing the save (expansion=%s)', expansion => {
  const ctx: ScreenCtx = { data: { save: newSave(), areas: [], maps: [] } };
  const before = JSON.stringify(ctx.data.save);
  const screen = createCampaignScreen({ expansion });
  screen.update({ ...NO_NAV, down: true }, 0.1, ctx);
  for (let i = 0; i < 7; i++) screen.update({ ...NO_NAV, right: true }, 0.1, ctx);
  const confirm = { ...NO_NAV, confirm: true };
  expect(screen.update(confirm, 0.1, ctx)).toBeNull();
  ctx.data.unlockMaps = true;
  expect(pushed(screen.update(confirm, 0.1, ctx)).id).toBe('briefing');
  expect(JSON.stringify(ctx.data.save)).toBe(before);
});

it('launches Gaia 29 from the expansion picker on a fresh save with its previewed map', () => {
  const areas = missionSummaries().map(a => ({ ...a, cometId: a.comet }));
  const frame: DeviceFrame = { id: 'kb1', connected: true, confirm: false, back: false, left: false, right: false, start: false };
  const ctx: ScreenCtx = { data: { save: newSave(), areas, maps: [] }, devices: () => [frame] };
  const packs = createCampaignPacks();
  const confirm = { ...NO_NAV, confirm: true };
  const down = { ...NO_NAV, down: true };
  packs.update(down, 0.1, ctx);
  const picker = pushed(packs.update(confirm, 0.1, ctx));
  expect(picker.id).toBe('campaign-expansion');
  const briefing = pushed(picker.update(confirm, 0.1, ctx));
  briefing.update(down, 0.1, ctx);
  const lobby = pushed(briefing.update(confirm, 0.1, ctx));
  frame.confirm = true;
  lobby.update(NO_NAV, 0.1, ctx); // Join and ready.
  lobby.update(NO_NAV, 0.1, ctx);
  frame.confirm = false;
  const command = lobby.update(NO_NAV, 3.1, ctx);
  if (command?.t !== 'startCampaign') throw new Error('Expansion lobby did not launch');
  expect(command).toMatchObject({ cometId: 'gaia', index: 0, resurgence: false });
  const spec = buildRun(command);
  if (typeof spec === 'string') throw new Error(spec);
  const first = areas.find(a => a.cometId === 'gaia' && a.number === 29);
  expect(first?.rows.length).toBeGreaterThan(0);
  expect(spec.mission?.map.rows).toEqual(first!.rows);
  expect(spec.options.settings.profile).toBe('bionic');
  expect(createWorld(spec.options).grid.w).toBe(first!.rows.length);
});
