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
import { registerAllSystems } from './registerSystems';
import { buildRun, type StartCommand } from './runSpec';
import { createSession, type Session } from './session';
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
  const menuInput: InputController = createInput({
    players: [0], getBuildItems: () => [], getAttackUnits: () => [], getCursor: () => ({ tx: 0, ty: 0 }),
  });

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
  const screens = createScreenManager(data, createTitleScreen());
  let hud: Hud = makeHud();

  function makeHud(): Hud {
    return createHud({
      layout: () => save.settings.videoLayout,
      project: (x, y) => (renderer ? worldToScreen(renderer.getView(), x, y) : null),
      controlsDisplay: () => save.settings.controlsDisplay,
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

  function start(cmd: StartCommand): void {
    const spec = buildRun(cmd, save.settings.defaultDifficulty as Difficulty);
    if (typeof spec === 'string') return showNotice(spec);
    const r = ensureRenderer();
    if (!r) return;
    session?.dispose();
    session = createSession(spec);
    r.load(session.sim.world);
    save = { ...save, trophies: { ...save.trophies, localPlayers: [...spec.humans] } };
    hud = makeHud();
    screens.reset(null);
    phase = 'playing';
    audio.unlock();
    audio.music('game');
  }

  function toTitle(): void {
    session?.dispose();
    session = null;
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
        session.sim.step(intents);
        return;
      }
      case 'restart':
        return session ? start(session.spec.command) : undefined;
      case 'nextArea': {
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
    audio.handle(events);
    hud.pushEvents(events, now);
    save = feedTrophies(save, events, now);
    ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    hud.draw(ctx, world, s.input, now);
    handle(hud.takeCommand());
    if (world.over && phase === 'playing' && session) {
      const done = finishRun(session, save);
      save = done.save;
      saveSave(save);
      phase = 'results';
      screens.reset(createResultsScreen(done.props));
    }
  }

  function frame(t: number): void {
    const now = t / 1000;
    const dt = Math.min(MAX_FRAME, (t - last) / 1000);
    last = t;
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
