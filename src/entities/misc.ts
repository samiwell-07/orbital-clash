import type { Base, CursorState, FloatingText, Particle, Team } from '../types';
import { BASE_COL, BASE_H, BASE_HP, BASE_ROW, BASE_W, MAX_PARTICLES, TILE } from '../core/config';

export function createBase(team: Team): Base {
  const col = BASE_COL[team];
  return {
    team,
    col,
    row: BASE_ROW,
    w: BASE_W,
    h: BASE_H,
    x: (col + BASE_W / 2) * TILE,
    y: (BASE_ROW + BASE_H / 2) * TILE,
    hp: BASE_HP,
    maxHp: BASE_HP,
    hitFlash: 0,
  };
}

export function createCursor(col: number, row: number): CursorState {
  return {
    col,
    row,
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    carryingRockId: null,
    failFlash: 0,
    moveRepeat: 0,
  };
}

export function createParticlePool(size: number = MAX_PARTICLES): Particle[] {
  const pool: Particle[] = [];
  for (let i = 0; i < size; i++) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: '#fff', drag: 1 });
  }
  return pool;
}

export function createFloatingText(x: number, y: number, text: string, color: string, life = 1.2): FloatingText {
  return { x, y, text, color, life, maxLife: life, vy: -28 };
}
