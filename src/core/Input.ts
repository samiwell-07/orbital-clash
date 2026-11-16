import { CANVAS_H, CANVAS_W } from './config';

/** Keys whose default browser action (scrolling, focus change) must be suppressed. */
const GAME_KEYS = new Set<string>([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Tab', 'Enter', 'NumpadEnter',
  'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5',
  'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
  'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadDecimal',
  'BracketLeft', 'BracketRight',
]);

export interface MouseState {
  /** Canvas LOGICAL coordinates (0..CANVAS_W, 0..CANVAS_H). */
  x: number;
  y: number;
  inside: boolean;
  /** Moved since the last frame. */
  moved: boolean;
  leftDown: boolean;
  rightDown: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
}

/**
 * Keyboard + mouse state.
 * Edges (key presses, clicks, mouse moves) are buffered as "pending" until a simulation step
 * calls `beginStep()`. The first step of a frame sees them; later steps of the same frame don't,
 * so an edge is consumed exactly once. `endFrame()` hides the frame's edges again.
 * If a frame runs no simulation step, pending edges are kept for the next one.
 */
export class Input {
  readonly mouse: MouseState = {
    x: 0, y: 0, inside: false, moved: false,
    leftDown: false, rightDown: false, leftPressed: false, rightPressed: false,
  };

  private readonly down = new Set<string>();
  private pendingPressed = new Set<string>();
  private visiblePressed = new Set<string>();
  private pendingLeft = false;
  private pendingRight = false;
  private pendingMoved = false;
  private steppedThisFrame = false;
  private gestureCallbacks: (() => void)[] = [];
  private gestureSeen = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.visiblePressed.has(code);
  }

  isAnyDown(codes: readonly string[]): boolean {
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  wasAnyPressed(codes: readonly string[]): boolean {
    for (const c of codes) if (this.visiblePressed.has(c)) return true;
    return false;
  }

  /** Registers a callback fired once on the first keydown / mousedown (e.g. audio unlock). */
  onFirstGesture(cb: () => void): void {
    if (this.gestureSeen) cb();
    else this.gestureCallbacks.push(cb);
  }

  /** Call at the start of every simulation step. */
  beginStep(): void {
    if (this.steppedThisFrame) {
      this.hideEdges();
      return;
    }
    this.steppedThisFrame = true;
    const swap = this.visiblePressed;
    this.visiblePressed = this.pendingPressed;
    this.pendingPressed = swap;
    this.pendingPressed.clear();
    this.mouse.leftPressed = this.pendingLeft;
    this.mouse.rightPressed = this.pendingRight;
    this.mouse.moved = this.pendingMoved;
    this.pendingLeft = this.pendingRight = this.pendingMoved = false;
  }

  /** Call once per frame after the frame's simulation steps. */
  endFrame(): void {
    this.hideEdges();
    this.steppedThisFrame = false;
  }

  private hideEdges(): void {
    this.visiblePressed.clear();
    this.mouse.leftPressed = false;
    this.mouse.rightPressed = false;
    this.mouse.moved = false;
  }

  private readonly clear = (): void => {
    this.down.clear();
    this.pendingPressed.clear();
    this.visiblePressed.clear();
    this.pendingLeft = this.pendingRight = this.pendingMoved = false;
    this.mouse.leftDown = this.mouse.rightDown = false;
    this.mouse.leftPressed = this.mouse.rightPressed = this.mouse.moved = false;
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.clear();
  };

  private gesture(): void {
    if (this.gestureSeen) return;
    this.gestureSeen = true;
    const cbs = this.gestureCallbacks;
    this.gestureCallbacks = [];
    for (const cb of cbs) cb();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.gesture();
    if (!e.repeat && !this.down.has(e.code)) this.pendingPressed.add(e.code);
    this.down.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.down.delete(e.code);
  };

  private updateMousePos(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const x = ((e.clientX - r.left) / r.width) * CANVAS_W;
    const y = ((e.clientY - r.top) / r.height) * CANVAS_H;
    if (x !== this.mouse.x || y !== this.mouse.y) this.pendingMoved = true;
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.inside = x >= 0 && y >= 0 && x < CANVAS_W && y < CANVAS_H;
  }

  private readonly onMouseMove = (e: MouseEvent): void => {
    this.updateMousePos(e);
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    this.gesture();
    this.canvas.focus();
    this.updateMousePos(e);
    if (e.button === 0) {
      this.mouse.leftDown = true;
      this.pendingLeft = true;
    } else if (e.button === 2) {
      this.mouse.rightDown = true;
      this.pendingRight = true;
    }
    e.preventDefault();
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouse.leftDown = false;
    else if (e.button === 2) this.mouse.rightDown = false;
  };

  private readonly onMouseLeave = (): void => {
    this.mouse.inside = false;
  };
}
