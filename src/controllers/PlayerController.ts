import type { Team, World } from '../types';
import type { Input } from '../core/Input';
import { COLS, CURSOR_REPEAT, DRONE_LERP, HUD_TOP, MAP_H, MAP_W, PICKUP_RADIUS, ROWS, TILE } from '../core/config';
import { SLOT_ACTIONS } from '../data/units';
import { TOWER_KINDS } from '../data/towers';
import { getTowerAt, tryBuild, trySell, tryUpgrade } from '../systems/BuildSystem';
import { dropRock, findRockNear, tryPickUpRock } from '../systems/EconomySystem';
import { queueUnit } from '../systems/WaveSystem';
import { hitTestBuildMenu } from '../ui/BuildMenu';

export interface KeyBindings {
  up: readonly string[];
  down: readonly string[];
  left: readonly string[];
  right: readonly string[];
  action: readonly string[];
  /** 7 slots (see SLOT_ACTIONS); each accepts any of its codes. */
  slots: readonly (readonly string[])[];
  upgrade: readonly string[];
  sell: readonly string[];
  prevTower: readonly string[];
  nextTower: readonly string[];
}

export const P1_BINDINGS: KeyBindings = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  action: ['Space'],
  slots: [['Digit1'], ['Digit2'], ['Digit3'], ['Digit4'], ['Digit5'], ['Digit6'], ['Digit7']],
  upgrade: ['KeyR'],
  sell: ['KeyF'],
  prevTower: ['KeyQ'],
  nextTower: ['KeyE'],
};

export const P2_BINDINGS: KeyBindings = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  action: ['Enter', 'NumpadEnter'],
  slots: [
    ['Numpad1', 'KeyU'],
    ['Numpad2', 'KeyI'],
    ['Numpad3', 'KeyO'],
    ['Numpad4', 'KeyP'],
    ['Numpad5', 'KeyJ'],
    ['Numpad6', 'KeyK'],
    ['Numpad7', 'KeyL'],
  ],
  upgrade: ['NumpadAdd', 'BracketLeft'],
  sell: ['NumpadSubtract', 'BracketRight'],
  prevTower: [],
  nextTower: [],
};

/** Delay before keyboard auto-repeat kicks in (seconds). */
const REPEAT_DELAY = 0.22;
const FAIL_FLASH = 0.3;

/** Human player: keyboard cursor (and optional mouse) driving the collector drone. */
export class PlayerController {
  /** True while the drone follows the mouse pointer instead of the cell center. */
  private mouseActive = false;

  constructor(
    public readonly team: Team,
    public readonly bindings: KeyBindings,
    public readonly useMouse: boolean,
  ) {}

  update(world: World, input: Input, dt: number): void {
    const player = world.players[this.team];
    const cursor = player.cursor;
    const b = this.bindings;

    this.updateKeyboardMovement(world, input, dt);
    if (this.useMouse) this.updateMouse(world, input);

    for (let i = 0; i < b.slots.length; i++) {
      const codes = b.slots[i];
      if (codes && input.wasAnyPressed(codes)) this.useSlot(world, i);
    }

    if (b.prevTower.length > 0 && input.wasAnyPressed(b.prevTower)) this.cycleTower(world, -1);
    if (b.nextTower.length > 0 && input.wasAnyPressed(b.nextTower)) this.cycleTower(world, 1);

    if (input.wasAnyPressed(b.action)) this.doAction(world);
    if (input.wasAnyPressed(b.upgrade)) this.fail(world, !tryUpgrade(world, this.team, cursor.col, cursor.row));
    if (input.wasAnyPressed(b.sell)) this.fail(world, !trySell(world, this.team, cursor.col, cursor.row));

    const tx = this.mouseActive ? clamp(input.mouse.x, 0, MAP_W - 1) : (cursor.col + 0.5) * TILE;
    const ty = this.mouseActive ? clamp(input.mouse.y - HUD_TOP, 0, MAP_H - 1) : (cursor.row + 0.5) * TILE;
    const k = 1 - Math.exp(-DRONE_LERP * dt);
    cursor.x += (tx - cursor.x) * k;
    cursor.y += (ty - cursor.y) * k;
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
    const mapY = m.y - HUD_TOP;
    const overMap = m.inside && m.x >= 0 && m.x < MAP_W && mapY >= 0 && mapY < MAP_H;

    if (overMap && (m.moved || m.leftPressed || m.rightPressed)) {
      cursor.col = clamp(Math.floor(m.x / TILE), 0, COLS - 1);
      cursor.row = clamp(Math.floor(mapY / TILE), 0, ROWS - 1);
      this.mouseActive = true;
    } else if (!overMap && m.moved) {
      this.mouseActive = false;
    }

    if (m.leftPressed) {
      if (overMap) {
        // Snap the drone to the pointer so pickups/drops happen exactly where clicked.
        cursor.x = m.x;
        cursor.y = mapY;
        this.doAction(world);
      } else {
        const hit = hitTestBuildMenu(m.x, m.y, world.mode);
        if (hit && hit.team === this.team) this.useSlot(world, hit.slot);
      }
    }

    if (m.rightPressed && cursor.carryingRockId !== null) dropRock(world, this.team);
  }

  private useSlot(world: World, slot: number): void {
    const action = SLOT_ACTIONS[slot];
    if (!action) return;
    if (action.type === 'build') world.players[this.team].selectedTower = action.kind;
    else this.fail(world, !queueUnit(world, this.team, action.kind));
  }

  private cycleTower(world: World, dir: number): void {
    const player = world.players[this.team];
    const idx = TOWER_KINDS.indexOf(player.selectedTower);
    const n = TOWER_KINDS.length;
    const next = TOWER_KINDS[(idx + dir + n) % n];
    if (next) player.selectedTower = next;
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
