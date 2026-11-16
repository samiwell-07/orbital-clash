import type { GameMode, LevelDef, PlayerState, Team, World } from '../types';
import { COLS, ROWS, START_MONEY } from './config';
import { createRng } from './Random';
import { createGrid, getSpawnCells } from '../systems/Grid';
import { createBase, createCursor, createParticlePool } from '../entities/misc';

function createPlayer(team: Team, mode: GameMode, level: LevelDef): PlayerState {
  const isAI = mode === 'single' && team === 1;
  const startCol = team === 0 ? 4 : COLS - 5;
  return {
    team,
    controller: team === 0 ? 'p1' : isAI ? 'ai' : 'p2',
    money: team === 1 ? level.aiStartMoney : START_MONEY,
    selectedTower: 'laser',
    cursor: createCursor(startCol, Math.floor(ROWS / 2)),
    queue: [],
    spawnCells: getSpawnCells(team),
    unitHpMult: isAI ? level.aiUnitHpMult : 1,
    incomeMult: isAI ? level.aiIncomeMult : 1,
    stats: { kills: 0, rocksRefined: 0, unitsSent: 0, moneyEarned: 0 },
  };
}

export function createWorld(mode: GameMode, level: LevelDef, seed: number = Date.now()): World {
  const rng = createRng(seed);
  return {
    mode,
    level,
    grid: createGrid(seed),
    bases: [createBase(0), createBase(1)],
    players: [createPlayer(0, mode, level), createPlayer(1, mode, level)],
    towers: [],
    units: [],
    projectiles: [],
    beams: [],
    rings: [],
    rocks: [],
    particles: createParticlePool(),
    texts: [],
    pendingSpawns: [],
    events: [],
    time: 0,
    waveTimer: level.waveInterval,
    waveNumber: 0,
    meteorTimer: 6,
    shake: 0,
    winner: null,
    nextId: 1,
    rng,
  };
}
