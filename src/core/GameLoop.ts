import { MAX_FRAME_DT, SIM_DT } from './config';

const MAX_STEPS_PER_FRAME = 5;
const FPS_SMOOTHING = 0.1;

/**
 * requestAnimationFrame loop with a fixed-step accumulator:
 * `update(SIM_DT)` runs at a fixed 60 Hz, `endFrame()` once after the frame's steps,
 * then `render(fps)` once per frame.
 */
export class GameLoop {
  /** Smoothed frames-per-second estimate. */
  fps = 60;
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: (fps: number) => void,
    private readonly endFrame: () => void = () => {},
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  get isRunning(): boolean {
    return this.running;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    const realDt = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (realDt > 0) {
      const instant = 1 / realDt;
      this.fps += (instant - this.fps) * FPS_SMOOTHING;
    }

    this.accumulator += Math.min(realDt, MAX_FRAME_DT);
    let steps = 0;
    while (this.accumulator >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
      this.update(SIM_DT);
      this.accumulator -= SIM_DT;
      steps++;
    }
    // Drop leftover time rather than spiralling when the step cap was hit.
    if (steps === MAX_STEPS_PER_FRAME && this.accumulator >= SIM_DT) this.accumulator = 0;

    this.endFrame();
    this.render(this.fps);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
