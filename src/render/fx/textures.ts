import * as THREE from 'three';
import { createRng } from './types';

export type CanvasLike = HTMLCanvasElement | OffscreenCanvas;
export type CanvasFactory = (width: number, height: number) => CanvasLike;

export const defaultCanvasFactory: CanvasFactory = (w, h) => {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
};

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface FxTextures {
  glow: THREE.Texture;
  spark: THREE.Texture;
  smoke: THREE.Texture;
  ring: THREE.Texture;
  beam: THREE.Texture;
  dispose(): void;
}

function paint(factory: CanvasFactory, w: number, h: number, draw: (g: Ctx, w: number, h: number) => void): THREE.Texture {
  const canvas = factory(w, h);
  const g = canvas.getContext('2d') as Ctx | null;
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function radial(g: Ctx, size: number, stops: readonly (readonly [number, number])[]): void {
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(255,255,255,${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
}

/** Soft disc with a hot core. */
function drawGlow(g: Ctx, s: number): void {
  radial(g, s, [[0, 1], [0.12, 0.85], [0.35, 0.35], [0.65, 0.08], [1, 0]]);
}

/** Four-point star plus core: reads as a spark/glint when small. */
function drawSpark(g: Ctx, s: number): void {
  const c = s / 2;
  g.globalCompositeOperation = 'lighter';
  for (const [sx, sy] of [[1, 0.09], [0.09, 1]] as const) {
    g.save();
    g.translate(c, c);
    g.scale(sx, sy);
    g.translate(-c, -c);
    radial(g, s, [[0, 1], [0.5, 0.45], [1, 0]]);
    g.restore();
  }
  radial(g, s, [[0, 1], [0.16, 0.7], [0.4, 0], [1, 0]]);
}

/** Cloudy puff: overlapping soft blobs with a deterministic layout. */
function drawSmoke(g: Ctx, s: number): void {
  const rnd = createRng(1234);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * s * 0.26;
    const r = s * (0.1 + rnd() * 0.14);
    const x = s / 2 + Math.cos(a) * d;
    const y = s / 2 + Math.sin(a) * d;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${0.12 + rnd() * 0.1})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, s, s);
  }
  g.globalCompositeOperation = 'destination-in';
  radial(g, s, [[0, 1], [0.6, 0.85], [1, 0]]);
}

/** Thin bright band near the rim with a faint filled disc inside. */
function drawRing(g: Ctx, s: number): void {
  radial(g, s, [[0, 0], [0.55, 0.04], [0.8, 0.18], [0.9, 1], [0.95, 0.5], [1, 0]]);
}

/** Across-beam gradient (v axis) with a mild fade toward both ends (u axis). */
function drawBeam(g: Ctx, w: number, h: number): void {
  const across = g.createLinearGradient(0, 0, 0, h);
  across.addColorStop(0, 'rgba(255,255,255,0)');
  across.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  across.addColorStop(0.5, 'rgba(255,255,255,1)');
  across.addColorStop(0.65, 'rgba(255,255,255,0.45)');
  across.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = across;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const ends = g.createLinearGradient(0, 0, w, 0);
  ends.addColorStop(0, 'rgba(255,255,255,0.35)');
  ends.addColorStop(0.12, 'rgba(255,255,255,1)');
  ends.addColorStop(0.88, 'rgba(255,255,255,1)');
  ends.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = ends;
  g.fillRect(0, 0, w, h);
}

export function createFxTextures(factory: CanvasFactory = defaultCanvasFactory): FxTextures {
  const glow = paint(factory, 128, 128, (g, w) => drawGlow(g, w));
  const spark = paint(factory, 128, 128, (g, w) => drawSpark(g, w));
  const smoke = paint(factory, 128, 128, (g, w) => drawSmoke(g, w));
  const ring = paint(factory, 256, 256, (g, w) => drawRing(g, w));
  const beam = paint(factory, 64, 64, (g, w, h) => drawBeam(g, w, h));
  return { glow, spark, smoke, ring, beam, dispose: () => [glow, spark, smoke, ring, beam].forEach((t) => t.dispose()) };
}
