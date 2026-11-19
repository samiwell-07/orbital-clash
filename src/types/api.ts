import type { World, WorldSettings, System } from './world';
import type { Intent, InputApi } from './input';
import type { SimEvent } from './events';
import type { Mission } from './mission';
import type { PlayerId } from './ids';

/** Created by sim/index.ts. The only object the shell (main.ts/UI/render) needs from the simulation. */
export interface SimApi {
  world: World;
  /** Advance exactly one fixed step (1/60 s), applying the given intents first. */
  step(intents: readonly Intent[]): void;
  /** Take and clear the events produced since the last call. */
  drainEvents(): SimEvent[];
}

export interface PlayerSlot {
  id: PlayerId;
  team: number;
  controller: 'human' | 'script' | 'adaptive' | 'none';
  /** Index into PLAYER_COLORS; defaults to the player id. */
  colorIndex?: number;
}

export interface NewGameOptions {
  settings: Omit<WorldSettings, 'mission'> & { mission: Mission | null };
  slots: readonly PlayerSlot[];
  mapId?: string;
}

export type SimFactory = (opts: NewGameOptions) => SimApi;

/** Registered, ordered simulation pipeline. Each domain module exports one System. */
export type Pipeline = readonly { name: string; run: System }[];

export interface RendererApi {
  init(canvas: HTMLCanvasElement): void;
  resize(width: number, height: number): void;
  /** Called once when a new World is loaded (builds terrain, lights, palettes). */
  load(world: World): void;
  /** Draw one frame. alpha = interpolation 0..1 between fixed steps. */
  draw(world: World, alpha: number, events: readonly SimEvent[], nowSec: number): void;
  dispose(): void;
}

export interface AudioApi {
  unlock(): void;
  /** isHuman (default: everyone) keeps alien-owned tech unlocks silent. */
  handle(events: readonly SimEvent[], isHuman?: (owner: PlayerId) => boolean): void;
  music(mode: 'menu' | 'game' | 'off'): void;
  setVolume(master: number, sfx: number, music: number): void;
}

export interface HudApi {
  /** Draws 2D HUD, menus and overlays onto the overlay canvas. */
  draw(ctx: CanvasRenderingContext2D, world: World, input: InputApi, nowSec: number): void;
}
