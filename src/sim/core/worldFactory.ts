import type { Controller, MapDef, NewGameOptions, Player, PlayerId, World } from '@/types';
import { PLAYER_IDS } from '@/types';
import { DEFAULT_HITS, DIFFICULTY_MULT, MAX_HITS, MIN_HITS } from '@/config/constants';
import { createGrid } from './grid';
import { resolveMap } from './defaultMap';
import { seedRng } from './rng';

/** Battle start thorium at strength 0.5 / normal difficulty. */
export const BASE_START_THORIUM = 500;

/** Strength 0..1 (default 0.5) maps to a 0.5x..1.5x multiplier. */
export function strengthFactor(strength: number | undefined): number {
  return 0.5 + Math.min(1, Math.max(0, strength ?? 0.5));
}

function clampHits(n: number): number {
  return Math.min(MAX_HITS, Math.max(MIN_HITS, Math.round(n)));
}

function emptyPlayer(id: PlayerId): Player {
  return {
    id,
    team: 100 + id,
    controller: 'none',
    alive: false,
    thorium: 0,
    tech: {},
    baseTx: 0,
    baseTy: 0,
    baseBuilt: false,
    hits: 0,
    maxHits: DEFAULT_HITS,
    stored: {},
    attack: { selected: null, locked: false, targetPlayer: id },
    ship: { x: 0, y: 0, vx: 0, vy: 0, cursorTx: 0, cursorTy: 0, carrying: 0 },
    stats: {
      kills: 0, unitsLost: 0, unitsLaunched: 0, thoriumEarned: 0,
      structuresBuilt: 0, basesDestroyed: 0, penaltySec: 0,
    },
  };
}

function pickMap(opts: NewGameOptions): MapDef {
  return opts.settings.mission?.map ?? resolveMap(opts.mapId ?? 'default');
}

/** Builds a fresh, empty World from the new-game options. Preplaced structures are left to the mode modules. */
export function createWorld(opts: NewGameOptions): World {
  const { settings, slots } = opts;
  const map = pickMap(opts);
  const mission = settings.mission;
  const players = PLAYER_IDS.map(emptyPlayer);
  const diff = DIFFICULTY_MULT[settings.difficulty];

  for (const slot of slots) {
    const p = players[slot.id];
    const controller: Controller = slot.controller;
    p.team = slot.team;
    p.controller = controller;
    p.alive = controller !== 'none';
    const scripted = controller === 'script';
    const f = settings.mode === 'battle' ? strengthFactor(settings.strength[slot.id]) : 1;
    const baseThorium = mission ? mission.startThorium : BASE_START_THORIUM;
    p.thorium = p.alive && !scripted ? Math.round(baseThorium * diff.thorium * f) : 0;
    const hits = scripted && mission ? mission.enemyHits[settings.difficulty] : settings.maxHits * f;
    p.maxHits = clampHits(hits);
    if (mission) {
      for (const key of mission.unlocked) p.tech[key] = true;
      // The area's own tech is usable from the start by everyone in it (humans and the scripted enemy).
      if (mission.teaches) p.tech[mission.teaches] = true;
    }

    const bt = map.baseTiles[slot.id] ?? null;
    if (bt) {
      p.baseTx = bt.tx;
      p.baseTy = bt.ty;
      p.baseBuilt = true;
    }
    const sx = bt ? bt.tx + 0.5 : map.w / 2;
    const sy = bt ? bt.ty + 0.5 : map.h / 2;
    p.ship.x = sx;
    p.ship.y = sy;
    p.ship.cursorTx = Math.floor(sx);
    p.ship.cursorTy = Math.floor(sy);
  }

  for (const slot of slots) {
    if (slot.controller === 'none') continue;
    const enemy = slots.find((s) => s.controller !== 'none' && s.team !== slot.team);
    players[slot.id].attack.targetPlayer = enemy ? enemy.id : slot.id;
  }

  const w: World = {
    tick: 0,
    timeSec: 0,
    nextId: 1,
    paused: false,
    over: false,
    winnerTeam: -1,
    settings: { ...settings, strength: [...settings.strength] },
    grid: createGrid(map),
    flows: [null, null, null, null],
    players,
    structures: new Map(),
    units: [],
    projectiles: [],
    rocks: [],
    events: [],
    rng: 0,
    timelineCursor: 0,
  };
  seedRng(w, settings.seed);
  return w;
}

/** Map actually used by a world (for renderers/modes that need rows, palette, rock count). */
export function mapForOptions(opts: NewGameOptions): MapDef {
  return pickMap(opts);
}
