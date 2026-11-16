import type { GridPos, LevelDef, Team, ThoriumRock, Tower, TowerKind, UnitKind, World } from '../types';
import { COLS, MAX_QUEUE, PICKUP_RADIUS, ROWS, TILE, otherTeam } from '../core/config';
import { TOWER_DEFS, towerStats, upgradeCost } from '../data/towers';
import { RESEARCH_DEFS, UNIT_DEFS } from '../data/units';
import { cellCenter, cellIndex, getCell, inBounds, isNearBase, pixelToCell } from '../systems/Grid';
import { findPath } from '../systems/Pathfinding';
import { canBuild, canBuildBasic, tryBuild, tryUpgrade } from '../systems/BuildSystem';
import { dropRock, tryPickUpRock, tryResearch } from '../systems/EconomySystem';
import { launchWave, queueUnit } from '../systems/WaveSystem';

/** Max pathfinding calls (findPath + full canBuild checks) made by the AI per think. */
const MAX_PATH_CALLS = 80;
/** Max full (path-checked) canBuild calls when picking cells. */
const MAX_FULL_CHECKS = 10;
/** Seconds between drone rock re-targeting. */
const RETARGET_INTERVAL = 0.4;
/** Seconds the drone may carry a rock without delivering before it gives up and drops it. */
const CARRY_TIMEOUT = 10;
/** Launch whatever is buffered if nothing was launched for this long. */
const LAUNCH_TIMEOUT = 45;
/**
 * Serpentine maze template, in team-1 (right side) columns: vertical walls one tile apart,
 * each leaving a single gap that alternates between the top and bottom row.
 */
const WALL_COLS: readonly number[] = [23, 21, 19, 17, 15];
/** Own maze zone in team-1 columns (inclusive). */
const ZONE_MIN = 14;
const ZONE_MAX = 24;

type CombatKind = 'laser' | 'cannon' | 'cryo' | 'plasma';

interface Candidate {
  col: number;
  row: number;
  onRoute: boolean;
  score: number;
}

/** Computer opponent: drone collection, harvest stations, research, dense mazes and train launches. */
export class AIController {
  private thinkTimer = 0.5;
  private retargetTimer = 0;
  private targetRockId: number | null = null;
  private carryTime = 0;
  private defenseSpent = 0;
  private offenseSpent = 0;
  private pathCalls = 0;
  private lastLaunch = 0;
  private bomberThreat = 0;
  private readonly routeMark = new Uint8Array(COLS * ROWS);
  private readonly ownMark = new Uint8Array(COLS * ROWS);
  private readonly extra = new Set<number>();
  /** Match time at which a cell last failed the full (path-blocking) build check. */
  private readonly failedAt = new Map<number, number>();

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

  /** Effective difficulty (versus level 0 plays like a mid level). */
  private lvl(): number {
    return this.level.level > 0 ? this.level.level : 5;
  }

  /** Maps a team-1 column to this team's side (and back: it is an involution). */
  private mirrorCol(col: number): number {
    return this.team === 1 ? col : COLS - 1 - col;
  }

  private isOwnHalf(col: number): boolean {
    return this.team === 1 ? col >= COLS / 2 : col < COLS / 2;
  }

  private homeCell(): GridPos {
    return { col: this.mirrorCol(23), row: Math.floor(ROWS / 2) };
  }

  /** 1 = template wall cell, -1 = template gap (keep open), 0 = not part of the template. */
  private templateValue(col: number, row: number): number {
    const k = WALL_COLS.indexOf(this.mirrorCol(col));
    if (k < 0) return 0;
    const gapRow = k % 2 === 0 ? 0 : ROWS - 1;
    return row === gapRow ? -1 : 1;
  }

  private ownRefineries(world: World): Tower[] {
    const out: Tower[] = [];
    for (const t of world.towers) if (t.team === this.team && t.kind === 'refinery') out.push(t);
    return out;
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

  private spawnOf(world: World, team: Team): GridPos | null {
    const cells = world.players[team].spawnCells;
    return cells[Math.floor(cells.length / 2)] ?? null;
  }

  private stealLevel(): boolean {
    return this.level.level === 0 || this.level.level >= 4;
  }

  private spend(world: World, before: number, kind: 'defense' | 'offense'): void {
    const spent = before - world.players[this.team].money;
    if (spent <= 0) return;
    if (kind === 'defense') this.defenseSpent += spent;
    else this.offenseSpent += spent;
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
      let rock: ThoriumRock | null = null;
      if (this.targetRockId !== null) {
        for (const r of world.rocks) {
          if (r.id === this.targetRockId) {
            rock = r;
            break;
          }
        }
      }
      if (!rock || !this.isCollectable(rock) || this.retargetTimer <= 0) {
        this.retargetTimer = RETARGET_INTERVAL;
        rock = this.chooseRock(world, cursor.x, cursor.y);
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

  /** Landed, not reserved by a harvester (carried/magnet rocks are excluded by the state check). */
  private isCollectable(rock: ThoriumRock): boolean {
    return rock.alive && rock.state === 'landed' && rock.reservedBy === null;
  }

  private chooseRock(world: World, x: number, y: number): ThoriumRock | null {
    const refineries = this.ownRefineries(world);
    const home = this.homeCell();
    const homeC = cellCenter(home.col, home.row - 3);
    const steal = this.stealLevel();
    let best: ThoriumRock | null = null;
    let bestScore = Infinity;

    for (const rock of world.rocks) {
      if (!this.isCollectable(rock)) continue;
      // Without a station rocks are stockpiled at home; don't re-collect the stockpile.
      if (refineries.length === 0 && Math.hypot(rock.x - homeC.x, rock.y - homeC.y) < TILE * 2) continue;

      const ownSide = this.isOwnHalf(Math.floor(rock.x / TILE));
      if (!ownSide && !steal) continue;
      let nearEnemyMagnet = false;
      for (const er of world.towers) {
        if (er.team === this.team || er.kind !== 'refinery') continue;
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

    let bombers = 0;
    for (const u of world.units) if (u.alive && u.air && u.team !== this.team) bombers++;
    this.bomberThreat = Math.max(this.bomberThreat * 0.97, bombers);

    this.manageResearch(world);
    this.manageEconomy(world);

    const base = world.bases[this.team];
    // A damaged base shifts spending toward defense.
    const hurt = base.hp < base.maxHp * 0.6 ? 0.7 : 1;
    const aggression = Math.min(1, Math.max(0, this.level.aiAggression * hurt));
    const total = this.defenseSpent + this.offenseSpent + player.money;
    const defenseAllowance = (1 - aggression) * total - this.defenseSpent;
    const offenseAllowance = aggression * total - this.offenseSpent;

    this.manageDefense(world, defenseAllowance);
    this.manageOffense(world, offenseAllowance);
  }

  private combatCount(world: World): number {
    let n = 0;
    for (const t of world.towers) if (t.team === this.team && t.kind !== 'refinery') n++;
    return n;
  }

  // --- research

  private manageResearch(world: World): void {
    const player = world.players[this.team];
    const done = player.researched;
    const lvl = this.lvl();
    if (!done.doubleHarvest) {
      if (player.research >= RESEARCH_DEFS.doubleHarvest.cost) tryResearch(world, this.team, 'doubleHarvest');
      return;
    }
    if (!done.maxLevel3) {
      const need = lvl >= 8 ? 5 : lvl >= 4 ? 6 : 8;
      if (player.research >= RESEARCH_DEFS.maxLevel3.cost && this.combatCount(world) >= need) {
        tryResearch(world, this.team, 'maxLevel3');
      }
      return;
    }
    if (!done.swarmSpeed && player.research >= RESEARCH_DEFS.swarmSpeed.cost) tryResearch(world, this.team, 'swarmSpeed');
  }

  // --- economy

  private manageEconomy(world: World): void {
    const player = world.players[this.team];
    const refineries = this.ownRefineries(world);
    const cost = TOWER_DEFS.refinery.levels[0].cost;
    const wantCount = world.time >= 180 || player.money >= 500 ? 2 : 1;

    if (refineries.length < wantCount && player.money >= cost) {
      const spot = this.findRefinerySpot(world, refineries);
      if (spot) tryBuild(world, this.team, 'refinery', spot.col, spot.row);
      return;
    }

    for (const r of refineries) {
      const up = upgradeCost(r.kind, r.level);
      if (up === null || (r.level === 1 && !player.researched.maxLevel3)) continue;
      const reserve = 160 + 80 * r.level - this.lvl() * 6;
      if (player.money >= up + reserve) {
        tryUpgrade(world, this.team, r.col, r.row);
        return;
      }
    }
  }

  private findRefinerySpot(world: World, existing: Tower[]): GridPos | null {
    // Stations sit inside the template walls (they block like any tower), first one low, second one high.
    const preferLow = existing.length === 0 ? true : existing[0]!.row < ROWS / 2;
    const targetRow = preferLow ? ROWS - 3 : 2;
    const candidates: { col: number; row: number; score: number }[] = [];
    for (let c1 = 18; c1 <= ZONE_MAX; c1++) {
      const col = this.mirrorCol(c1);
      for (let row = 0; row < ROWS; row++) {
        const tv = this.templateValue(col, row);
        if (tv < 0) continue;
        const score = Math.abs(row - targetRow) + (tv === 1 ? 0 : 4) + Math.abs(c1 - 21) * 0.5 + world.rng() * 0.3;
        candidates.push({ col, row, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score);
    let checks = 0;
    for (let i = 0; i < candidates.length && i < 40; i++) {
      const c = candidates[i]!;
      if (!canBuildBasic(world, this.team, 'refinery', c.col, c.row).ok) continue;
      if (checks++ >= MAX_FULL_CHECKS || this.pathCalls >= MAX_PATH_CALLS) break;
      if (this.fullCheck(world, 'refinery', c.col, c.row)) return c;
    }
    return null;
  }

  // --- defense

  private chooseTowerKind(world: World, counts: Record<CombatKind, number>, total: number): CombatKind {
    if (total < 3) return 'laser';
    const plasmaOk = world.time >= 110 || total >= 12;
    const antiAir = counts.laser + counts.plasma;
    if (this.bomberThreat > 0.5 && antiAir < total * 0.6 + this.bomberThreat * 0.5) {
      return plasmaOk && counts.plasma * 2 < counts.laser ? 'plasma' : 'laser';
    }
    const targets: Record<CombatKind, number> = plasmaOk
      ? { laser: 0.42, cannon: 0.2, cryo: 0.13, plasma: 0.25 }
      : { laser: 0.62, cannon: 0.24, cryo: 0.14, plasma: 0 };
    if (total < 6) targets.cryo = 0;
    let best: CombatKind = 'laser';
    let bestDeficit = -Infinity;
    for (const k of ['laser', 'cannon', 'cryo', 'plasma'] as const) {
      const deficit = targets[k] * (total + 1) - counts[k];
      if (targets[k] > 0 && deficit > bestDeficit) {
        bestDeficit = deficit;
        best = k;
      }
    }
    return best;
  }

  private manageDefense(world: World, allowance: number): void {
    const player = world.players[this.team];
    const spawn = this.spawnOf(world, otherTeam(this.team));
    if (!spawn) return;
    const route = this.path(world, spawn, this.team);
    if (!route) return;

    const counts: Record<CombatKind, number> = { laser: 0, cannon: 0, cryo: 0, plasma: 0 };
    let total = 0;
    for (const t of world.towers) {
      if (t.team !== this.team || t.kind === 'refinery') continue;
      counts[t.kind]++;
      total++;
    }

    const kind = this.chooseTowerKind(world, counts, total);
    const cost = TOWER_DEFS[kind].levels[0].cost;
    // Keep a minimal defense even when the budget leans on offense.
    const urgent = total < 4 + Math.floor(world.time / 60);
    const canAfford = player.money >= cost && (allowance >= cost || urgent);

    // Upgrade candidate: tower covering the most route cells.
    const lv3 = player.researched.maxLevel3;
    let bestTower: Tower | null = null;
    let bestCover = 0;
    for (const t of world.towers) {
      if (t.team !== this.team || t.kind === 'refinery') continue;
      if (t.level >= 2 || (t.level === 1 && !lv3)) continue;
      const cover = this.coverage(t.col, t.row, towerStats(t.kind, t.level).range, route) * (1 + t.level * 0.3);
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

    if (up !== null && total >= 8 && allowance >= up && world.rng() < 0.25 + Math.min(0.4, total * 0.01)) {
      if (upgrade()) return;
    }

    let built = 0;
    if (canAfford) built = this.buildMaze(world, kind, spawn, route, allowance);
    if (built === 0 && up !== null && (allowance - cost >= up || player.money > 500)) upgrade();
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

  /** Route cells where the direction changes (where mortars/frost shine). */
  private bends(route: readonly GridPos[]): GridPos[] {
    const out: GridPos[] = [];
    for (let i = 1; i < route.length - 1; i++) {
      const a = route[i - 1]!;
      const b = route[i]!;
      const c = route[i + 1]!;
      if (b.col - a.col !== c.col - b.col || b.row - a.row !== c.row - b.row) out.push(b);
    }
    return out;
  }

  private ownNeighbors(world: World, col: number, row: number): number {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const nc = col + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const nr = row + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (nr < 0 || nr >= ROWS) {
        n += 0.6; // map edge anchors walls
        continue;
      }
      const cell = getCell(world.grid, nc, nr);
      if (!cell) continue;
      if (cell.type === 'rock') n += 0.6;
      else if (this.ownMark[cellIndex(world.grid, nc, nr)] === 1) n += 1;
    }
    return n;
  }

  /** Index of the first template wall (nearest the base first) that still has open cells. */
  private focusWall(world: World): number {
    for (let k = 0; k < WALL_COLS.length; k++) {
      const col = this.mirrorCol(WALL_COLS[k]!);
      let open = 0;
      for (let row = 0; row < ROWS; row++) {
        if (this.templateValue(col, row) !== 1 || isNearBase(col, row)) continue;
        const cell = getCell(world.grid, col, row);
        if (!cell || cell.type !== 'empty' || cell.towerId !== null) continue;
        const failed = this.failedAt.get(cellIndex(world.grid, col, row));
        if (failed === undefined || world.time - failed > 20) open++;
      }
      if (open > 0) return k;
    }
    return -1;
  }

  /** Scores maze cells and builds the best ones. Returns the number of towers built. */
  private buildMaze(world: World, kind: CombatKind, spawn: GridPos, route: GridPos[], allowance: number): number {
    const grid = world.grid;
    const player = world.players[this.team];
    const lvl = this.lvl();
    const skill = Math.min(1, (lvl - 1) / 9);
    const mark = this.routeMark;
    mark.fill(0);
    for (const p of route) mark[cellIndex(grid, p.col, p.row)] = 1;
    this.ownMark.fill(0);
    for (const t of world.towers) if (t.team === this.team) this.ownMark[cellIndex(grid, t.col, t.row)] = 1;

    const range = towerStats(kind, 0).range;
    const bendCells = kind === 'cannon' || kind === 'cryo' ? this.bends(route) : null;
    const antiAir = kind === 'laser' || kind === 'plasma';
    const airRow = (this.spawnOf(world, otherTeam(this.team))?.row ?? ROWS / 2) + 0.5;
    const airWeight = antiAir ? Math.min(3, this.bomberThreat * 0.25) : 0;
    const noise = 0.4 + 2.5 * (1 - skill);
    const templateW = 1 + 2.5 * skill;
    const focus = this.focusWall(world);

    const cands: Candidate[] = [];
    for (let c1 = ZONE_MIN; c1 <= ZONE_MAX; c1++) {
      const col = this.mirrorCol(c1);
      for (let row = 0; row < ROWS; row++) {
        const cell = getCell(grid, col, row);
        if (!cell || cell.type !== 'empty' || cell.towerId !== null || isNearBase(col, row)) continue;
        const tv = this.templateValue(col, row);
        if (tv < 0) continue;
        const idx = cellIndex(grid, col, row);
        const onRoute = mark[idx] === 1;
        let nearRoute = onRoute;
        for (let k = 0; k < 4 && !nearRoute; k++) {
          const nc = col + (k === 0 ? 1 : k === 1 ? -1 : 0);
          const nr = row + (k === 2 ? 1 : k === 3 ? -1 : 0);
          if (inBounds(grid, nc, nr) && mark[cellIndex(grid, nc, nr)] === 1) nearRoute = true;
        }
        const adj = this.ownNeighbors(world, col, row);
        if (!nearRoute && adj < 1 && tv !== 1) continue;
        if (!canBuildBasic(world, this.team, kind, col, row).ok) continue;

        let score = this.coverage(col, row, range, route) * 0.5 + adj * 1.5;
        // Template wall cells build long S-curves; corridor cells would clog them.
        if (tv === 1) {
          const k = WALL_COLS.indexOf(this.mirrorCol(col));
          score += templateW * (k === focus ? 4 : k === focus + 1 ? 1.5 : 0.5);
        } else score -= 3 * skill;
        if (bendCells) score += this.coverage(col, row, range, bendCells) * 1.5;
        if (airWeight > 0) {
          const dr = Math.abs(row + 0.5 - airRow);
          if (dr <= range) score += airWeight * Math.sqrt(range * range - dr * dr);
        }
        score += world.rng() * noise;
        cands.push({ col, row, onRoute, score });
      }
    }
    if (cands.length === 0) return 0;

    // Path gain only exists for cells on the current route; evaluate the most promising ones.
    const onRoute = cands.filter((c) => c.onRoute).sort((a, b) => b.score - a.score);
    const baseLen = route.length;
    const evalBudget = MAX_PATH_CALLS - this.pathCalls - MAX_FULL_CHECKS - 2;
    for (let i = 0; i < onRoute.length; i++) {
      const c = onRoute[i]!;
      if (i >= evalBudget) {
        c.score -= 2;
        continue;
      }
      this.extra.clear();
      this.extra.add(cellIndex(grid, c.col, c.row));
      const np = this.path(world, spawn, this.team, this.extra);
      if (!np) {
        c.score = -Infinity;
        continue;
      }
      const gain = np.length - baseLen;
      c.score += gain * 4 + (this.coverage(c.col, c.row, range, np) - this.coverage(c.col, c.row, range, route)) * 0.5;
      if (gain <= 0) c.score -= 1;
    }

    cands.sort((a, b) => b.score - a.score);
    const maxBuilds = Math.min(4, 1 + Math.floor(lvl / 3));
    const cost = TOWER_DEFS[kind].levels[0].cost;
    let built = 0;
    let checks = 0;
    let budget = allowance;
    for (const c of cands) {
      if (c.score === -Infinity || built >= maxBuilds) break;
      // After the first build the route may change, so only off-route cells stay valid.
      if (built > 0 && c.onRoute) continue;
      if (built > 0 && (budget < cost || player.money < cost)) break;
      if (checks++ >= MAX_FULL_CHECKS || this.pathCalls >= MAX_PATH_CALLS) break;
      if (!this.fullCheck(world, kind, c.col, c.row)) {
        this.failedAt.set(cellIndex(grid, c.col, c.row), world.time);
        continue;
      }
      const before = player.money;
      if (tryBuild(world, this.team, kind, c.col, c.row)) {
        this.spend(world, before, 'defense');
        budget -= before - player.money;
        built++;
      }
    }
    return built;
  }

  // --- offense

  private manageOffense(world: World, allowance: number): void {
    const player = world.players[this.team];
    const target = Math.min(MAX_QUEUE, Math.max(1, this.level.aiLaunchSize));

    if (world.time >= 12 && player.queue.length < target) {
      const weights = this.unitWeights(world);
      let budget = allowance;
      for (let guard = 0; guard < 40 && player.queue.length < target; guard++) {
        const kind = this.pickUnit(world, weights);
        const def = UNIT_DEFS[kind];
        if (budget < def.packCost || player.money < def.packCost) break;
        if (player.queue.length + def.packSize > MAX_QUEUE) break;
        const before = player.money;
        if (!queueUnit(world, this.team, kind)) break;
        this.spend(world, before, 'offense');
        budget -= before - player.money;
      }
    }

    const len = player.queue.length;
    if (len >= target || (len > 0 && world.time - this.lastLaunch >= LAUNCH_TIMEOUT)) {
      if (launchWave(world, this.team)) this.lastLaunch = world.time;
    }
  }

  private unitWeights(world: World): Record<UnitKind, number> {
    const enemy = otherTeam(this.team);
    let lasers = 0;
    let cannons = 0;
    let cryos = 0;
    let antiAir = 0;
    let ground = 0;
    const spawn = this.spawnOf(world, this.team);
    const route = spawn && this.pathCalls < MAX_PATH_CALLS ? this.path(world, spawn, enemy) : null;
    for (const t of world.towers) {
      if (t.team !== enemy || t.kind === 'refinery') continue;
      const w = 1 + t.level * 0.5;
      if (t.kind === 'laser' || t.kind === 'plasma') antiAir += w;
      else ground += w;
      if (route && this.coverage(t.col, t.row, towerStats(t.kind, t.level).range, route) === 0) continue;
      if (t.kind === 'laser' || t.kind === 'plasma') lasers += w;
      else if (t.kind === 'cannon') cannons += w;
      else cryos += w;
    }
    const lvl = this.lvl();
    return {
      shielded: 1 + lasers * 0.5,
      scout: 2 + cannons * 0.5 - cryos * 0.15,
      tank: 1 + cryos * 0.6 + world.time / 120,
      bomber: world.time < 60 ? 0 : 0.3 + Math.max(0, ground - antiAir * 0.5) * 0.5 + (antiAir < 3 ? 1 : 0) + lvl * 0.05,
    };
  }

  private pickUnit(world: World, w: Record<UnitKind, number>): UnitKind {
    const s = Math.max(0.1, w.scout);
    const t = Math.max(0.1, w.tank);
    const sh = Math.max(0.1, w.shielded);
    const b = Math.max(0, w.bomber);
    const r = world.rng() * (s + t + sh + b);
    if (r < s) return 'scout';
    if (r < s + t) return 'tank';
    if (r < s + t + sh) return 'shielded';
    return 'bomber';
  }
}
