import type { BuildAction, GameEvent, GameMode, MenuView, SfxName, Team, ViewState, World } from '../types';
import type { Input } from './Input';
import type { AudioFx } from './Audio';
import type { Renderer } from '../ui/Renderer';
import type { KeyBindings } from '../data/controls';
import { COLORS, SAVE_KEY, paletteOf } from './config';
import { createWorld } from './World';
import { getLevel, VERSUS_LEVEL } from '../data/levels';
import { MUTE_CODES, P1_BINDINGS, P2_BINDINGS, PAUSE_CODES } from '../data/controls';
import { RESEARCH_DEFS } from '../data/units';
import { PlayerController } from '../controllers/PlayerController';
import { AIController } from '../controllers/AIController';
import { seedInitialDeposits, updateMeteors } from '../systems/MeteorSystem';
import { updateWaves } from '../systems/WaveSystem';
import { updateMovement } from '../systems/MovementSystem';
import { updateCombat } from '../systems/CombatSystem';
import { updateEconomy } from '../systems/EconomySystem';
import { updateEffects } from '../systems/ParticleSystem';
import { getMenuItemRects } from '../ui/MenuScreen';

const GAME_OVER_DELAY = 1.5;
const BANNER_TIME = 2.2;
const SHORT_BANNER_TIME = 1.2;
/** A low-priority banner may not replace any banner younger than this (seconds). */
const BANNER_MIN_SHOW = 0.6;
/** Minimum real time between two build-failure banners. */
const FAIL_BANNER_INTERVAL = 0.8;

const MENU_UP = ['ArrowUp', 'KeyW'] as const;
const MENU_DOWN = ['ArrowDown', 'KeyS'] as const;
const MENU_LEFT = ['ArrowLeft', 'KeyA'] as const;
const MENU_RIGHT = ['ArrowRight', 'KeyD'] as const;
const MENU_SELECT = ['Enter', 'NumpadEnter', 'Space'] as const;

type Controller = PlayerController | AIController;

function loadUnlocked(): number {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const n = raw === null ? 1 : parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  } catch {
    return 1;
  }
}

function saveUnlocked(level: number): void {
  try {
    localStorage.setItem(SAVE_KEY, String(level));
  } catch {
    // Storage unavailable (private mode / sandbox): progress is simply not persisted.
  }
}

const KEY_NAMES: Record<string, string> = {
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
  Escape: 'ESC',
  Space: 'SPACE',
  Enter: 'ENTER',
};

/** Human-readable name of a KeyboardEvent.code. */
export function keyName(code: string): string {
  const named = KEY_NAMES[code];
  if (named) return named;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code.toUpperCase();
}

function slotKeys(b: KeyBindings, type: BuildAction['type'], alt: boolean): string {
  const keys: string[] = [];
  for (const s of b.slots) {
    if (s.action.type !== type) continue;
    const code = alt ? s.codes[1] : undefined;
    keys.push(alt ? (code ? keyName(code) : '') : s.label);
  }
  return keys.filter((k) => k !== '').join(' ');
}

/** Controls summary lines built from the binding tables (single source of truth). */
export function controlLines(prefix: string, b: KeyBindings): string[] {
  const hasAlt = b.slots.some((s) => s.codes.length > 1);
  const pad = ' '.repeat(prefix.length);
  const lines = [
    `${prefix}  ${b.moveLabel} move \u00B7 ${b.actLabel} act \u00B7 towers ${slotKeys(b, 'build', false)} \u00B7 send ${slotKeys(b, 'send', false)}` +
      ` \u00B7 launch ${slotKeys(b, 'launch', false)}`,
    `${pad}  upgrade ${slotKeys(b, 'upgrade', false)} \u00B7 sell ${slotKeys(b, 'sell', false)} \u00B7 research ${slotKeys(b, 'research', false)}`,
  ];
  if (hasAlt) {
    lines.push(
      `${pad}  alt keys: towers ${slotKeys(b, 'build', true)} \u00B7 send ${slotKeys(b, 'send', true)} \u00B7 launch ${slotKeys(b, 'launch', true)}` +
        ` \u00B7 upgrade ${slotKeys(b, 'upgrade', true)} \u00B7 sell ${slotKeys(b, 'sell', true)} \u00B7 research ${slotKeys(b, 'research', true)}`,
    );
  }
  return lines;
}

const GLOBAL_LINE =
  `${PAUSE_CODES.map(keyName).join('/')} pause \u00B7 ${MUTE_CODES.map(keyName).join(' or ')} mute`;

/** Screen state machine + per-step orchestration of controllers and systems. */
export class Game {
  private world: World | null = null;
  private mode: GameMode = 'single';
  private controllers: [Controller, Controller] | null = null;
  private unlockedLevel = loadUnlocked();
  private selectedLevel = this.unlockedLevel;
  private playingLevel = 1;
  private gameOverTimer = -1;
  private bannerShownAt = -Infinity;
  private lastFailBanner = -Infinity;
  /** Sounds already played during the current event drain (one per name per step). */
  private readonly playedThisStep = new Set<SfxName>();
  private readonly view: ViewState;

  constructor(
    private readonly renderer: Renderer,
    private readonly input: Input,
    private readonly audio: AudioFx,
  ) {
    this.view = {
      screen: 'menu',
      menu: null,
      fps: 60,
      realTime: 0,
      level: this.selectedLevel,
      muted: audio.muted,
      banner: null,
    };
    input.onFirstGesture(() => this.audio.unlock());
    this.openMainMenu();
  }

  // ------------------------------------------------------------ loop callbacks

  update(dt: number): void {
    this.input.beginStep();
    this.view.realTime += dt;
    if (this.view.banner) {
      this.view.banner.time -= dt;
      if (this.view.banner.time <= 0) this.view.banner = null;
    }

    if (this.input.wasAnyPressed(MUTE_CODES)) {
      this.view.muted = this.audio.toggleMute();
      if (this.view.screen === 'menu') this.openMainMenu(this.view.menu?.selected ?? 0);
    }

    switch (this.view.screen) {
      case 'menu':
      case 'howto':
      case 'gameover':
      case 'paused':
        this.updateMenu();
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
    }
  }

  render(fps: number): void {
    this.view.fps = fps;
    const showWorld = this.view.screen === 'playing' || this.view.screen === 'paused' || this.view.screen === 'gameover';
    this.renderer.render(showWorld ? this.world : null, this.view);
  }

  // ------------------------------------------------------------ playing

  private startGame(mode: GameMode, level: number): void {
    this.mode = mode;
    this.playingLevel = level;
    const def = mode === 'single' ? getLevel(level) : VERSUS_LEVEL;
    const world = createWorld(mode, def, Date.now());
    seedInitialDeposits(world);
    world.events.length = 0;
    this.world = world;
    this.controllers = [
      new PlayerController(0, P1_BINDINGS, mode === 'single'),
      mode === 'single' ? new AIController(1, def) : new PlayerController(1, P2_BINDINGS, false),
    ];
    this.gameOverTimer = -1;
    this.view.screen = 'playing';
    this.view.menu = null;
    this.view.level = mode === 'single' ? level : 0;
    this.view.banner = null;
    this.setBanner(mode === 'single' ? `LEVEL ${level}` : 'VERSUS', COLORS.text, BANNER_TIME, true);
  }

  private updatePlaying(dt: number): void {
    const world = this.world;
    if (!world) return;
    const ending = this.gameOverTimer >= 0;

    if (!ending && this.input.wasAnyPressed(PAUSE_CODES)) {
      this.openPauseMenu();
      this.audio.play('menuSelect');
      return;
    }

    if (!ending && this.controllers) {
      for (const c of this.controllers) {
        if (c instanceof PlayerController) c.update(world, this.input, dt);
        else c.update(world, dt);
      }
    }

    updateMeteors(world, dt);
    updateWaves(world, dt);
    updateMovement(world, dt);
    updateCombat(world, dt);
    updateEconomy(world, dt);
    updateEffects(world, dt);
    world.time += dt;

    this.drainEvents(world);

    if (this.gameOverTimer >= 0) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0) this.openGameOver();
    }
  }

  private drainEvents(world: World): void {
    const events = world.events;
    this.playedThisStep.clear();
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e) this.handleEvent(world, e);
    }
    events.length = 0;
  }

  /** Plays a sound at most once per sim step (Audio additionally throttles per name). */
  private sfx(name: SfxName, volume = 1): void {
    if (this.playedThisStep.has(name)) return;
    this.playedThisStep.add(name);
    this.audio.play(name, volume);
  }

  private isHuman(world: World, team: Team): boolean {
    return world.players[team].controller !== 'ai';
  }

  private handleEvent(world: World, e: GameEvent): void {
    switch (e.type) {
      case 'shot':
        if (e.kind === 'laser') this.sfx('laser', 0.45);
        else if (e.kind === 'cannon') this.sfx('cannon', 0.8);
        else if (e.kind === 'cryo') this.sfx('cryo', 0.55);
        else if (e.kind === 'plasma') this.sfx('plasma', 0.35);
        break;
      case 'explosion':
        this.sfx(e.big ? 'bigExplosion' : 'explosion', e.big ? 1 : 0.6);
        break;
      case 'unitKilled':
        break;
      case 'build':
        this.sfx('build');
        break;
      case 'upgrade':
        this.sfx('upgrade');
        break;
      case 'sell':
        this.sfx('sell');
        break;
      case 'buildFail':
        if (!this.isHuman(world, e.team)) break;
        this.sfx('error', 0.7);
        if (e.reason) this.failBanner(e.reason.toUpperCase());
        break;
      case 'notEnoughMoney':
        if (!this.isHuman(world, e.team)) break;
        this.sfx('error', 0.7);
        this.failBanner('NOT ENOUGH THORIUM');
        break;
      case 'rockPickup':
        this.sfx('pickup');
        break;
      case 'rockDrop':
        this.sfx('drop');
        break;
      case 'rockRefined':
        this.sfx('cash', 0.6);
        break;
      case 'meteorShower':
        this.sfx('meteor');
        this.setBanner('METEOR SHOWER!', COLORS.thorium, BANNER_TIME, true);
        break;
      case 'rockLanded':
        break;
      case 'baseHit':
        this.sfx('baseHit', 0.8);
        break;
      case 'waveLaunched': {
        const pal = paletteOf(world.players[e.team]);
        this.sfx('wave');
        this.setBanner(`${pal.name} LAUNCHES ${e.count} UNITS`, pal.main, BANNER_TIME, true);
        break;
      }
      case 'research': {
        const player = world.players[e.team];
        const text = `${RESEARCH_DEFS[e.kind].name.toUpperCase()} UNLOCKED`;
        this.sfx('research');
        this.setBanner(this.isHuman(world, e.team) ? text : `${paletteOf(player).name}: ${text}`, COLORS.research, BANNER_TIME, true);
        break;
      }
      case 'unitQueued':
        if (this.isHuman(world, e.team)) this.sfx('queue', 0.6);
        break;
      case 'gameOver':
        if (this.gameOverTimer < 0) this.gameOverTimer = GAME_OVER_DELAY;
        break;
    }
  }

  private failBanner(text: string): void {
    const now = this.view.realTime;
    if (now - this.lastFailBanner < FAIL_BANNER_INTERVAL) return;
    if (this.setBanner(text, COLORS.warning, SHORT_BANNER_TIME, false)) this.lastFailBanner = now;
  }

  /** Important banners always show; others never replace a banner that just appeared. */
  private setBanner(text: string, color: string, time: number, important: boolean): boolean {
    const now = this.view.realTime;
    const current = this.view.banner;
    if (current && current.text === text) {
      current.time = Math.max(current.time, time);
      return true;
    }
    if (!important && current && now - this.bannerShownAt < BANNER_MIN_SHOW) return false;
    this.view.banner = { text, color, time };
    this.bannerShownAt = now;
    return true;
  }

  // ------------------------------------------------------------ menus

  private setMenu(menu: MenuView): void {
    this.view.menu = menu;
  }

  private openMainMenu(selected = 0): void {
    this.view.screen = 'menu';
    this.world = null;
    this.controllers = null;
    this.view.level = this.selectedLevel;
    this.setMenu({
      title: 'ORBITAL CLASH',
      subtitle: 'SWARM \u00B7 BUILD \u00B7 HARVEST \u00B7 LAUNCH',
      items: [
        `1 PLAYER VS AI  \u25C0 LEVEL ${this.selectedLevel} \u25B6`,
        '2 PLAYERS LOCAL VERSUS',
        'HOW TO PLAY',
        `SOUND: ${this.audio.muted ? 'OFF' : 'ON'}`,
      ],
      selected,
      lines: [
        `P1  ${P1_BINDINGS.moveLabel} move \u00B7 ${P1_BINDINGS.actLabel} act \u00B7 mouse + sidebar in 1P`,
        `P2  ${P2_BINDINGS.moveLabel} move \u00B7 ${P2_BINDINGS.actLabel} act \u00B7 numpad or Y-P / H-L / N M ; , . /`,
        `${GLOBAL_LINE} \u00B7 \u2191\u2193 choose \u00B7 \u2190\u2192 level \u00B7 ENTER select`,
      ],
    });
  }

  private openHowTo(): void {
    this.view.screen = 'howto';
    this.setMenu({
      title: 'HOW TO PLAY',
      subtitle: 'DEFEND YOUR BASE \u00B7 DESTROY THEIRS',
      items: ['BACK'],
      selected: 0,
      lines: [
        'Build towers into mazes. You can never fully seal the path to a base.',
        'Buy unit packs into your wave buffer, then LAUNCH them all as one long train.',
        'Bombers fly straight over the maze: only Lasers and Plasma Lances hit them.',
        'Meteor showers drop Thorium. Harvest Stations send drones to mine it;',
        'your ship can carry one rock too. Refining pays Thorium + research energy.',
        'Research unlocks tower level 3, faster swarms and double harvester cargo.',
        'Kills pay a bounty. Bring the enemy base to 0 HP to win.',
        '',
        ...controlLines('P1', P1_BINDINGS),
        'P1 mouse (1P): left click = act / sidebar \u00B7 right click = sell own tower or drop rock',
        ...controlLines('P2', P2_BINDINGS),
        GLOBAL_LINE,
      ],
    });
  }

  private openPauseMenu(): void {
    this.view.screen = 'paused';
    this.setMenu({
      title: 'PAUSED',
      subtitle: this.mode === 'single' ? `LEVEL ${this.playingLevel}` : 'LOCAL VERSUS',
      items: ['RESUME', 'RESTART', 'MAIN MENU'],
      selected: 0,
      lines: [],
    });
  }

  private openGameOver(): void {
    const world = this.world;
    if (!world) return;
    const winner: Team = world.winner ?? (world.bases[0].hp <= 0 ? 1 : 0);
    const single = this.mode === 'single';
    const won = winner === 0;

    if (single && won && this.playingLevel + 1 > this.unlockedLevel) {
      this.unlockedLevel = this.playingLevel + 1;
      saveUnlocked(this.unlockedLevel);
    }
    if (single && won) this.selectedLevel = Math.min(this.unlockedLevel, this.playingLevel + 1);

    this.audio.play(!single || won ? 'victory' : 'defeat');

    const title = single ? (won ? 'VICTORY' : 'DEFEAT') : `${paletteOf(world.players[winner]).name} WINS`;
    const statLine = (team: Team): string => {
      const p = world.players[team];
      const label = single ? (team === 0 ? 'YOU' : 'AI') : paletteOf(p).name;
      const s = p.stats;
      return `${label}  KILLS ${s.kills} \u00B7 LAUNCHES ${s.launches} \u00B7 UNITS SENT ${s.unitsSent} \u00B7 ROCKS REFINED ${s.rocksRefined}`;
    };
    const mins = Math.floor(world.time / 60);
    const secs = Math.floor(world.time % 60).toString().padStart(2, '0');

    this.view.screen = 'gameover';
    this.setMenu({
      title,
      subtitle: single ? `LEVEL ${this.playingLevel}` : 'LOCAL VERSUS',
      items: [single && won ? 'NEXT LEVEL' : 'RETRY', 'MAIN MENU'],
      selected: 0,
      lines: [statLine(0), statLine(1), `TOTAL LAUNCHES ${world.waveNumber} \u00B7 TIME ${mins}:${secs}`],
    });
  }

  private updateMenu(): void {
    const menu = this.view.menu;
    if (!menu) return;
    const input = this.input;
    const screen = this.view.screen;
    const count = menu.items.length;

    if (screen === 'paused' && input.wasAnyPressed(PAUSE_CODES)) {
      this.resume();
      return;
    }
    if (screen === 'howto' && input.wasAnyPressed(PAUSE_CODES)) {
      this.audio.play('menuSelect');
      this.openMainMenu(2);
      return;
    }

    if (input.wasAnyPressed(MENU_UP)) {
      menu.selected = (menu.selected - 1 + count) % count;
      this.audio.play('menuMove');
    }
    if (input.wasAnyPressed(MENU_DOWN)) {
      menu.selected = (menu.selected + 1) % count;
      this.audio.play('menuMove');
    }

    if (screen === 'menu' && menu.selected === 0) {
      let delta = 0;
      if (input.wasAnyPressed(MENU_LEFT)) delta -= 1;
      if (input.wasAnyPressed(MENU_RIGHT)) delta += 1;
      if (delta !== 0) this.changeLevel(delta);
    }

    let activate = input.wasAnyPressed(MENU_SELECT);
    const m = input.mouse;
    if (m.moved || m.leftPressed) {
      const rects = getMenuItemRects(menu);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (!r || m.x < r.x || m.x > r.x + r.w || m.y < r.y || m.y > r.y + r.h) continue;
        if (menu.selected !== i) {
          menu.selected = i;
          if (!m.leftPressed) this.audio.play('menuMove');
        }
        if (m.leftPressed) activate = true;
        break;
      }
    }

    if (activate) {
      this.audio.play('menuSelect');
      this.activate(menu.selected);
    }
  }

  private changeLevel(delta: number): void {
    const next = Math.max(1, Math.min(this.unlockedLevel, this.selectedLevel + delta));
    if (next === this.selectedLevel) return;
    this.selectedLevel = next;
    this.audio.play('menuMove');
    this.openMainMenu(0);
  }

  private activate(index: number): void {
    switch (this.view.screen) {
      case 'menu':
        if (index === 0) this.startGame('single', this.selectedLevel);
        else if (index === 1) this.startGame('versus', 0);
        else if (index === 2) this.openHowTo();
        else if (index === 3) {
          this.view.muted = this.audio.toggleMute();
          this.openMainMenu(3);
        }
        break;
      case 'howto':
        this.openMainMenu(2);
        break;
      case 'paused':
        if (index === 0) this.resume();
        else if (index === 1) this.startGame(this.mode, this.playingLevel);
        else this.openMainMenu();
        break;
      case 'gameover': {
        if (index === 0) {
          const won = this.world?.winner === 0;
          const next = this.mode === 'single' && won ? this.playingLevel + 1 : this.playingLevel;
          this.startGame(this.mode, next);
        } else {
          this.openMainMenu();
        }
        break;
      }
      case 'playing':
        break;
    }
  }

  private resume(): void {
    this.view.screen = 'playing';
    this.view.menu = null;
  }
}
