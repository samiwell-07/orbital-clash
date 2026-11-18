import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Palette } from './palettes';
import { hash2, smoothstep, valueNoise } from './noise';

const RAD = (deg: number): number => (deg * Math.PI) / 180;

function paint(geo: THREE.BufferGeometry, p: Palette, seed: number): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color(p.rock.color);
  const dark = new THREE.Color(p.rock.dark);
  const moss = new THREE.Color(p.rock.moss);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const grain = valueNoise(pos.getX(i) * 3 + seed, pos.getZ(i) * 3 + y * 2, 512, 512, seed);
    c.copy(dark).lerp(base, smoothstep(-0.2, 0.7, y) * (0.7 + 0.5 * grain));
    c.lerp(moss, smoothstep(0.5, 0.95, nor.getY(i)) * 0.5 * grain);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function blob(seed: number, radius: number, ox: number, oz: number, oy: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const pos = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = valueNoise(v.x * 2.2 + 40 + seed, v.y * 2.2 + v.z * 3.1 + 40, 512, 512, seed);
    const r = radius * (0.78 + 0.5 * n);
    v.set(ox + v.x * r * 0.9, oy + Math.max(v.y * r * 0.95, -0.12), oz + v.z * r * 0.9);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  return g;
}

function rockVariant(p: Palette, seed: number): THREE.BufferGeometry {
  const parts = [blob(seed, 0.62, 0, 0, 0.2)];
  const extra = 1 + Math.floor(hash2(seed, 1, 2) * 2);
  for (let i = 0; i < extra; i++) {
    const a = hash2(seed, i, 3) * Math.PI * 2;
    parts.push(blob(seed + i + 1, 0.3 + 0.2 * hash2(seed, i, 4), Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.15 + 0.2 * hash2(seed, i, 5)));
  }
  const geo = mergeGeometries(parts) as THREE.BufferGeometry;
  geo.computeVertexNormals();
  paint(geo, p, seed);
  return geo;
}

/** Chamfered armour block (hex / octagon / square footprint), 1 unit tall, base at y = 0. */
function metalVariant(p: Palette, sides: number, seed: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r = sides === 4 ? 0.68 : 0.52;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (sides === 4 ? Math.PI / 4 : sides === 6 ? 0 : Math.PI / 8);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.deleteAttribute('uv');
  paint(geo, p, seed);
  return geo;
}

/** A few chunky variants for instancing; style comes from the palette (displaced rock or machined metal). */
export function createRockVariants(p: Palette): THREE.BufferGeometry[] {
  if (p.rock.style === 'metal') return [6, 4, 8].map((sides, i) => metalVariant(p, sides, 10 + i));
  return [1, 2, 3, 4].map((seed) => rockVariant(p, seed * 7));
}

/** Faceted crystal cluster (3 spikes), base at y = 0. */
export function createCrystalGeometry(): THREE.BufferGeometry {
  const spikes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const h = 0.55 + 0.35 * hash2(i, 0, 77);
    const g = new THREE.ConeGeometry(0.1 + 0.04 * i, h, 5, 1);
    g.deleteAttribute('uv');
    g.translate(0, h / 2, 0);
    g.rotateZ(RAD((i - 1) * 18));
    g.rotateY(RAD(i * 120));
    g.translate(Math.cos(i * 2.1) * 0.12, 0, Math.sin(i * 2.1) * 0.12);
    spikes.push(g);
  }
  return mergeGeometries(spikes.map((g) => g.toNonIndexed())) as THREE.BufferGeometry;
}
