import * as THREE from 'three';
import { type CanvasFactory, defaultCanvasFactory, putRgba } from './canvas';
import { type FloorSample, type FloorSpec, floorColors } from './floorCommon';
import { sampleHex, samplePanels } from './floorMetal';
import { sampleDunes, sampleIce, sampleLava, sampleOrganic } from './floorNatural';
import type { FloorPattern, Palette } from './palettes';

const SQ3 = Math.sqrt(3);
const HEX_PPT = 96;
const PPT = 128;

/** Pixel size of one seamless repeat and how many tiles of the map it spans. */
export function floorSpec(pattern: FloorPattern): FloorSpec {
  if (pattern === 'hex') {
    const w = 3 * 2 * 2 * HEX_PPT;
    const h = Math.round(SQ3 * 2 * 2 * HEX_PPT);
    return { w, h, tilesX: w / HEX_PPT, tilesY: h / HEX_PPT };
  }
  if (pattern === 'panels') return { w: 512, h: 512, tilesX: 4, tilesY: 4 };
  return { w: 1024, h: 1024, tilesX: 1024 / PPT, tilesY: 1024 / PPT };
}

export interface FloorBytes {
  spec: FloorSpec;
  albedo: Uint8ClampedArray;
  rough: Uint8ClampedArray;
  normal: Uint8ClampedArray;
  emissive: Uint8ClampedArray;
}

const SAMPLERS = {
  hex: sampleHex,
  panels: samplePanels,
  organic: sampleOrganic,
  dunes: sampleDunes,
  ice: sampleIce,
  lava: sampleLava,
} as const;

/** Pure CPU bake of all four floor maps (RGBA bytes); no DOM needed. */
export function bakeFloorMaps(p: Palette): FloorBytes {
  const spec = floorSpec(p.pattern);
  const { w, h } = spec;
  const colors = floorColors(p);
  const sampler = SAMPLERS[p.pattern];
  const s: FloorSample = { rgb: [0, 0, 0], rough: 0.5, h: 0, em: [0, 0, 0] };
  const albedo = new Uint8ClampedArray(w * h * 4);
  const rough = new Uint8ClampedArray(w * h * 4);
  const emissive = new Uint8ClampedArray(w * h * 4);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      sampler(s, p, colors, spec, x + 0.5, y + 0.5);
      const i = y * w + x;
      const o = i * 4;
      albedo[o] = s.rgb[0] * 255;
      albedo[o + 1] = s.rgb[1] * 255;
      albedo[o + 2] = s.rgb[2] * 255;
      albedo[o + 3] = 255;
      const r = Math.max(0.05, Math.min(1, s.rough)) * 255;
      rough[o] = rough[o + 1] = rough[o + 2] = r;
      rough[o + 3] = 255;
      emissive[o] = s.em[0] * 255;
      emissive[o + 1] = s.em[1] * 255;
      emissive[o + 2] = s.em[2] * 255;
      emissive[o + 3] = 255;
      height[i] = s.h;
    }
  }
  return { spec, albedo, rough, emissive, normal: heightToNormal(height, w, h, 3.5) };
}

/** Tangent-space normal map from a wrapping height field. */
export function heightToNormal(height: Float32Array, w: number, h: number, strength: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const yu = ((y - 1 + h) % h) * w;
    const yd = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const dx = (height[y * w + xr] - height[y * w + xl]) * strength;
      const dy = (height[yd + x] - height[yu + x]) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const o = (y * w + x) * 4;
      out[o] = (-dx * inv * 0.5 + 0.5) * 255;
      out[o + 1] = (dy * inv * 0.5 + 0.5) * 255;
      out[o + 2] = (inv * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}

export interface FloorTextures {
  spec: FloorSpec;
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  dispose(): void;
}

export function createFloorTextures(p: Palette, anisotropy: number, factory: CanvasFactory = defaultCanvasFactory): FloorTextures {
  const bytes = bakeFloorMaps(p);
  const { w, h } = bytes.spec;
  const make = (data: Uint8ClampedArray, srgb: boolean): THREE.CanvasTexture => {
    const canvas = factory(w, h);
    putRgba(canvas, data);
    const t = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = anisotropy;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return t;
  };
  const map = make(bytes.albedo, true);
  const roughnessMap = make(bytes.rough, false);
  const normalMap = make(bytes.normal, false);
  const emissiveMap = make(bytes.emissive, true);
  return {
    spec: bytes.spec,
    map,
    roughnessMap,
    normalMap,
    emissiveMap,
    dispose() {
      for (const t of [map, roughnessMap, normalMap, emissiveMap]) t.dispose();
    },
  };
}
