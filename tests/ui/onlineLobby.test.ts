import { describe, expect, it, vi } from 'vitest';
import type { DeviceFrame, DeviceId } from '../../src/types';
import type { GameMsg, LobbyView } from '../../src/net/protocol';
import type { NetEvent, NetHooks, NetRole, NetRoom, NetStatus } from '../../src/net/types';
import { createLobbyScreen } from '../../src/ui/screens/lobby';
import { createJoinOnlineScreen, NEEDS_DEV_SERVER } from '../../src/ui/screens/joinOnline';
import { createMultiplayerScreen } from '../../src/ui/screens/multiplayer';
import { createTitleScreen } from '../../src/ui/screens/title';
import { createBriefingScreen } from '../../src/ui/screens/briefing';
import { placeholderArea } from '../../src/ui/screens/campaignNav';
import { createRemoteLobbyScreen, HOST_CLOSED_TEXT } from '../../src/ui/screens/remoteLobby';
import { NO_NAV, type Screen, type ScreenCtx, type UiNav } from '../../src/ui/screens/types';
import { newSave } from '../../src/meta/saveSchema';

class FakeRoom implements NetRoom {
  status: NetStatus = 'open';
  code: string | null = '4821';
  peers: number[];
  urls = ['http://192.168.1.20:5173/'];
  error: string | null = null;
  sent: { data: GameMsg; to?: number }[] = [];
  private fns = new Set<(e: NetEvent) => void>();
  constructor(readonly role: NetRole, public me: number) {
    this.peers = me > 0 ? [0, me] : [0];
  }
  send(data: GameMsg, to?: number): void {
    this.sent.push({ data, to });
  }
  listen(fn: (e: NetEvent) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }
  close(): void {
    this.status = 'closed';
  }
  emit(e: NetEvent): void {
    for (const fn of [...this.fns]) fn(e);
  }
  get listeners(): number {
    return this.fns.size;
  }
}

const f = (id: DeviceId, p: Partial<DeviceFrame> = {}): DeviceFrame => ({
  id, connected: true, confirm: false, back: false, left: false, right: false, start: false, ...p,
});

function setup(room: FakeRoom | null = null) {
  const net = {
    current: room,
    room: () => net.current,
    host: vi.fn(() => { net.current = new FakeRoom('host', 0); }),
    join: vi.fn(() => { net.current = new FakeRoom('client', -1); net.current.status = 'connecting'; }),
    leave: vi.fn(() => { net.current = null; }),
  };
  let frames: DeviceFrame[] = [];
  let typed = '';
  const texts: string[] = [];
  const g = new Proxy({} as Record<string | symbol, unknown>, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
      if (k === 'fillText') return (s: string) => { texts.push(s); };
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      return () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  const ctx: ScreenCtx = {
    data: { save: newSave(), areas: [], maps: [] },
    devices: () => frames,
    net: net as NetHooks,
    text: () => typed,
  };
  const step = (scr: Screen, fr: DeviceFrame[] = [], nav: Partial<UiNav> = {}, text = '', dt = 0.016) => {
    frames = fr;
    typed = text;
    return scr.update({ ...NO_NAV, ...nav }, dt, ctx);
  };
  const draw = (scr: Screen): string[] => {
    texts.length = 0;
    scr.draw(g, { w: 1920, h: 1080 }, 1, ctx);
    return [...texts];
  };
  return { net, ctx, step, draw, room: () => net.current as FakeRoom };
}

const lobbyMsgs = (room: FakeRoom) => room.sent.filter((s) => s.data.t === 'lobby').map((s) => ({ to: s.to, view: (s.data as { view: LobbyView }).view }));

describe('host lobby online', () => {
  it('hosts on alt, seats remote players by peer, broadcasts changes, drops leavers and closes on back', () => {
    const t = setup();
    const scr = createLobbyScreen({ title: 'Join', rules: { minPlayers: 1, maxPlayers: 3, takenColors: [] }, onStart: () => ({ t: 'quit' }) });
    expect(t.draw(scr)).toContain('Host online');
    t.step(scr, [f('kb1', { alt: true })]);
    expect(t.net.host).toHaveBeenCalledTimes(1);
    const room = t.room();
    t.step(scr, [f('pad0', { confirm: true })]);
    expect(lobbyMsgs(room)).toHaveLength(1);
    t.step(scr);
    expect(lobbyMsgs(room)).toHaveLength(1);
    room.emit({ t: 'peerJoined', peer: 1 });
    expect(lobbyMsgs(room)[1].to).toBe(1);
    room.emit({ t: 'msg', from: 1, data: { t: 'frames', frames: [f('pad0', { confirm: true, peer: 0 })] } });
    t.step(scr);
    expect(scr.state.seats.map((s) => [s.device, s.peer])).toEqual([['pad0', 0], ['pad0', 1]]);
    expect(lobbyMsgs(room).at(-1)?.view).toMatchObject({ code: '4821', title: 'Join', seats: [{ peer: 0 }, { peer: 1 }] });
    const texts = t.draw(scr);
    expect(texts).toContain('Controller 1 · Online');
    expect(texts.some((s) => s.includes('Code 4821'))).toBe(true);
    expect(texts.some((s) => s.includes('http://192.168.1.20:5173/'))).toBe(true);
    expect(texts).not.toContain('Host online');
    room.emit({ t: 'peerLeft', peer: 1 });
    t.step(scr);
    expect(scr.state.seats.map((s) => s.peer)).toEqual([0]);
    expect(lobbyMsgs(room).at(-1)?.view.seats).toHaveLength(1);
    t.step(scr, [f('pad0', { back: true })]);
    expect(t.step(scr, [f('pad0', { back: true })])).toEqual({ t: 'pop' });
    expect(t.net.leave).toHaveBeenCalledTimes(1);
    expect(room.listeners).toBe(0);
  });
});

describe('multiplayer menu', () => {
  const pushed = (out: unknown): string => (out as { t: string; screen: Screen }).screen.id;

  it('the title has Multiplayer instead of Join Online and no Quit', () => {
    const t = setup();
    const title = createTitleScreen();
    const texts = t.draw(title).map((s) => s.toLowerCase());
    expect(texts).toContain('multiplayer');
    expect(texts).not.toContain('quit');
    expect(texts).not.toContain('join online');
    t.step(title, [], { down: true });
    t.step(title, [], { down: true });
    expect(pushed(t.step(title, [], { confirm: true }))).toBe('multiplayer');
  });

  it('creates battle / co-op lobbies or joins one; without the relay only Back works', () => {
    const t = setup();
    const mp = createMultiplayerScreen();
    const battle = (t.step(mp, [], { confirm: true }) as { screen: Screen }).screen;
    expect(battle.id).toBe('battle');
    expect(t.draw(battle)).toContain('Player 2 · Team');
    t.step(mp, [], { down: true });
    expect(pushed(t.step(mp, [], { confirm: true }))).toBe('campaign-packs');
    t.step(mp, [], { down: true });
    expect(pushed(t.step(mp, [], { confirm: true }))).toBe('joinOnline');

    const offline = setup();
    offline.ctx.net = undefined;
    const off = createMultiplayerScreen();
    expect(offline.draw(off)).toContain(NEEDS_DEV_SERVER);
    expect(offline.step(off, [], { confirm: true })).toEqual({ t: 'pop' });
  });

  it('a co-op lobby created from Multiplayer opens the room once, without pressing Y / R', () => {
    const t = setup();
    const briefing = createBriefingScreen(placeholderArea({ cometId: 'kreios', index: 0, resurgence: false }), { online: true });
    const out = t.step(briefing, [], { confirm: true });
    const lobby = (out as { screen: Screen }).screen;
    t.step(lobby);
    expect(t.net.host).toHaveBeenCalledTimes(1);
    expect(t.room().role).toBe('host');
    t.room().status = 'closed';
    t.step(lobby);
    t.step(lobby);
    expect(t.net.host).toHaveBeenCalledTimes(1);
  });

  it('a local lobby does not auto-host', () => {
    const t = setup();
    const scr = createLobbyScreen({ title: 'Battle', rules: { minPlayers: 1, maxPlayers: 2, takenColors: [] }, onStart: () => ({ t: 'quit' }) });
    t.step(scr);
    expect(t.net.host).not.toHaveBeenCalled();
  });
});

describe('join online screen', () => {
  it('pops on back with an empty code', () => {
    const t = setup();
    expect(t.step(createJoinOnlineScreen(), [], { back: true })).toEqual({ t: 'pop' });
  });

  it('typed digits + confirm join; an error lets the user retry; opens the remote lobby once joined', () => {
    const t = setup();
    const scr = createJoinOnlineScreen();
    t.step(scr, [], {}, '48x2');
    t.step(scr, [], { confirm: true });
    expect(t.net.join).not.toHaveBeenCalled();
    t.step(scr, [], { back: true });
    t.step(scr, [], { up: true });
    t.step(scr, [], { right: true }, '21');
    t.step(scr, [], { confirm: true });
    expect(t.net.join).toHaveBeenCalledWith('4821');
    expect(t.draw(scr)).toContain('Connecting…');
    t.room().error = 'No room with that code';
    t.room().status = 'closed';
    expect(t.step(scr)).toBeNull();
    expect(t.draw(scr)).toContain('No room with that code');
    t.step(scr, [], { confirm: true });
    expect(t.net.join).toHaveBeenCalledTimes(2);
    expect(t.step(scr)).toBeNull();
    Object.assign(t.room(), { status: 'open', me: 2 });
    const out = t.step(scr);
    expect(out).toMatchObject({ t: 'replace' });
    expect((out as { screen: Screen }).screen.id).toBe('remoteLobby');
  });
});

describe('remote lobby', () => {
  const view: LobbyView = {
    code: '4821', title: 'Battle', rules: { minPlayers: 2, maxPlayers: 2, takenColors: [] }, countdown: null,
    seats: [{ device: 'kb1', colorIndex: 0, ready: true, peer: 0 }, { device: 'pad0', colorIndex: 3, ready: false, peer: 1 }],
  };

  it('sends only edge frames to the host, renders views and leaves after the host closes the room', () => {
    const room = new FakeRoom('client', 1);
    const t = setup(room);
    const scr = createRemoteLobbyScreen();
    t.step(scr, [f('kb1'), f('pad0', { confirm: true }), f('pad1', { connected: false })]);
    expect(room.sent).toEqual([
      { data: { t: 'frames', frames: [] }, to: 0 },
      { data: { t: 'frames', frames: [f('pad0', { confirm: true, alt: false })] }, to: 0 },
    ]);
    t.step(scr, [f('kb1'), f('pad0')]);
    expect(room.sent).toHaveLength(2);
    room.emit({ t: 'msg', from: 0, data: { t: 'lobby', view } });
    const texts = t.draw(scr);
    expect(texts).toContain('Controller 1 · You');
    expect(texts).toContain('Keyboard (WASD) · Host');
    expect(t.step(scr, [], { back: true })).toBeNull();
    room.emit({ t: 'msg', from: 0, data: { t: 'closed' } });
    expect(t.step(scr)).toBeNull();
    expect(t.net.leave).toHaveBeenCalled();
    expect(t.draw(scr)).toContain(HOST_CLOSED_TEXT);
    expect(t.step(scr, [], {}, '', 1)).toBeNull();
    expect(t.step(scr, [], {}, '', 1.1)).toEqual({ t: 'pop' });
  });

  it('back with none of this machine’s devices seated leaves the room', () => {
    const room = new FakeRoom('client', 2);
    const t = setup(room);
    const scr = createRemoteLobbyScreen(view);
    expect(room.sent).toEqual([]);
    expect(t.step(scr, [f('kb1', { back: true })])).toEqual({ t: 'pop' });
    expect(t.net.leave).toHaveBeenCalledTimes(1);
    expect(room.sent).toEqual([]);
  });
});
