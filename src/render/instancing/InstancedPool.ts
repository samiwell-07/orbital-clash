import {
  DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh,
} from 'three';
import type { BufferGeometry, Material, Matrix4 } from 'three';

/** Hands out indices, reusing released ones (lowest churn: LIFO). Pure logic, no three.js. */
export class SlotAllocator {
  private readonly freeList: number[] = [];
  private readonly freeSet = new Set<number>();
  private next = 0;

  alloc(): number {
    const i = this.freeList.pop();
    if (i === undefined) return this.next++;
    this.freeSet.delete(i);
    return i;
  }

  release(i: number): boolean {
    if (i < 0 || i >= this.next || this.freeSet.has(i)) return false;
    this.freeList.push(i);
    this.freeSet.add(i);
    return true;
  }

  /** One past the highest index ever handed out. */
  get highWater(): number { return this.next; }
  get used(): number { return this.next - this.freeList.length; }
  reset(): void { this.freeList.length = 0; this.freeSet.clear(); this.next = 0; }
}

/**
 * Growable InstancedMesh. Two usage modes (do not mix on one pool):
 *  - dense per-frame: begin(); push()...; end()   (units, projectiles)
 *  - slotted/persistent: alloc(); setAt(); free()  (platforms, rings)
 * Matrices and colours are written straight into the attribute arrays: no per-frame allocation.
 */
export class InstancedPool {
  readonly mesh: InstancedMesh;
  readonly slots = new SlotAllocator();
  private cap: number;
  private cursor = 0;

  constructor(geometry: BufferGeometry, material: Material, capacity = 64, castShadow = false) {
    this.cap = Math.max(1, capacity);
    this.mesh = new InstancedMesh(geometry, material, this.cap);
    this.mesh.instanceMatrix = this.newMatrixAttr(new Float32Array(this.cap * 16));
    this.mesh.instanceColor = this.newColorAttr(this.filledColors(this.cap));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = false;
  }

  get capacity(): number { return this.cap; }
  get count(): number { return this.mesh.count; }

  /** Grows (doubling) so at least n instances fit; existing data is preserved. */
  ensure(n: number): void {
    if (n <= this.cap) return;
    let next = this.cap;
    while (next < n) next *= 2;
    const mats = new Float32Array(next * 16);
    mats.set(this.mesh.instanceMatrix.array as Float32Array);
    const cols = this.filledColors(next);
    cols.set(this.mesh.instanceColor!.array as Float32Array);
    this.mesh.dispose();
    this.mesh.instanceMatrix = this.newMatrixAttr(mats);
    this.mesh.instanceColor = this.newColorAttr(cols);
    this.cap = next;
  }

  begin(): void { this.cursor = 0; }

  push(m: Matrix4, r = 1, g = 1, b = 1): number {
    if (this.cursor >= this.cap) this.ensure(this.cursor + 1);
    this.write(this.cursor, m, r, g, b);
    return this.cursor++;
  }

  end(): void {
    this.mesh.count = this.cursor;
    this.mesh.visible = this.cursor > 0;
    this.flag(this.cursor);
  }

  alloc(): number {
    const i = this.slots.alloc();
    if (i >= this.cap) this.ensure(i + 1);
    if (i >= this.mesh.count) this.mesh.count = i + 1;
    return i;
  }

  setAt(i: number, m: Matrix4, r = 1, g = 1, b = 1): void {
    this.write(i, m, r, g, b);
    this.flag(this.mesh.count);
  }

  /** Releases a slot and hides it (zero matrix) until it is reused. */
  free(i: number): void {
    if (!this.slots.release(i)) return;
    const a = this.mesh.instanceMatrix.array as Float32Array;
    a.fill(0, i * 16, i * 16 + 16);
    this.flag(this.mesh.count);
  }

  clear(): void {
    this.slots.reset();
    this.cursor = 0;
    this.mesh.count = 0;
    this.mesh.visible = false;
  }

  dispose(): void { this.mesh.dispose(); this.mesh.removeFromParent(); }

  private write(i: number, m: Matrix4, r: number, g: number, b: number): void {
    m.toArray(this.mesh.instanceMatrix.array as unknown as number[], i * 16);
    const c = this.mesh.instanceColor!.array as Float32Array;
    c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
  }

  private flag(n: number): void {
    const im = this.mesh.instanceMatrix;
    const ic = this.mesh.instanceColor!;
    im.clearUpdateRanges(); ic.clearUpdateRanges();
    if (n > 0) { im.addUpdateRange(0, n * 16); ic.addUpdateRange(0, n * 3); }
    im.needsUpdate = n > 0; ic.needsUpdate = n > 0;
  }

  private filledColors(n: number): Float32Array { return new Float32Array(n * 3).fill(1); }

  private newMatrixAttr(a: Float32Array): InstancedBufferAttribute {
    const at = new InstancedBufferAttribute(a, 16);
    at.setUsage(DynamicDrawUsage);
    return at;
  }

  private newColorAttr(a: Float32Array): InstancedBufferAttribute {
    const at = new InstancedBufferAttribute(a, 3);
    at.setUsage(DynamicDrawUsage);
    return at;
  }
}
