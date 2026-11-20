import { expect, it } from 'vitest';
import { buildRun, nextAreaCommand } from '@/app/runSpec';
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

it.each([false, true])('launches four players with the chosen campaign difficulty and previewed map (expansion=%s)', (expansion) => {
  const areas = missionSummaries().map(a => ({ ...a, cometId: a.comet }));
  const frames: DeviceFrame[] = (['pad0', 'pad1', 'pad2', 'pad3'] as const).map(id => ({
    id, connected: true, confirm: false, back: false, left: false, right: false, start: false,
  }));
  const ctx: ScreenCtx = { data: { save: newSave(), areas, maps: [] }, devices: () => frames };
  const cometId = expansion ? 'gaia' : 'kreios';
  ctx.data.save.comets[cometId].areas[0] = {
    completions: 1, bestTimeSec: 100, bestRank: 'A', bestScore: 1000, lastDifficulty: 'beginner', coopPlayers: 1,
  };
  const packs = createCampaignPacks();
  const confirm = { ...NO_NAV, confirm: true };
  const down = { ...NO_NAV, down: true };
  const right = { ...NO_NAV, right: true };
  if (expansion) packs.update(right, 0.1, ctx);
  packs.update(down, 0.1, ctx);
  for (let i = 0; i < 3; i++) packs.update(right, 0.1, ctx);
  packs.update(down, 0.1, ctx);
  packs.update(right, 0.1, ctx); // Normal -> Expert, ignoring the area's previous Beginner run.
  packs.update(down, 0.1, ctx);
  const picker = pushed(packs.update(confirm, 0.1, ctx));
  expect(picker.id).toBe(expansion ? 'campaign-expansion' : 'campaign');
  const briefing = pushed(picker.update(confirm, 0.1, ctx));
  briefing.update(right, 0.1, ctx); // Briefing cannot change difficulty.
  const lobby = pushed(briefing.update(confirm, 0.1, ctx));
  for (const f of frames.slice(0, 3)) f.confirm = true;
  lobby.update(NO_NAV, 0.1, ctx);
  lobby.update(NO_NAV, 0.1, ctx);
  for (const f of frames) f.confirm = false;
  expect(lobby.update(NO_NAV, 4, ctx)).toBeNull(); // Wait for the chosen fourth player.
  frames[3].confirm = true;
  lobby.update(NO_NAV, 0.1, ctx);
  lobby.update(NO_NAV, 0.1, ctx);
  frames[3].confirm = false;
  const command = lobby.update(NO_NAV, 3.1, ctx);
  if (command?.t !== 'startCampaign') throw new Error('Campaign lobby did not launch');
  expect(command).toMatchObject({ cometId, index: 0, resurgence: false, difficulty: 'expert' });
  expect(command.seats).toHaveLength(4);
  expect(nextAreaCommand(command, ctx.data.save)).toEqual({ ...command, index: 1 });
  const spec = buildRun(command);
  if (typeof spec === 'string') throw new Error(spec);
  expect(spec.humans).toEqual([0, 2, 3, 4]);
  expect(spec.bindings.map(b => [b.player, b.device])).toEqual([[0, 'pad0'], [2, 'pad1'], [3, 'pad2'], [4, 'pad3']]);
  const first = areas.find(a => a.cometId === cometId && a.index === 0 && !a.resurgence);
  expect(first?.rows.length).toBeGreaterThan(0);
  expect(spec.mission?.map.rows).toEqual(first!.rows);
  expect(spec.options.settings.profile).toBe(expansion ? 'bionic' : 'base');
  expect(createWorld(spec.options).grid.w).toBe(first!.rows.length);
});
