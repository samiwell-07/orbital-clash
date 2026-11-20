import type * as THREE from 'three';

type Disposable = { dispose(): void };

/** Collects GPU resources created by a layer so one call frees them all. */
export class Bin {
  private items: Disposable[] = [];

  add<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  addAll(items: readonly Disposable[]): void {
    this.items.push(...items);
  }

  disposeAll(): void {
    for (const i of this.items) i.dispose();
    this.items = [];
  }
}

export function clearGroup(group: THREE.Group): void {
  group.clear();
}
