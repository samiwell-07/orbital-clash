import { Group, Mesh, SphereGeometry } from 'three';
import type { Material } from 'three';
import { cached } from '@/render/instancing/kit';
import { hash01 } from '@/render/instancing/colorTables';
import { TOP } from './common';

/** Three rising dark puffs shown on badly damaged structures (hp < 25 %). */
export class SmokePlume {
  readonly group = new Group();
  private readonly puffs: Mesh[] = [];

  constructor(material: Material, private readonly seed: number) {
    const geo = cached('smoke:puff', () => new SphereGeometry(1, 6, 5));
    for (let i = 0; i < 3; i++) {
      const m = new Mesh(geo, material);
      this.puffs.push(m);
      this.group.add(m);
    }
  }

  update(t: number, amount: number): void {
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.45 + i / 3 + hash01(this.seed)) % 1;
      const p = this.puffs[i];
      p.position.set(Math.sin(phase * 5 + i * 2) * 0.08, TOP + 0.25 + phase * 0.7, Math.cos(phase * 4 + i) * 0.08);
      p.scale.setScalar(Math.max(0.001, amount * (0.05 + 0.2 * Math.sin(phase * Math.PI))));
    }
  }
}
