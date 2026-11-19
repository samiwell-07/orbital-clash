import { describe, expect, it } from 'vitest';
import type { DeviceFrame, DeviceId } from '../../src/types';
import { LobbyState, lobbyDeviceLabel, type LobbyRules } from '../../src/ui/screens/lobbyState';
import { createLobbyScreen } from '../../src/ui/screens/lobby';
import { NO_NAV, type ScreenCtx } from '../../src/ui/screens/types';
import { newSave } from '../../src/meta/saveSchema';

const CAMPAIGN: LobbyRules = { minPlayers: 1, maxPlayers: 3, takenColors: [1] };
const BATTLE2: LobbyRules = { minPlayers: 2, maxPlayers: 2, takenColors: [] };

type Press = Partial<Omit<DeviceFrame, 'id'>>;
const f = (id: DeviceId, p: Press = {}): DeviceFrame => ({
  id, connected: true, confirm: false, back: false, left: false, right: false, start: false, ...p,
});
const confirm = (id: DeviceId): DeviceFrame => f(id, { confirm: true });
const back = (id: DeviceId): DeviceFrame => f(id, { back: true });

function lobby(rules: LobbyRules, ...joiners: DeviceId[]): LobbyState {
  const s = new LobbyState(rules);
  for (const d of joiners) s.update([confirm(d)], 0.016);
  return s;
}

function fakeCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop: () => undefined };
  const props: Record<string | symbol, unknown> = {};
  return new Proxy(props, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('LobbyState', () => {
  it('seats players in press order with default colours skipping taken ones', () => {
    const s = lobby(CAMPAIGN, 'kb2', 'pad1');
    expect(s.seats.map((x) => x.device)).toEqual(['kb2', 'pad1']);
    expect(s.seats.map((x) => x.colorIndex)).toEqual([0, 2]);
    expect(s.toSeats()).toEqual([{ device: 'kb2', colorIndex: 0 }, { device: 'pad1', colorIndex: 2 }]);
  });

  it('cycles colours skipping taken/used ones and wraps', () => {
    const s = lobby(CAMPAIGN, 'pad0', 'pad1');
    s.update([f('pad0', { right: true })], 0.016);
    expect(s.seats[0].colorIndex).toBe(3);
    s.update([f('pad0', { left: true })], 0.016);
    s.update([f('pad0', { left: true })], 0.016);
    expect(s.seats[0].colorIndex).toBe(7);
    s.update([f('pad0', { right: true })], 0.016);
    expect(s.seats[0].colorIndex).toBe(0);
  });

  it('does not exceed max, ignores disconnected joiners, and shifts seats on leave', () => {
    const s = lobby(CAMPAIGN, 'pad0', 'pad1', 'pad2', 'kb1');
    expect(s.seats).toHaveLength(3);
    s.update([f('pad3', { confirm: true, connected: false })], 0.016);
    expect(s.seatOf('pad3')).toBe(-1);
    s.update([back('pad0')], 0.016);
    expect(s.seats.map((x) => x.device)).toEqual(['pad1', 'pad2']);
  });

  it('back: unseated with nobody seated leaves the lobby; ignored otherwise; ready seats un-ready first', () => {
    expect(new LobbyState(CAMPAIGN).update([back('kb1')], 0.016)).toBe('back');
    const s = lobby(CAMPAIGN, 'pad0');
    expect(s.update([back('kb1')], 0.016)).toBe('none');
    s.update([confirm('pad0')], 0.016);
    s.update([f('pad0', { right: true })], 0.016);
    expect(s.seats[0]).toMatchObject({ ready: true, colorIndex: 0 });
    s.update([back('pad0')], 0.016);
    expect(s.seats[0]).toMatchObject({ ready: false, colorIndex: 0 });
  });

  it('a disconnected pad leaves its seat', () => {
    const s = lobby(CAMPAIGN, 'pad0', 'kb1');
    s.update([f('pad0', { connected: false })], 0.016);
    expect(s.seats.map((x) => x.device)).toEqual(['kb1']);
  });

  it('counts down 3 s once all are ready, cancels on join/un-ready, starts once', () => {
    const s = lobby(CAMPAIGN, 'pad0');
    s.update([confirm('pad0')], 0.016);
    expect(s.countdown).toBe(3);
    s.update([], 1);
    expect(s.countdown).toBeCloseTo(2);
    s.update([confirm('pad1')], 0.016);
    expect(s.countdown).toBeNull();
    s.update([confirm('pad1')], 0.016);
    expect(s.countdown).toBe(3);
    s.update([back('pad1')], 0.016);
    expect(s.countdown).toBeNull();
    s.update([confirm('pad1')], 0.016);
    const evs = Array.from({ length: 40 }, () => s.update([], 0.1));
    expect(evs.filter((e) => e === 'start')).toHaveLength(1);
    expect(evs.indexOf('start')).toBe(29);
  });

  it('battle needs exactly the human count ready', () => {
    const s = lobby(BATTLE2, 'pad0', 'pad1');
    s.update([confirm('pad0')], 0.016);
    for (let i = 0; i < 10; i++) expect(s.update([], 1)).toBe('none');
    expect(s.countdown).toBeNull();
  });

  it('identifies seats by (peer, device); dropPeer frees a remote peer; only local back leaves', () => {
    const s = lobby(CAMPAIGN, 'pad0');
    s.update([f('pad0', { confirm: true, peer: 1 })], 0.016);
    expect(s.seats.map((x) => [x.device, x.peer])).toEqual([['pad0', 0], ['pad0', 1]]);
    expect(s.seatOf('pad0', 1)).toBe(1);
    expect(s.toSeats()).toEqual([{ device: 'pad0', colorIndex: 0 }, { device: 'pad0', colorIndex: 2, peer: 1 }]);
    s.update([back('pad0')], 0.016);
    expect(s.update([f('kb1', { back: true, peer: 1 })], 0.016)).toBe('none');
    expect(s.dropPeer(1)).toBe(true);
    expect(s.seats).toHaveLength(0);
  });

  it('labels devices', () => {
    expect(['pad0', 'pad3', 'kb1', 'kb2'].map((d) => lobbyDeviceLabel(d as DeviceId))).toEqual(['Controller 1', 'Controller 4', 'Keyboard (WASD)', 'Keyboard (IJKL)']);
  });
});

describe('lobby screen', () => {
  it('pops on back, returns the onStart command with seats, and draws with a fake ctx', () => {
    let frames: DeviceFrame[] = [back('pad0')];
    const ctx: ScreenCtx = { data: { save: newSave(), areas: [], maps: [] }, devices: () => frames };
    const scr = createLobbyScreen({
      title: 'Join', subtitle: 'Area 1', rules: CAMPAIGN,
      onStart: (seats) => ({ t: 'startCampaign', cometId: 'kreios', index: 0, resurgence: false, difficulty: 'normal', seats }),
    });
    expect(scr.id).toBe('lobby');
    const g = fakeCtx();
    scr.draw(g, { w: 1920, h: 1080 }, 0, ctx);
    expect(scr.update(NO_NAV, 0.016, ctx)).toEqual({ t: 'pop' });
    frames = [confirm('kb1'), confirm('pad2')];
    scr.update(NO_NAV, 0.016, ctx);
    frames = [confirm('kb1'), confirm('pad2')];
    expect(scr.update(NO_NAV, 0.016, ctx)).toBeNull();
    frames = [];
    scr.draw(g, { w: 1440, h: 1080 }, 1.5, ctx);
    scr.draw(g, { w: 1920, h: 1080 }, 1.5, { ...ctx, shipPreview: () => ({}) as CanvasImageSource });
    let out = null;
    for (let i = 0; i < 5 && !out; i++) out = scr.update(NO_NAV, 1, ctx);
    expect(out).toEqual({ t: 'startCampaign', cometId: 'kreios', index: 0, resurgence: false, difficulty: 'normal', seats: [{ device: 'kb1', colorIndex: 0 }, { device: 'pad2', colorIndex: 2 }] });
    expect(scr.state.toSeats()).toEqual([{ device: 'kb1', colorIndex: 0 }, { device: 'pad2', colorIndex: 2 }]);
    // Still on top after emitting start = the shell failed to launch: seats stay, everyone is un-readied.
    expect(scr.update(NO_NAV, 0.016, ctx)).toBeNull();
    expect(scr.state.wasStarted).toBe(false);
    expect(scr.state.seats.map((s) => s.ready)).toEqual([false, false]);
    frames = [back('kb1')];
    scr.update(NO_NAV, 0.016, ctx);
    expect(scr.state.seats.map((s) => s.device)).toEqual(['pad2']);
  });
});
