import type { BuildAction, Team, World } from '../types';
import type { Input } from '../core/Input';
import type { KeyBindings } from '../data/controls';
import { COLS, CURSOR_REPEAT, DRONE_LERP, MAP_H, MAP_W, MAP_X, MAP_Y, PICKUP_RADIUS, ROWS, TILE } from '../core/config';
import { getTowerAt, tryBuild, trySell, tryUpgrade } from '../systems/BuildSystem';
import { dropRock, findRockNear, tryPickUpRock, tryResearch } from '../systems/EconomySystem';
import { launchWave, queueUnit } from '../systems/WaveSystem';
import { hitTestSidebar } from '../ui/Sidebar';

/** Delay before keyboard auto-repeat kicks in (seconds). */
const REPEAT_DELAY = 0.22;
const FAIL_FLASH = 0.3;

/** Human player: keyboard cursor (and optional mouse) driving the collector ship. */
export class PlayerController {
  /** True while the ship follows the mouse pointer instead of the cell center. */
  private mouseActive = false;

  constructor(
    public readonly team: Team,
    public readonly bindings: KeyBindings,
    public readonly useMouse: boolean,
  ) {}

  update(world: World, input: Input, dt: number): void {
    const cursor = world.players[this.team].cursor;
    const b = this.bindings;

    this.updateKeyboardMovement(world, input, dt);
    if (this.useMouse) this.updateMouse(world, input);

    for (let i = 0; i < b.slots.length; i++) {
      const slot = b.slots[i];
      if (slot && input.wasAnyPressed(slot.codes)) this.perform(world, slot.action);
    }
    if (input.wasAnyPressed(b.act)) this.doAction(world);

    const m = input.mouse;
    const tx = this.mouseActive ? clamp(m.x - MAP_X, 0, MAP_W - 1) : (cursor.col + 0.5) * TILE;
    const ty = this.mouseActive ? clamp(m.y - MAP_Y, 0, MAP_H - 1) : (cursor.row + 0.5) * TILE;
    const k = 1 - Math.exp(-DRONE_LERP * dt);
    cursor.x += (tx - cursor.x) * k;
    cursor.y += (ty - cursor.y) * k;
  }

  /** Executes one sidebar/hotkey action for this team. */
  perform(world: World, action: BuildAction): void {
    const team = this.team;
    const cursor = world.players[team].cursor;
    switch (action.type) {
      case 'build':
        world.players[team].selectedTower = action.kind;
        break;
      case 'send':
        this.fail(world, !queueUnit(world, team, action.kind));
        break;
      case 'launch':
        this.fail(world, !launchWave(world, team));
        break;
      case 'upgrade':
        this.fail(world, !tryUpgrade(world, team, cursor.col, cursor.row));
        break;
      case 'sell':
        this.fail(world, !trySell(world, team, cursor.col, cursor.row));
        break;
      case 'research':
        this.fail(world, !tryResearch(world, team, action.kind));
        break;
    }
  }

  private updateKeyboardMovement(world: World, input: Input, dt: number): void {
    const b = this.bindings;
    const cursor = world.players[this.team].cursor;

    let px = 0;
    let py = 0;
    if (input.wasAnyPressed(b.left)) px -= 1;
    if (input.wasAnyPressed(b.right)) px += 1;
    if (input.wasAnyPressed(b.up)) py -= 1;
    if (input.wasAnyPressed(b.down)) py += 1;

    if (px !== 0 || py !== 0) {
      this.moveCursor(world, px, py);
      cursor.moveRepeat = REPEAT_DELAY;
      return;
    }

    let hx = 0;
    let hy = 0;
    if (input.isAnyDown(b.left)) hx -= 1;
    if (input.isAnyDown(b.right)) hx += 1;
    if (input.isAnyDown(b.up)) hy -= 1;
    if (input.isAnyDown(b.down)) hy += 1;
    if (hx === 0 && hy === 0) {
      cursor.moveRepeat = 0;
      return;
    }
    cursor.moveRepeat -= dt;
    if (cursor.moveRepeat <= 0) {
      this.moveCursor(world, hx, hy);
      cursor.moveRepeat += CURSOR_REPEAT;
      if (cursor.moveRepeat <= 0) cursor.moveRepeat = CURSOR_REPEAT;
    }
  }

  private moveCursor(world: World, dx: number, dy: number): void {
    const cursor = world.players[this.team].cursor;
    cursor.col = clamp(cursor.col + dx, 0, COLS - 1);
    cursor.row = clamp(cursor.row + dy, 0, ROWS - 1);
    this.mouseActive = false;
  }

  private updateMouse(world: World, input: Input): void {
    const m = input.mouse;
    const cursor = world.players[this.team].cursor;
    const mx = m.x - MAP_X;
    const my = m.y - MAP_Y;
    const overMap = m.inside && mx >= 0 && mx < MAP_W && my >= 0 && my < MAP_H;

    if (overMap && (m.moved || m.leftPressed || m.rightPressed)) {
      cursor.col = clamp(Math.floor(mx / TILE), 0, COLS - 1);
      cursor.row = clamp(Math.floor(my / TILE), 0, ROWS - 1);
      this.mouseActive = true;
    } else if (!overMap && m.moved) {
      this.mouseActive = false;
    }

    if (m.leftPressed) {
      if (overMap) {
        // Snap the ship to the pointer so pickups/drops happen exactly where clicked.
        cursor.x = mx;
        cursor.y = my;
        this.doAction(world);
      } else {
        const action = hitTestSidebar(m.x, m.y, world.mode);
        if (action) this.perform(world, action);
      }
    }

    if (m.rightPressed && overMap) {
      const tower = getTowerAt(world, cursor.col, cursor.row);
      if (tower && tower.team === this.team) this.fail(world, !trySell(world, this.team, cursor.col, cursor.row));
      else if (cursor.carryingRockId !== null) dropRock(world, this.team);
    }
  }

  private doAction(world: World): void {
    const player = world.players[this.team];
    const cursor = player.cursor;
    if (cursor.carryingRockId !== null) {
      dropRock(world, this.team);
      return;
    }
    if (findRockNear(world, cursor.x, cursor.y, PICKUP_RADIUS) && tryPickUpRock(world, this.team)) return;
    const tower = getTowerAt(world, cursor.col, cursor.row);
    if (tower && tower.team === this.team) {
      this.fail(world, !tryUpgrade(world, this.team, cursor.col, cursor.row));
      return;
    }
    this.fail(world, !tryBuild(world, this.team, player.selectedTower, cursor.col, cursor.row));
  }

  private fail(world: World, failed: boolean): void {
    if (failed) world.players[this.team].cursor.failFlash = FAIL_FLASH;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
