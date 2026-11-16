import type { Team, Tower, TowerKind, World } from '../types';
import { TILE } from '../core/config';
import { towerStats } from '../data/towers';

export function createTower(world: World, team: Team, kind: TowerKind, col: number, row: number): Tower {
  return {
    id: world.nextId++,
    team,
    kind,
    level: 0,
    col,
    row,
    x: col * TILE + TILE / 2,
    y: row * TILE + TILE / 2,
    cooldown: 0,
    targetId: null,
    angle: team === 0 ? 0 : Math.PI,
    totalSpent: towerStats(kind, 0).cost,
    refineQueue: [],
    refineProgress: 0,
    flash: 0,
    buildAnim: 0,
  };
}
