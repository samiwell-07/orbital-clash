import { TICK_DT, MAX_STEPS_PER_FRAME } from '@/config/constants';

/** Fixed-step accumulator. Call advance() once per rendered frame. */
export class FixedStepLoop {
  private acc = 0;
  /** Steps executed by the last advance() call. */
  lastSteps = 0;

  /** Runs stepFn for each whole tick owed; returns interpolation alpha in [0, 1). */
  advance(realDt: number, stepFn: (dt: number) => void): number {
    if (!(realDt > 0)) realDt = 0;
    this.acc += realDt;
    let steps = 0;
    while (this.acc >= TICK_DT - 1e-9 && steps < MAX_STEPS_PER_FRAME) {
      stepFn(TICK_DT);
      this.acc = Math.max(0, this.acc - TICK_DT);
      steps++;
    }
    // Spiral-of-death guard: drop time we could not simulate.
    if (this.acc >= TICK_DT) this.acc = 0;
    this.lastSteps = steps;
    return this.acc / TICK_DT;
  }

  reset(): void {
    this.acc = 0;
    this.lastSteps = 0;
  }
}

export function createLoop(): FixedStepLoop {
  return new FixedStepLoop();
}
