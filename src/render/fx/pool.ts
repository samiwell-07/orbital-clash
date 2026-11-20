/** Ring-buffer slot allocator with a per-frame dirty range, so GPU uploads stay partial. */
export class RingPool {
  readonly capacity: number;
  private head = 0;
  private lastIdx = -1;
  private dirtyMin = Infinity;
  private dirtyMax = -1;
  private wrapped = false;
  /** Total slots handed out since the last reset (stats and tests). */
  allocated = 0;

  constructor(capacity: number) {
    if (!(capacity > 0) || !Number.isInteger(capacity)) throw new Error('RingPool capacity must be a positive integer');
    this.capacity = capacity;
  }

  /** Returns the next slot, silently overwriting the oldest one when full. */
  alloc(): number {
    const i = this.head;
    this.head = i + 1 === this.capacity ? 0 : i + 1;
    this.allocated++;
    if (this.dirtyMax >= 0 && i < this.lastIdx) this.wrapped = true;
    this.lastIdx = i;
    this.mark(i);
    return i;
  }

  /** Flags a slot as written (fixed-slot users). */
  mark(i: number): void {
    if (i < this.dirtyMin) this.dirtyMin = i;
    if (i > this.dirtyMax) this.dirtyMax = i;
  }

  markAll(): void {
    this.dirtyMin = 0;
    this.dirtyMax = this.capacity - 1;
  }

  get dirty(): boolean {
    return this.dirtyMax >= 0;
  }

  get dirtyStart(): number {
    return this.wrapped ? 0 : Math.max(0, this.dirtyMin);
  }

  get dirtyCount(): number {
    if (this.wrapped) return this.capacity;
    return this.dirtyMax < 0 ? 0 : this.dirtyMax - this.dirtyMin + 1;
  }

  clearDirty(): void {
    this.dirtyMin = Infinity;
    this.dirtyMax = -1;
    this.wrapped = false;
  }

  reset(): void {
    this.head = 0;
    this.lastIdx = -1;
    this.allocated = 0;
    this.clearDirty();
  }
}

/** Parallel Float32Arrays (one per attribute) indexed by a RingPool slot. */
export class FloatRing {
  readonly ring: RingPool;
  readonly arrays: Float32Array[];

  constructor(capacity: number, strides: readonly number[]) {
    this.ring = new RingPool(capacity);
    this.arrays = strides.map((s) => new Float32Array(capacity * s));
  }

  get capacity(): number {
    return this.ring.capacity;
  }
}
