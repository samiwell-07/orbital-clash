import {
  BoxGeometry, BufferGeometry, ConeGeometry, CylinderGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute,
  IcosahedronGeometry, Matrix4, OctahedronGeometry, Quaternion, Shape, SphereGeometry, Vector2, Vector3, Color,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = readonly [number, number, number];

/** One primitive in an assembled model: geometry + vertex colour + transform. */
export interface PartSpec {
  g: BufferGeometry;
  /** Vertex colour (sRGB hex), multiplied with the material colour. Default white. */
  c?: number;
  p?: V3;
  r?: V3;
  s?: V3;
  /** Keep the primitive's smooth normals (default: faceted low-poly shading). */
  smooth?: boolean;
}

/** Per-kind unit model: body (team-tinted, lit) + glow (emissive) specs, and where the team crest sits. */
export interface KindSpecs { body: PartSpec[]; glow: PartSpec[]; crestY: number; crestScale: number }

export const W = 0xffffff;
export const D = 0x4a4e58;

const M = new Matrix4();
const Q = new Quaternion();
const E = new Euler();
const P = new Vector3();
const S = new Vector3();
const C = new Color();

/** Merges primitives into one non-indexed geometry with a `color` attribute (BufferGeometryUtils). */
export function assemble(specs: readonly PartSpec[]): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const sp of specs) {
    const g = sp.g.index ? sp.g.toNonIndexed() : sp.g.clone();
    g.deleteAttribute('uv');
    const r = sp.r ?? [0, 0, 0];
    const p = sp.p ?? [0, 0, 0];
    const s = sp.s ?? [1, 1, 1];
    E.set(r[0], r[1], r[2]);
    Q.setFromEuler(E);
    g.applyMatrix4(M.compose(P.set(p[0], p[1], p[2]), Q, S.set(s[0], s[1], s[2])));
    if (!sp.smooth) g.computeVertexNormals();
    C.set(sp.c ?? 0xffffff);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; }
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  for (const g of parts) g.dispose();
  return merged;
}

export const box = (x: number, y: number, z: number): BufferGeometry => new BoxGeometry(x, y, z);
export const cyl = (rt: number, rb: number, h: number, seg = 8): BufferGeometry => new CylinderGeometry(rt, rb, h, seg, 1);
export const sph = (r: number, w = 10, h = 7): BufferGeometry => new SphereGeometry(r, w, h);
export const octa = (r: number): BufferGeometry => new OctahedronGeometry(r, 0);
export const ico = (r: number, detail = 0): BufferGeometry => new IcosahedronGeometry(r, detail);
/** Cone whose tip points +X and whose base sits at x = -len/2. */
export const coneX = (r: number, len: number, seg = 4): BufferGeometry => new ConeGeometry(r, len, seg).rotateZ(-Math.PI / 2);
/** Cylinder lying along X. */
export const cylX = (r: number, len: number, seg = 8): BufferGeometry => new CylinderGeometry(r, r, len, seg, 1).rotateZ(Math.PI / 2);

/** Flat plate in the XZ plane from (x, z) outline points, `thick` tall, centred on y = 0. */
export function slab(points: readonly (readonly [number, number])[], thick = 0.05): BufferGeometry {
  const shape = new Shape(points.map(([x, z]) => new Vector2(x, -z)));
  const g = new ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thick / 2, 0);
  return g;
}

/** Writes translation + yaw (about +Y, forward = +X rotated to (ch, 0, sh)) + scale into m, allocation free. */
export function composeYaw(
  m: Matrix4, x: number, y: number, z: number, ch: number, sh: number, sx: number, sy: number, sz: number,
): void {
  const te = m.elements;
  te[0] = ch * sx; te[1] = 0; te[2] = sh * sx; te[3] = 0;
  te[4] = 0; te[5] = sy; te[6] = 0; te[7] = 0;
  te[8] = -sh * sz; te[9] = 0; te[10] = ch * sz; te[11] = 0;
  te[12] = x; te[13] = y; te[14] = z; te[15] = 1;
}

const cache = new Map<string, BufferGeometry>();
/** Module-level geometry cache so every structure instance shares geometry. */
export function cached(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
}

export function disposeCachedGeometry(): void {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
