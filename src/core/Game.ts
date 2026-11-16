import type { GameEvent, GameMode, MenuView, Team, ViewState, World } from '../types';
import type { Input } from './Input';
import type { AudioFx } from './Audio';
import type { Renderer } from '../ui/Renderer';
import { COLORS, SAVE_KEY, TEAM_COLORS } from './config';
import { createWorld } from './World';
import { getLevel, VERSUS_LEVEL } from '../data/levels';
import { PlayerController, P1_BINDINGS, P2_BINDINGS } from '../controllers/PlayerController';
import { AIController } from '../controllers/AIController';
import { updateMeteors } from '../systems/MeteorSystem';
import { updateWaves } from '../systems/WaveSystem';
import { updateMovement } from '../systems/MovementSystem';
import { updateCombat } from '../systems/CombatSystem';
import { updateEconomy } from '../systems/EconomySystem';
import { updateEffects } from '../systems/ParticleSystem';
import { getMenuItemRects } from '../ui/MenuScreen';

const GAME_OVER_DELAY = 1.5;
const BANNER_TIME = 2.2;
const SHORT_BANNER_TIME = 1.2;

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

/** Screen state machine + per-step orchestration of controllers and systems. */
export class Game {
  private world: World | null = null;
  private mode: GameMode = 'single';
  private controllers: [Controller, Controller] | null = null;
  private unlockedLevel = loadUnlocked();
  private selectedLevel = this.unlockedLevel;
  private playingLevel = 1;
  private gameOverTimer = -1;
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

    if (this.input.wasPressed('KeyM')) {
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
    this.world = createWorld(mode, def, Date.now());
    this.controllers = [
      new PlayerController(0, P1_BINDINGS, mode === 'single'),
      mode === 'single' ? new AIController(1, def) : new PlayerController(1, P2_BINDINGS, false),
    ];
    this.gameOverTimer = -1;
    this.view.screen = 'playing';
    this.view.menu = null;
    this.view.level = mode === 'single' ? level : 0;
    this.view.banner = { text: mode === 'single' ? `LEVEL ${level}` : 'VERSUS', color: COLORS.text, time: BANNER_TIME };
  }

  private updatePlaying(dt: number): void {
    const world = this.world;
    if (!world) return;
    const ending = this.gameOverTimer >= 0;

    // P is a P2 slot key in versus mode, so only Escape pauses there.
    const pauseKeys = this.mode === 'versus' ? ['Escape'] : ['Escape', 'KeyP'];
    if (!ending && this.input.wasAnyPressed(pauseKeys)) {
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
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e) this.handleEvent(world, e);
    }
    events.length = 0;
  }

  private handleEvent(world: World, e: GameEvent): void {
    const audio = this.audio;
    switch (e.type) {
      case 'shot':
        if (e.kind === 'laser') audio.play('laser', 0.5);
        else if (e.kind === 'cannon') audio.play('cannon');
        else if (e.kind === 'cryo') audio.play('cryo', 0.6);
        break;
      case 'explosion':
        audio.play(e.big ? 'bigExplosion' : 'explosion');
        break;
      case 'unitKilled':
        break;
      case 'build':
        audio.play('build');
        break;
      case 'upgrade':
        audio.play('upgrade');
        break;
      case 'sell':
        audio.play('sell');
        break;
      case 'buildFail':
        audio.play('error');
        if (world.players[e.team].controller !== 'ai' && e.reason) {
          this.setBanner(e.reason.toUpperCase(), COLORS.warning, SHORT_BANNER_TIME);
        }
        break;
      case 'notEnoughMoney':
        audio.play('error');
        if (world.players[e.team].controller !== 'ai') {
          this.setBanner('NOT ENOUGH MONEY', COLORS.warning, SHORT_BANNER_TIME);
        }
        break;
      case 'rockPickup':
        audio.play('pickup');
        break;
      case 'rockDrop':
        audio.play('drop');
        break;
      case 'rockRefined':
        audio.play('cash');
        break;
      case 'meteorShower':
        audio.play('meteor');
        this.setBanner('METEOR SHOWER!', COLORS.thorium, BANNER_TIME);
        break;
      case 'rockLanded':
        break;
      case 'baseHit':
        audio.play('baseHit');
        break;
      case 'waveLaunched':
        audio.play('wave');
        this.setBanner(`WAVE ${e.wave} LAUNCHED`, COLORS.text, BANNER_TIME);
        break;
      case 'unitQueued':
        audio.play('queue');
        break;
      case 'gameOver':
        if (this.gameOverTimer < 0) this.gameOverTimer = GAME_OVER_DELAY;
        break;
    }
  }

  private setBanner(text: string, color: string, time: number): void {
    this.view.banner = { text, color, time };
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
      subtitle: 'A NEON REVERSE TOWER DEFENSE',
      items: [
        `1 PLAYER  VS AI   \u25C0 LEVEL ${this.selectedLevel} \u25B6`,
        '2 PLAYERS  LOCAL VERSUS',
        'HOW TO PLAY',
        `SOUND: ${this.audio.muted ? 'OFF' : 'ON'}`,
      ],
      selected,
      lines: [
        'P1: WASD move \u00B7 SPACE action \u00B7 1-7 build/send \u00B7 R upgrade \u00B7 F sell \u00B7 mouse in 1P',
        'P2: ARROWS move \u00B7 ENTER action \u00B7 NUMPAD 1-7 or U I O P J K L \u00B7 [ / ] upgrade/sell',
        'ESC pause \u00B7 M mute \u00B7 \u2191\u2193 choose \u00B7 \u2190\u2192 level \u00B7 ENTER select',
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
        'Build towers to defend your base and buy units that march on the enemy base.',
        'Units launch together every wave; each wave also pays income to both sides.',
        'Towers can block paths, but never seal them off completely.',
        'Meteor showers drop Thorium rocks. Grab them with your drone (the cursor),',
        'or build a Magnet Refinery: it pulls nearby rocks in and refines them into cash.',
        'Killing enemy units pays a bounty. Bring the enemy base to 0 HP to win.',
        '',
        'P1  WASD move \u00B7 SPACE pick up/drop/build/upgrade \u00B7 1-4 select tower \u00B7 5-7 send unit',
        '    R upgrade \u00B7 F sell \u00B7 Q/E cycle tower \u00B7 mouse: click = action, right click = drop',
        'P2  ARROWS move \u00B7 ENTER action \u00B7 NUMPAD 1-7 or U I O P J K L slots',
        '    NUMPAD + or [ upgrade \u00B7 NUMPAD - or ] sell',
        'ESC pause (P too in 1P) \u00B7 M mute',
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

    const title = single ? (won ? 'VICTORY' : 'DEFEAT') : `${TEAM_COLORS[winner].name} WINS`;
    const statLine = (team: Team, label: string): string => {
      const s = world.players[team].stats;
      return `${label}  KILLS ${s.kills} \u00B7 ROCKS REFINED ${s.rocksRefined} \u00B7 UNITS SENT ${s.unitsSent}`;
    };
    const mins = Math.floor(world.time / 60);
    const secs = Math.floor(world.time % 60).toString().padStart(2, '0');

    this.view.screen = 'gameover';
    this.setMenu({
      title,
      subtitle: single ? `LEVEL ${this.playingLevel}` : 'LOCAL VERSUS',
      items: [single && won ? 'NEXT LEVEL' : 'RETRY', 'MAIN MENU'],
      selected: 0,
      lines: [
        statLine(0, single ? 'YOU ' : 'BLUE'),
        statLine(1, single ? 'AI  ' : 'RED '),
        `WAVES ${world.waveNumber} \u00B7 TIME ${mins}:${secs}`,
      ],
    });
  }

  private updateMenu(): void {
    const menu = this.view.menu;
    if (!menu) return;
    const input = this.input;
    const screen = this.view.screen;
    const count = menu.items.length;

    if (screen === 'paused' && input.wasAnyPressed(['Escape', 'KeyP'])) {
      this.resume();
      return;
    }
    if (screen === 'howto' && input.wasPressed('Escape')) {
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
