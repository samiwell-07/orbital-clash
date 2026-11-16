import type { GridPos, LevelDef, Team, ThoriumRock, Tower, TowerKind, UnitKind, World } from '../types';
import { COLS, MAX_QUEUE, PICKUP_RADIUS, ROWS, TILE, otherTeam } from '../core/config';
import { TOWER_DEFS, towerStats, upgradeCost } from '../data/towers';
import { UNIT_DEFS } from '../data/units';
import { cellCenter, cellIndex, inBounds, pixelToCell } from '../systems/Grid';
import { findPath } from '../systems/Pathfinding';
import { canBuild, canBuildBasic, tryBuild, tryUpgrade } from '../systems/BuildSystem';
import { dropRock, tryPickUpRock } from '../systems/EconomySystem';
import { queueUnit } from '../systems/WaveSystem';

/** Max pathfinding calls made by the AI per think. */
const MAX_PATH_CALLS = 80;
/** Max full (path-checked) canBuild calls when picking a cell; each costs one budget unit. */
const MAX_FULL_CHECKS = 12;
/** Seconds between drone rock re-targeting. */
const RETARGET_INTERVAL = 0.4;
/** Seconds the drone may carry a rock without delivering before it gives up and drops it. */
const CARRY_TIMEOUT = 10;

interface Candidate {
  col: number;
  row: number;
  score: number;
}

/** Computer opponent: mazes towers, places/upgrades refineries, drives its drone to collect rocks, buys waves. */
export class AIController {
  private thinkTimer = 0.5;
  private retargetTimer = 0;
  private targetRockId: number | null = null;
  private carryTime = 0;
  private defenseSpent = 0;
  private offenseSpent = 0;
  private pathCalls = 0;

  constructor(public readonly team: Team, public readonly level: LevelDef) {}

  update(world: World, dt: number): void {
    if (world.winner !== null) return;
    this.updateDrone(world, dt);
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer += Math.max(0.1, this.level.aiThinkInterval);
      this.think(world);
    }
  }

  // ------------------------------------------------------------ helpers

  /** Maps a column expressed for team 1 (right side) to this team's side. */
  private mirrorCol(col: number): number {
    return this.team === 1 ? col : COLS - 1 - col;
  }

  private isOwnHalf(col: number): boolean {
    return this.team === 1 ? col >= COLS / 2 : col < COLS / 2;
  }

  private homeCell(): GridPos {
    return { col: this.mirrorCol(24), row: Math.floor(ROWS / 2) };
  }

  private ownRefineries(world: World): Tower[] {
    return world.towers.filter((t) => t.team === this.team && t.kind === 'refinery');
  }

  private path(world: World, start: GridPos, goal: Team, extra?: ReadonlySet<number>): GridPos[] | null {
    this.pathCalls++;
    return findPath(world.grid, start, goal, extra);
  }

  /** Full canBuild (includes the path-blocking flood fill), counted against the pathfinding budget. */
  private fullCheck(world: World, kind: TowerKind, col: number, row: number): boolean {
    this.pathCalls++;
    return canBuild(world, this.team, kind, col, row).ok;
  }

  private enemySpawn(world: World): GridPos | null {
    const cells = world.players[otherTeam(this.team)].spawnCells;
    if (cells.length === 0) return null;
    return cells[Math.floor(cells.length / 2)] ?? null;
  }

  private stealLevel(): boolean {
    return this.level.level === 0 || this.level.level >= 4;
  }

  // ------------------------------------------------------------ drone

  private updateDrone(world: World, dt: number): void {
    const cursor = world.players[this.team].cursor;
    let tx: number;
    let ty: number;

    if (cursor.carryingRockId !== null) {
      this.carryTime += dt;
      const refineries = this.ownRefineries(world);
      if (refineries.length > 0 && this.carryTime < CARRY_TIMEOUT) {
        let best = refineries[0]!;
        let bestD = Infinity;
        for (const r of refineries) {
          const d = Math.hypot(r.x - cursor.x, r.y - cursor.y);
          if (d < bestD) {
            bestD = d;
            best = r;
          }
        }
        tx = best.x;
        ty = best.y;
      } else {
        const home = this.homeCell();
        const c = cellCenter(home.col, home.row - 3);
        tx = c.x;
        ty = c.y;
        if (this.carryTime >= CARRY_TIMEOUT || Math.hypot(tx - cursor.x, ty - cursor.y) < TILE * 0.5) {
          dropRock(world, this.team);
          this.carryTime = 0;
        }
      }
    } else {
      this.carryTime = 0;
      this.retargetTimer -= dt;
      let rock = this.targetRockId !== null ? world.rocks.find((r) => r.id === this.targetRockId) : undefined;
      if (!rock || !rock.alive || rock.state !== 'landed' || this.retargetTimer <= 0) {
        this.retargetTimer = RETARGET_INTERVAL;
        rock = this.chooseRock(world, cursor.x, cursor.y) ?? undefined;
        this.targetRockId = rock ? rock.id : null;
      }
      if (rock) {
        tx = rock.x;
        ty = rock.y;
        if (Math.hypot(rock.x - cursor.x, rock.y - cursor.y) <= PICKUP_RADIUS * 0.8) {
          if (tryPickUpRock(world, this.team)) this.targetRockId = null;
        }
      } else {
        const home = this.homeCell();
        const c = cellCenter(home.col, home.row);
        tx = c.x + Math.sin(world.time * 0.7) * TILE * 1.2;
        ty = c.y + Math.sin(world.time * 1.1) * TILE * 1.5;
      }
    }

    const dx = tx - cursor.x;
    const dy = ty - cursor.y;
    const dist = Math.hypot(dx, dy);
    const step = this.level.aiDroneSpeed * TILE * dt;
    if (dist <= step || dist < 0.001) {
      cursor.x = tx;
      cursor.y = ty;
    } else {
      cursor.x += (dx / dist) * step;
      cursor.y += (dy / dist) * step;
    }
    cursor.x = Math.min(COLS * TILE - 1, Math.max(0, cursor.x));
    cursor.y = Math.min(ROWS * TILE - 1, Math.max(0, cursor.y));
    const cell = pixelToCell(cursor.x, cursor.y);
    cursor.col = Math.min(COLS - 1, Math.max(0, cell.col));
    cursor.row = Math.min(ROWS - 1, Math.max(0, cell.row));
  }

  private chooseRock(world: World, x: number, y: number): ThoriumRock | null {
    const refineries = this.ownRefineries(world);
    const enemyRefineries = world.towers.filter((t) => t.team !== this.team && t.kind === 'refinery');
    const home = this.homeCell();
    const homeC = cellCenter(home.col, home.row - 3);
    const steal = this.stealLevel();
    let best: ThoriumRock | null = null;
    let bestScore = Infinity;

    for (const rock of world.rocks) {
      if (!rock.alive || rock.state !== 'landed') continue;
      // Without a refinery rocks are stockpiled at home; don't re-collect the stockpile.
      if (refineries.length === 0 && Math.hypot(rock.x - homeC.x, rock.y - homeC.y) < TILE * 2) continue;

      const rockCol = Math.floor(rock.x / TILE);
      const ownSide = this.isOwnHalf(rockCol);
      if (!ownSide && !steal) continue;
      let nearEnemyMagnet = false;
      for (const er of enemyRefineries) {
        const radius = (towerStats('refinery', er.level).magnetRadius + 1) * TILE;
        if (Math.hypot(er.x - rock.x, er.y - rock.y) < radius) {
          nearEnemyMagnet = true;
          break;
        }
      }
      if (nearEnemyMagnet) continue;

      let destDist = Math.hypot(rock.x - homeC.x, rock.y - homeC.y);
      for (const r of refineries) {
        const reach = Math.max(0, Math.hypot(r.x - rock.x, r.y - rock.y) - towerStats('refinery', r.level).magnetRadius * TILE);
        if (reach < destDist) destDist = reach;
      }
      let score = Math.hypot(rock.x - x, rock.y - y) + destDist;
      if (!ownSide) score = score * 1.5 + TILE * 4;
      if (score < bestScore) {
        bestScore = score;
        best = rock;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ decisions

  private think(world: World): void {
    this.pathCalls = 0;
    const player = world.players[this.team];
    this.manageEconomy(world);

    const aggression = Math.min(1, Math.max(0, this.level.aiAggression));
    const total = this.defenseSpent + this.offenseSpent + player.money;
    const defenseAllowance = (1 - aggression) * total - this.defenseSpent;
    const offenseAllowance = aggression * total - this.offenseSpent;

    this.manageDefense(world, defenseAllowance);
    this.manageOffense(world, offenseAllowance);
  }

  private spend(world: World, before: number, kind: 'defense' | 'offense'): void {
    const spent = before - world.players[this.team].money;
    if (spent <= 0) return;
    if (kind === 'defense') this.defenseSpent += spent;
    else this.offenseSpent += spent;
  }

  // --- economy

  private manageEconomy(world: World): void {
    const player = world.players[this.team];
    const refineries = this.ownRefineries(world);
    const cost = TOWER_DEFS.refinery.levels[0].cost;
    const wantCount = world.waveNumber >= 3 ? 2 : 1;

    if (refineries.length < wantCount && player.money >= cost) {
      const spot = this.findRefinerySpot(world, refineries);
      if (spot) tryBuild(world, this.team, 'refinery', spot.col, spot.row);
      return;
    }

    for (const r of refineries) {
      const up = upgradeCost(r.kind, r.level);
      if (up !== null && player.money >= up + 220 + 60 * r.level) {
        tryUpgrade(world, this.team, r.col, r.row);
        return;
      }
    }
  }

  private findRefinerySpot(world: World, existing: Tower[]): GridPos | null {
    const home = this.homeCell();
    const spawn = this.enemySpawn(world);
    const onPath = new Set<number>();
    if (spawn) {
      const p = this.path(world, spawn, this.team);
      if (p) for (const c of p) onPath.add(cellIndex(world.grid, c.col, c.row));
    }
    // A second refinery goes to the opposite vertical half from the first one.
    const preferTop = existing.length > 0 ? existing[0]!.row >= ROWS / 2 : world.rng() < 0.5;
    const targetRow = existing.length === 0 ? home.row + (preferTop ? -2 : 2) : preferTop ? 4 : ROWS - 5;

    const candidates: Candidate[] = [];
    for (let dc = -4; dc <= 3; dc++) {
      const col = home.col + (this.team === 1 ? dc : -dc);
      for (let row = 1; row < ROWS - 1; row++) {
        if (!inBounds(world.grid, col, row)) continue;
        if (onPath.has(cellIndex(world.grid, col, row))) continue;
        let pathNeighbor = false;
        for (let k = 0; k < 4 && !pathNeighbor; k++) {
          const nc = col + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const nr = row + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (inBounds(world.grid, nc, nr) && onPath.has(cellIndex(world.grid, nc, nr))) pathNeighbor = true;
        }
        const score = Math.abs(dc) + Math.abs(row - targetRow) * 0.8 + (pathNeighbor ? 2 : 0) + world.rng() * 0.3;
        candidates.push({ col, row, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    let checks = 0;
    for (let i = 0; i < candidates.length && i < 30; i++) {
      const c = candidates[i]!;
      if (!canBuildBasic(world, this.team, 'refinery', c.col, c.row).ok) continue;
      if (checks++ >= MAX_FULL_CHECKS || this.pathCalls >= MAX_PATH_CALLS) break;
      if (this.fullCheck(world, 'refinery', c.col, c.row)) return c;
    }
    return null;
  }

  // --- defense

  private chooseTowerKind(world: World): TowerKind {
    let lasers = 0;
    let cannons = 0;
    let cryos = 0;
    for (const t of world.towers) {
      if (t.team !== this.team) continue;
      if (t.kind === 'laser') lasers++;
      else if (t.kind === 'cannon') cannons++;
      else if (t.kind === 'cryo') cryos++;
    }
    const count = lasers + cannons + cryos;
    // Enemy shielded units shrug off lasers, so lean on cannons against them.
    let shielded = 0;
    for (const u of world.units) if (u.alive && u.team !== this.team && u.kind === 'shielded') shielded++;
    if (count < 2) return 'laser';
    if (count >= 4 && cryos < Math.floor(count / 5) + 1) return 'cryo';
    if (cannons * 3 < count + 1 || (shielded >= 3 && cannons <= lasers)) return 'cannon';
    return 'laser';
  }

  private manageDefense(world: World, allowance: number): void {
    const player = world.players[this.team];
    const spawn = this.enemySpawn(world);
    if (!spawn) return;
    const basePath = this.path(world, spawn, this.team);
    if (!basePath) return;

    const kind = this.chooseTowerKind(world);
    const cost = TOWER_DEFS[kind].levels[0].cost;
    // Always keep a minimal defense even when the budget is spent on offense early.
    const ownCombat = world.towers.filter((t) => t.team === this.team && t.kind !== 'refinery').length;
    const canAfford = player.money >= cost && (allowance >= cost || (ownCombat < 2 && world.waveNumber >= 1));

    // Find the tower covering the most path cells (upgrade candidate).
    let bestTower: Tower | null = null;
    let bestCover = 0;
    for (const t of world.towers) {
      if (t.team !== this.team || t.kind === 'refinery' || t.level >= 2) continue;
      const cover = this.coverage(t.col, t.row, towerStats(t.kind, t.level).range, basePath) * (1 + t.level * 0.3);
      if (cover > bestCover) {
        bestCover = cover;
        bestTower = t;
      }
    }
    const up = bestTower ? upgradeCost(bestTower.kind, bestTower.level) : null;
    const upgrade = (): boolean => {
      if (!bestTower || up === null || player.money < up) return false;
      const before = player.money;
      if (!tryUpgrade(world, this.team, bestTower.col, bestTower.row)) return false;
      this.spend(world, before, 'defense');
      return true;
    };

    // Once a basic maze exists, sometimes invest in upgrades instead of new towers.
    if (up !== null && ownCombat >= 6 && allowance >= up && world.rng() < 0.35 + ownCombat * 0.02) {
      if (upgrade()) return;
    }

    if (canAfford) {
      const best = this.bestBuildCell(world, kind, spawn, basePath);
      if (best) {
        const before = player.money;
        if (tryBuild(world, this.team, kind, best.col, best.row)) {
          this.spend(world, before, 'defense');
          return;
        }
      }
    }

    if (up !== null && (allowance - cost >= up || player.money > 450)) upgrade();
  }
  private coverage(col: number, row: number, range: number, path: readonly GridPos[]): number {
    const r2 = (range + 0.3) * (range + 0.3);
    let n = 0;
    for (const p of path) {
      const dc = p.col - col;
      const dr = p.row - row;
      if (dc * dc + dr * dr <= r2) n++;
    }
    return n;
  }

  private bestBuildCell(world: World, kind: TowerKind, spawn: GridPos, basePath: GridPos[]): Candidate | null {
    const grid = world.grid;
    const lvl = Math.max(1, this.level.level || 5);
    const randomCount = Math.min(60, 20 + lvl * 4);
    // Leave room in the budget for the full checks on the best candidates.
    const maxEval = Math.min(MAX_PATH_CALLS - this.pathCalls - MAX_FULL_CHECKS, 25 + lvl * 5);
    const minCol = this.team === 1 ? 17 : 2;
    const maxCol = this.team === 1 ? 29 : 14;
    const seen = new Set<number>();
    const cells: GridPos[] = [];
    const add = (col: number, row: number): void => {
      if (col < minCol || col > maxCol || !inBounds(grid, col, row)) return;
      const idx = cellIndex(grid, col, row);
      if (seen.has(idx)) return;
      seen.add(idx);
      cells.push({ col, row });
    };

    for (const p of basePath) {
      add(p.col + 1, p.row);
      add(p.col - 1, p.row);
      add(p.col, p.row + 1);
      add(p.col, p.row - 1);
    }
    // Shuffle path-adjacent cells so the evaluation cap doesn't always favor the same end.
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(world.rng() * (i + 1));
      const tmp = cells[i]!;
      cells[i] = cells[j]!;
      cells[j] = tmp;
    }
    for (let i = 0; i < randomCount; i++) {
      add(minCol + Math.floor(world.rng() * (maxCol - minCol + 1)), Math.floor(world.rng() * ROWS));
    }

    const range = towerStats(kind, 0).range;
    const baseLen = basePath.length;
    const extra = new Set<number>();
    const scored: Candidate[] = [];
    let evaluated = 0;

    for (const c of cells) {
      if (evaluated >= maxEval) break;
      if (!canBuildBasic(world, this.team, kind, c.col, c.row).ok) continue;
      evaluated++;
      extra.clear();
      extra.add(cellIndex(grid, c.col, c.row));
      const newPath = this.path(world, spawn, this.team, extra);
      if (!newPath) continue;
      const growth = newPath.length - baseLen;
      const cover = this.coverage(c.col, c.row, range, newPath);
      let score = growth * 3 + cover;
      if (kind === 'cryo') score += cover * 0.8 + growth;
      if (kind === 'cannon') score += cover * 0.3;
      // Slight preference for cells closer to our base (enemy units are funneled there).
      const baseCol = this.mirrorCol(30);
      score -= Math.abs(c.col - baseCol) * 0.1;
      score += world.rng() * 0.5;
      if (cover === 0 && growth <= 0) score -= 5;
      scored.push({ col: c.col, row: c.row, score });
    }
    // Only the best-scored cells get the (more expensive) path-blocking check, best first.
    scored.sort((a, b) => b.score - a.score);
    for (let i = 0; i < scored.length && i < MAX_FULL_CHECKS && this.pathCalls < MAX_PATH_CALLS; i++) {
      const c = scored[i]!;
      if (this.fullCheck(world, kind, c.col, c.row)) return c;
    }
    return null;
  }

  // --- offense

  private manageOffense(world: World, allowance: number): void {
    const player = world.players[this.team];
    if (world.waveTimer > this.level.waveInterval * 0.6) return;

    const target = Math.min(MAX_QUEUE, Math.floor(3 + world.waveNumber * 1.2 + Math.max(1, this.level.level) * 0.6));
    if (player.queue.length >= target) return;

    const weights = this.unitWeights(world);
    let budget = allowance;
    let guard = 0;
    while (player.queue.length < target && guard++ < MAX_QUEUE) {
      const kind = this.pickUnit(world, weights);
      const cost = UNIT_DEFS[kind].cost;
      const batch = kind === 'scout' ? 3 : 1;
      if (budget < cost || player.money < cost) break;
      let bought = 0;
      for (let i = 0; i < batch && budget >= cost && player.money >= cost && player.queue.length < MAX_QUEUE; i++) {
        const before = player.money;
        if (!queueUnit(world, this.team, kind)) break;
        this.spend(world, before, 'offense');
        budget -= before - player.money;
        bought++;
      }
      if (bought === 0) break;
    }
  }

  private unitWeights(world: World): Record<UnitKind, number> {
    const enemy = otherTeam(this.team);
    let lasers = 0;
    let cannons = 0;
    let cryos = 0;
    const spawn = teamSpawn(world, this.team);
    const route = spawn && this.pathCalls < MAX_PATH_CALLS ? this.path(world, spawn, enemy) : null;
    for (const t of world.towers) {
      if (t.team !== enemy || t.kind === 'refinery') continue;
      if (route && this.coverage(t.col, t.row, towerStats(t.kind, t.level).range, route) === 0) continue;
      const w = 1 + t.level * 0.5;
      if (t.kind === 'laser') lasers += w;
      else if (t.kind === 'cannon') cannons += w;
      else cryos += w;
    }
    return {
      shielded: 1 + lasers * 0.7,
      scout: 1 + cannons * 0.6 - cryos * 0.2,
      tank: 1.5 + cryos * 0.4 + world.waveNumber * 0.05,
    };
  }

  private pickUnit(world: World, w: Record<UnitKind, number>): UnitKind {
    const s = Math.max(0.1, w.scout);
    const t = Math.max(0.1, w.tank);
    const sh = Math.max(0.1, w.shielded);
    const r = world.rng() * (s + t + sh);
    if (r < s) return 'scout';
    if (r < s + t) return 'tank';
    return 'shielded';
  }
}

function teamSpawn(world: World, team: Team): GridPos | null {
  const cells = world.players[team].spawnCells;
  return cells[Math.floor(cells.length / 2)] ?? null;
}
