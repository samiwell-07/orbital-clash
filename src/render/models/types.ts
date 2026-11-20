import type { Group } from 'three';
import type { SimEvent, World, Rock, Unit } from '@/types';

export interface Pos2 { x: number; y: number }

/** Reusable id -> position lookup for tower aiming (units + rocks), filled lazily once per frame. */
export class TargetIndex {
  private readonly map = new Map<number, Pos2>();
  private dirty = true;
  private world: World | null = null;

  beginFrame(world: World): void {
    this.world = world;
    this.dirty = true;
  }

  private fill(): void {
    const w = this.world;
    if (!w) return;
    this.map.clear();
    const units: readonly Unit[] = w.units;
    for (let i = 0; i < units.length; i++) this.map.set(units[i].id, units[i]);
    const rocks: readonly Rock[] = w.rocks;
    for (let i = 0; i < rocks.length; i++) this.map.set(rocks[i].id, rocks[i]);
    this.dirty = false;
  }

  get(id: number): Pos2 | undefined {
    if (this.dirty) this.fill();
    return this.map.get(id);
  }
}

export interface FrameInfo {
  world: World;
  alpha: number;
  now: number;
  dt: number;
  events: readonly SimEvent[];
  targets: TargetIndex;
}

/** One drawable subsystem of the models layer. */
export interface ModelSystem {
  readonly group: Group;
  load(world: World): void;
  update(f: FrameInfo): void;
  dispose(): void;
}
