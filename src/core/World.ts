import type { GameMode, LevelDef, PaletteKey, PlayerState, Team, World } from '../types';
import { COLS, ROWS, START_MONEY } from './config';
import { createRng } from './Random';
import { createGrid, getSpawnCells } from '../systems/Grid';
import { createSpatialIndex } from '../systems/Spatial';
import { createBase, createCursor, createParticlePool } from '../entities/misc';

function createPlayer(team: Team, mode: GameMode, level: LevelDef): PlayerState {
  const isAI = mode === 'single' && team === 1;
  const palette: PaletteKey = team === 0 ? 'blue' : isAI ? 'red' : 'purple';
  const startCol = team === 0 ? 4 : COLS - 5;
  return {
    team,
    controller: team === 0 ? 'p1' : isAI ? 'ai' : 'p2',
    palette,
    money: team === 1 ? level.aiStartMoney : START_MONEY,
    research: 0,
    researched: { maxLevel3: false, swarmSpeed: false, doubleHarvest: false },
    selectedTower: 'laser',
    cursor: createCursor(startCol, Math.floor(ROWS / 2)),
    queue: [],
    spawnCells: getSpawnCells(team),
    unitHpMult: isAI ? level.aiUnitHpMult : 1,
    incomeMult: isAI ? level.aiIncomeMult : 1,
    stats: { kills: 0, rocksRefined: 0, unitsSent: 0, moneyEarned: 0, launches: 0 },
  };
}

/** Creates a fresh world. Initial Thorium deposits are added by MeteorSystem.seedInitialDeposits (called by Game). */
export function createWorld(mode: GameMode, level: LevelDef, seed: number = Date.now()): World {
  const rng = createRng(seed);
  const grid = createGrid(seed);
  const n = grid.cols * grid.rows;
  return {
    mode,
    level,
    grid,
    flow: { version: -1, dist: [new Int32Array(n).fill(-1), new Int32Array(n).fill(-1)] },
    spatial: createSpatialIndex(),
    bases: [createBase(0), createBase(1)],
    players: [createPlayer(0, mode, level), createPlayer(1, mode, level)],
    towers: [],
    units: [],
    harvesters: [],
    projectiles: [],
    beams: [],
    rings: [],
    rocks: [],
    particles: createParticlePool(),
    texts: [],
    pendingSpawns: [],
    events: [],
    time: 0,
    waveNumber: 0,
    meteorTimer: 10,
    shake: 0,
    winner: null,
    nextId: 1,
    rng,
  };
}
