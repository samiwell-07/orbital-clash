/**
 * Sinks the emitters write into. All coordinates are three.js world space:
 * x = tile x, y = height, z = tile y. `spawn` is an absolute fx-clock time (future = delayed).
 */
export interface PointSink {
  emit(
    spawn: number, x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    life: number, size0: number, size1: number,
    color0: number, color1: number, alpha: number, accelY: number,
  ): void;
}

/** Instanced quad: beam / tracer (a -> b ribbon) or flat ground ring (centred on a). */
export interface QuadSink {
  emit(
    spawn: number, ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
    life: number, w0: number, w1: number,
    color: number, alpha: number, aux: number,
  ): void;
}

/** Fixed-slot quads rewritten every frame (continuous laser beams). */
export interface LiveSink {
  readonly capacity: number;
  set(slot: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, width: number, color: number, alpha: number): void;
  clear(slot: number): void;
}

export interface FxSinks {
  glow: PointSink;
  spark: PointSink;
  smoke: PointSink;
  shard: PointSink;
  ring: QuadSink;
  beam: QuadSink;
  tracer: QuadSink;
  live: LiveSink;
}

export interface Fx extends FxSinks {
  /** Fx clock (seconds). */
  now: number;
  /** Particle-count multiplier 0.25..1 from the budget. */
  lod: number;
  rnd(): number;
  shake(amount: number): void;
  flash(color: number, strength: number): void;
}

/** Scales a nominal particle count by the current LOD (never below 1). */
export function count(fx: Fx, n: number): number {
  return Math.max(1, Math.round(n * fx.lod));
}

export type Rng = () => number;

/** Small deterministic PRNG (xorshift32) for visual randomness. */
export function createRng(seed = 0x9e3779b9): Rng {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
