import { PLAYER_IDS } from '@/types';
import type { Difficulty } from '@/types';
import { createGameRenderer, WebGLUnsupportedError, type RendererWithView, worldToScreen } from '@/render/engine';
import { createModelsLayer } from '@/render/models';
import { createFxLayer } from '@/render/fx';
import type { TerrainLayer } from '@/render/terrain';
import { createAudio, type GameAudio } from '@/audio';
import { loadSave, saveSave, type SaveData } from '@/meta';
import { createHud, createScreenManager, createTitleScreen, createResultsScreen, type Command, type UiData, type Hud } from '@/ui';
import { missionSummaries } from '@/data/areas';
import { battleMapSummaries } from '@/data/battle-maps';
import { createInput, type InputController } from '@/input';
import { createShipPreview, type ShipPreview } from '@/render/preview';
import { resetPlayerColorMap, setPlayerColorMap } from '@/config/playerColors';
import { registerAllSystems } from './registerSystems';
import { buildRun, type StartCommand } from './runSpec';
import { createSession, type Session } from './session';
import { createNetSession } from './netSession';
import { createRoom } from '@/net/room';
import type { NetEvent, NetHooks, NetRoom } from '@/net/types';
import { feedTrophies, finishRun, submitToBoard, updateCursors } from './runEnd';

const MAX_FRAME = 0.1;

type Phase = 'menu' | 'playing' | 'results';

export interface AppDeps {
  gl: HTMLCanvasElement;
  hud: HTMLCanvasElement;
}

/** Top-level shell: menus, a running session, results, persistence. */
export function createApp({ gl, hud: hudCanvas }: AppDeps) {
  registerAllSystems();
  let save: SaveData = loadSave();
  const audio: GameAudio = createAudio();
  let renderer: RendererWithView | null = null;
  let session: Session | null = null;
  let phase: Phase = 'menu';
  let last = performance.now();
  let notice = '';
  let noticeUntil = 0;

  const ctx = hudCanvas.getContext('2d')!;
  /** Lazily built 3D ship for the lobby; undefined = not tried yet, null = WebGL unavailable. */
  let preview: ShipPreview | null | undefined;
  const menuInput: InputController = createInput({
    players: [0], getBuildItems: () => [], getAttackUnits: () => [], getCursor: () => ({ tx: 0, ty: 0 }),
  });

  /** Online room this machine is in (host or client), if any. */
  let room: NetRoom | null = null;
  /** The room the running session plays through (null = offline). */
  let sessionRoom: NetRoom | null = null;
  let roomUnsub: (() => void) | null = null;
  /** Printable characters typed since the last frame (join-code entry). */
  let typed = '';
  let typedThisFrame = '';

  const net: NetHooks = {
    room: () => room,
    host: () => {
      if (room && room.role === 'host' && room.status !== 'closed') return;
      openRoom(createRoom({ host: true }));
    },
    join: (code) => openRoom(createRoom({ join: code })),
    leave: () => closeRoom(),
  };

  function openRoom(r: NetRoom): void {
    closeRoom();
    room = r;
    roomUnsub = r.listen((e) => onNet(r, e));
  }

  /** Leaves the room; a host first tells everyone it is closed. */
  function closeRoom(): void {
    const r = room;
    if (!r) return;
    room = null;
    roomUnsub?.();
    roomUnsub = null;
    if (r.role === 'host' && r.status === 'open') r.send({ t: 'closed' });
    r.close();
  }

  function onNet(r: NetRoom, e: NetEvent): void {
    if (r !== room || r.role !== 'client') return;
    if (e.t === 'msg' && e.from === 0) {
      if (e.data.t === 'start') startOnline(e.data.cmd, e.data.difficulty, e.data.seed);
      else if (e.data.t === 'closed' && phase !== 'menu') {
        closeRoom();
        toTitle();
        showNotice('The host closed the room.');
      }
    } else if (e.t === 'peerLeft' && e.peer === 0 && phase !== 'menu') {
      showNotice('The host left: restart is not available.');
    }
  }

  const data = (): UiData => ({
    save,
    areas: missionSummaries().map((a) => ({
      cometId: a.comet, index: a.index, resurgence: a.resurgence, name: a.name, number: a.number,
      teaches: a.teaches, objectives: a.objectives, parTimeSec: a.parTimeSec,
    })),
    maps: battleMapSummaries().map((m) => ({
      id: m.id, name: m.name, thoriumLevel: m.thoriumLevel, palette: m.palette, maxPlayers: m.maxPlayers,
    })),
  });
  const screens = createScreenManager(data, createTitleScreen(), {
    devices: () => menuInput.devices(),
    shipPreview: (colorIndex, nowSec) => {
      if (preview === undefined) preview = createShipPreview();
      return preview?.render(colorIndex, nowSec) ?? null;
    },
    net,
    text: () => typedThisFrame,
  });
  let hud: Hud = makeHud();

  function makeHud(): Hud {
    return createHud({
      layout: () => save.settings.videoLayout,
      project: (x, y) => (renderer ? worldToScreen(renderer.getView(), x, y) : null),
      controlsDisplay: () => save.settings.controlsDisplay,
      pauseNotice: () => session?.pauseNotice() ?? null,
    });
  }

  function applySettings(): void {
    const s = save.settings;
    audio.setVolume(s.masterVolume, s.sfxVolume, s.musicVolume);
  }

  function showNotice(text: string): void {
    notice = text;
    noticeUntil = performance.now() + 4000;
  }

  function ensureRenderer(): RendererWithView | null {
    if (renderer) return renderer;
    try {
      const r = createGameRenderer([createModelsLayer, createFxLayer]);
      r.init(gl);
      resize(r);
      renderer = r;
    } catch (e) {
      showNotice(e instanceof WebGLUnsupportedError ? 'WebGL is not available in this browser.' : `Renderer error: ${String(e)}`);
      renderer = null;
    }
    return renderer;
  }

  function hosting(): NetRoom | null {
    return room && room.role === 'host' && room.status === 'open' ? room : null;
  }

  function start(cmd: StartCommand): void {
    const difficulty = save.settings.defaultDifficulty as Difficulty;
    const host = hosting();
    if (!host) {
      // A room that failed or is still connecting must not stay attached to an offline match.
      closeRoom();
      launch(buildRun(cmd, difficulty), null);
      return;
    }
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const spec = buildRun(cmd, difficulty, seed);
    if (typeof spec === 'string') return showNotice(spec);
    if (!ensureRenderer()) return;
    host.send({ t: 'start', cmd, difficulty, seed });
    launch(spec, host, seed);
  }

  function startOnline(cmd: StartCommand, difficulty: Difficulty, seed: number): void {
    // Leaving frees the others' lockstep (peerLeft) instead of making them wait for us forever.
    if (room && !launch(buildRun(cmd, difficulty, seed), room, seed)) closeRoom();
  }

  function launch(spec: ReturnType<typeof buildRun>, online: NetRoom | null, match = 0): boolean {
    if (typeof spec === 'string') {
      showNotice(spec);
      return false;
    }
    const r = ensureRenderer();
    if (!r) return false;
    session?.dispose();
    session = online ? createNetSession(spec, online, {}, { match }) : createSession(spec);
    sessionRoom = online;
    preview?.dispose();
    preview = undefined;
    setPlayerColorMap(session.sim.world.players.map((p) => p.colorIndex));
    r.load(session.sim.world);
    const local = online ? spec.bindings.filter((b) => b.peer === online.me).map((b) => b.player) : spec.humans;
    save = { ...save, trophies: { ...save.trophies, localPlayers: [...local] } };
    hud = makeHud();
    screens.reset(null);
    phase = 'playing';
    audio.unlock();
    audio.music('game');
    return true;
  }

  function toTitle(): void {
    closeRoom();
    session?.dispose();
    session = null;
    sessionRoom = null;
    resetPlayerColorMap();
    phase = 'menu';
    hud.reset();
    screens.reset(createTitleScreen());
    audio.music('menu');
  }

  function nextAreaCommand(): StartCommand | null {
    const c = session?.spec.command;
    if (!c || c.t !== 'startCampaign') return null;
    return { ...c, index: Math.min(6, c.index + 1) };
  }

  function handle(cmd: Command | null): void {
    if (!cmd) return;
    switch (cmd.t) {
      case 'startCampaign':
      case 'startBattle':
        return start(cmd);
      case 'resume': {
        if (!session) return;
        const intents = session.input.setPaused(false);
        session.submit(intents);
        return;
      }
      case 'restart':
        if (room && !hosting()) return showNotice('Only the host can restart.');
        return session ? start(session.spec.command) : undefined;
      case 'nextArea': {
        if (room && !hosting()) return showNotice('Waiting for the host to continue…');
        const n = nextAreaCommand();
        return n ? start(n) : toTitle();
      }
      case 'quitToTitle':
      case 'quit':
        return toTitle();
      case 'settingsChanged':
        save = { ...save, settings: cmd.settings };
        saveSave(save);
        applySettings();
        if (renderer) resize(renderer);
        return;
      case 'submitScore':
        save = submitToBoard(save, cmd.boardKey, cmd.name, cmd.score, cmd.timeSec);
        return;
    }
  }

  function resize(r: RendererWithView | null = renderer): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    hudCanvas.width = w;
    hudCanvas.height = h;
    r?.resize(w, h);
  }

  function playingFrame(dt: number, now: number): void {
    const s = session!;
    const alpha = s.frame(dt);
    const events = s.sim.drainEvents();
    const world = s.sim.world;
    renderer?.draw(world, alpha, events, now);
    updateCursors(renderer?.getLayer<TerrainLayer>('terrain'), s);
    audio.handle(events, (owner) => world.players[owner]?.controller === 'human');
    hud.pushEvents(events, now, world);
    save = feedTrophies(save, events, now);
    ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hud.draw(ctx, world, s.input, now);
    drawBanner(s.banner());
    handle(hud.takeCommand());
    if (world.over && phase === 'playing' && session) {
      const done = finishRun(session, save);
      save = done.save;
      saveSave(save);
      phase = 'results';
      screens.reset(createResultsScreen(done.props));
    }
  }

  function drawBanner(text: string | null): void {
    if (!text) return;
    ctx.save();
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 40;
    const x = hudCanvas.width / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - w / 2, 56, w, 40);
    ctx.fillStyle = '#ffd36b';
    ctx.fillText(text, x, 84);
    ctx.restore();
  }

  /** Online housekeeping once per frame: connection loss in a match, leftover rooms back at the title. */
  function checkRoom(): void {
    if (!room) return;
    if (phase !== 'menu' && sessionRoom === room && room.status === 'closed') {
      const why = room.error ?? 'Connection lost';
      closeRoom();
      toTitle();
      showNotice(`Online game ended: ${why}.`);
    } else if (phase === 'menu' && screens.depth <= 1) {
      closeRoom();
    }
  }

  function frame(t: number): void {
    const now = t / 1000;
    const dt = Math.min(MAX_FRAME, (t - last) / 1000);
    last = t;
    typedThisFrame = typed;
    typed = '';
    checkRoom();
    if (phase === 'playing' && session) playingFrame(dt, now);
    else {
      if (phase === 'results' && session && renderer) {
        renderer.draw(session.sim.world, 0, [], now);
        session.input.poll(dt);
      }
      const nav = phase === 'results' && session ? session.input.nav() : (menuInput.poll(dt), menuInput.nav());
      handle(screens.update(nav, dt));
      if (screens.depth > 0) {
        if (phase === 'menu') ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
        screens.draw(ctx, hudCanvas.width, hudCanvas.height, now);
      }
    }
    if (performance.now() < noticeUntil) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, hudCanvas.width, 40);
      ctx.fillStyle = '#ffd36b';
      ctx.font = '20px sans-serif';
      ctx.fillText(notice, 16, 27);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => resize());
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', (e) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typed += e.key;
  });
  window.addEventListener('beforeunload', () => closeRoom());
  resize(null);
  applySettings();
  audio.music('menu');
  requestAnimationFrame(frame);

  return {
    /** Test hook: start a run directly. */
    start,
    get world() {
      return session?.sim.world ?? null;
    },
    get session() {
      return session;
    },
    players: PLAYER_IDS,
  };
}
