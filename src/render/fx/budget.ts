import type { FxKind } from './eventRouter';

interface Limit {
  /** Max accepted events of this kind per rendered frame. */
  perFrame: number;
  /** Sustained events per second (token bucket refill). */
  rate: number;
  burst: number;
}

const OPEN = { perFrame: 99, rate: 1e9, burst: 1e9 };

/** Per-kind throttles. Rare, important effects are never starved; spammy ones are capped. */
export const LIMITS: Readonly<Record<FxKind, Limit>> = {
  explosion: { perFrame: 12, rate: 45, burst: 16 },
  hitSparks: { perFrame: 10, rate: 50, burst: 14 },
  collapse: { perFrame: 6, rate: 12, burst: 8 },
  unitPop: { perFrame: 9999, rate: 1e9, burst: 1e9 },
  rockBurst: { perFrame: 6, rate: 8, burst: 6 },
  thoriumPulse: { perFrame: 4, rate: 12, burst: 6 },
  shot: { perFrame: 14, rate: 100, burst: 24 },
  beam: { perFrame: 99, rate: 1e9, burst: 1e9 },
  baseHit: { perFrame: 4, rate: 6, burst: 4 },
  baseDestroyed: OPEN,
  teleport: { perFrame: 6, rate: 30, burst: 10 },
  launch: { perFrame: 6, rate: 20, burst: 8 },
  build: { perFrame: 8, rate: 20, burst: 8 },
  recycle: { perFrame: 4, rate: 10, burst: 4 },
  repair: { perFrame: 4, rate: 10, burst: 4 },
  rockSpawn: { perFrame: 4, rate: 10, burst: 4 },
  token: { perFrame: 6, rate: 12, burst: 6 },
};

const KINDS = Object.keys(LIMITS) as FxKind[];

/** Spawn caps and LOD. Deterministic: all time comes from beginFrame(). */
export class FxBudget {
  /** Particle-count multiplier applied by emitters (0.25..1). */
  lod = 1;
  private readonly tokens: Record<string, number> = {};
  private readonly frameCount: Record<string, number> = {};
  private last = -1;

  constructor() {
    this.reset();
  }

  reset(): void {
    for (const k of KINDS) {
      this.tokens[k] = LIMITS[k].burst;
      this.frameCount[k] = 0;
    }
    this.last = -1;
    this.lod = 1;
  }

  /** eventCount = events this frame; unitCount = live units (LOD for huge armies). */
  beginFrame(now: number, eventCount: number, unitCount = 0): void {
    const dt = this.last < 0 ? 0 : Math.min(0.25, Math.max(0, now - this.last));
    this.last = now;
    for (const k of KINDS) {
      const l = LIMITS[k];
      this.tokens[k] = Math.min(l.burst, this.tokens[k] + l.rate * dt);
      this.frameCount[k] = 0;
    }
    this.lod = computeLod(eventCount, unitCount);
  }

  /** True if an event of this kind may spawn effects now (consumes budget). */
  allow(kind: FxKind): boolean {
    const l = LIMITS[kind];
    if (this.frameCount[kind] >= l.perFrame || this.tokens[kind] < 1) return false;
    this.frameCount[kind]++;
    this.tokens[kind]--;
    return true;
  }
}

/** Heavy event frames or huge armies shrink particle counts down to a quarter. */
export function computeLod(eventCount: number, unitCount: number): number {
  const events = 1 - Math.max(0, eventCount - 10) / 60;
  const units = 1 - Math.max(0, unitCount - 800) / 1600;
  return Math.min(1, Math.max(0.25, Math.min(events, units)));
}

const CELLS = 16;
const CELL_SIZE = 3;

/**
 * Batches unit deaths: thousands per second collapse into at most one pop per 3x3-tile cell per
 * flush interval, scaled by how many died there.
 */
export class PopBatcher {
  private readonly key = new Int32Array(CELLS).fill(-1);
  private readonly n = new Uint16Array(CELLS);
  private readonly sx = new Float32Array(CELLS);
  private readonly sy = new Float32Array(CELLS);
  private readonly owner = new Int8Array(CELLS);
  private nextFlush = 0;

  constructor(private readonly interval = 0.07) {}

  add(x: number, y: number, owner: number): void {
    const k = (Math.floor(x / CELL_SIZE) & 255) * 256 + (Math.floor(y / CELL_SIZE) & 255);
    let slot = -1;
    for (let i = 0; i < CELLS; i++) {
      if (this.key[i] === k) { slot = i; break; }
      if (slot < 0 && this.key[i] < 0) slot = i;
    }
    if (slot < 0) slot = k % CELLS;
    if (this.key[slot] !== k) {
      this.key[slot] = k;
      this.n[slot] = 0;
      this.sx[slot] = 0;
      this.sy[slot] = 0;
      this.owner[slot] = owner;
    }
    this.n[slot]++;
    this.sx[slot] += x;
    this.sy[slot] += y;
  }

  /** Emits at most one pop per occupied cell once the interval elapsed. */
  flush(now: number, pop: (x: number, y: number, n: number, owner: number) => void): void {
    if (now < this.nextFlush) return;
    this.nextFlush = now + this.interval;
    for (let i = 0; i < CELLS; i++) {
      if (this.key[i] < 0) continue;
      const c = this.n[i];
      pop(this.sx[i] / c, this.sy[i] / c, c, this.owner[i]);
      this.key[i] = -1;
    }
  }

  reset(): void {
    this.key.fill(-1);
    this.nextFlush = 0;
  }
}
