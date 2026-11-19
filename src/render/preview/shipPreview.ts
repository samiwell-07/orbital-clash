import {
  ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, Scene,
  SRGBColorSpace, Sphere, Vector3, WebGLRenderer,
} from 'three';
import type { Material, Texture } from 'three';
import { PALETTE_SIZE, paletteColor } from '@/config/playerColors';
import { buildShipCraft } from '@/render/models/ship';
import { createEnvironment } from '@/render/engine/environment';

export interface ShipPreview {
  /** Renders the spinning ship in palette colour `colorIndex` and returns that colour's (cached) output canvas. */
  render(colorIndex: number, nowSec: number): HTMLCanvasElement;
  dispose(): void;
}

const FOV = 30;
const FILL = 0.7;
const SPIN_RATE = 0.8;
const TILT = 0.2;
const ELEVATION = 0.42;

/** Offscreen 3D ship turntable for the lobby: one GL context, one 2D canvas per palette colour. Null without WebGL. */
export function createShipPreview(size = 256): ShipPreview | null {
  try {
    return makePreview(Math.max(16, Math.round(size)));
  } catch {
    return null;
  }
}

function makePreview(size: number): ShipPreview | null {
  if (typeof document === 'undefined') return null;
  const glCanvas = document.createElement('canvas');
  glCanvas.width = size;
  glCanvas.height = size;
  const context = glCanvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!context) return null;

  const renderer = new WebGLRenderer({ canvas: glCanvas, context, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  let env: Texture | null = null;
  try {
    env = createEnvironment(renderer);
    scene.environment = env;
  } catch {
    env = null;
  }
  scene.add(new AmbientLight(0xffffff, 0.35), new HemisphereLight(0xbcd4ff, 0x1a1428, 0.9));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 4);
  const rim = new DirectionalLight(0x9fc8ff, 1.6);
  rim.position.set(-4, 2, -3);
  scene.add(key, rim);

  const tilt = new Group();
  tilt.rotation.z = TILT;
  const spin = new Group();
  tilt.add(spin);
  scene.add(tilt);

  const owned: Material[] = [];
  const own = <T extends Material>(m: T): T => { owned.push(m); return m; };
  const crafts: (Group | undefined)[] = new Array(PALETTE_SIZE);
  const outputs: (HTMLCanvasElement | undefined)[] = new Array(PALETTE_SIZE);

  const probe = buildShipCraft(paletteColor(0), own);
  const box = new Box3().setFromObject(probe);
  const radius = box.getBoundingSphere(new Sphere()).radius;
  const offset = box.getCenter(new Vector3()).negate();
  probe.position.copy(offset);
  crafts[0] = probe;
  spin.add(probe);

  const camera = new PerspectiveCamera(FOV, 1, 0.05, 100);
  const dist = radius / (FILL * Math.tan((FOV * Math.PI) / 360));
  camera.position.set(0, Math.sin(ELEVATION) * dist, Math.cos(ELEVATION) * dist);
  camera.lookAt(0, 0, 0);

  const craftFor = (i: number): Group => {
    let c = crafts[i];
    if (!c) {
      c = buildShipCraft(paletteColor(i), own);
      c.position.copy(offset);
      crafts[i] = c;
      spin.add(c);
    }
    return c;
  };

  const outputFor = (i: number): HTMLCanvasElement => {
    let out = outputs[i];
    if (!out) {
      out = document.createElement('canvas');
      out.width = size;
      out.height = size;
      outputs[i] = out;
    }
    return out;
  };

  let disposed = false;

  return {
    render(colorIndex: number, nowSec: number): HTMLCanvasElement {
      const i = ((Math.trunc(colorIndex) % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE || 0;
      const out = outputFor(i);
      if (disposed) return out;
      const craft = craftFor(i);
      for (const c of crafts) if (c) c.visible = c === craft;
      spin.rotation.y = nowSec * SPIN_RATE;
      tilt.position.y = Math.sin(nowSec * 2.1) * radius * 0.03;
      renderer.render(scene, camera);
      const ctx = out.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(glCanvas, 0, 0);
      }
      return out;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const m of owned) m.dispose();
      owned.length = 0;
      env?.dispose();
      for (const c of crafts) c?.removeFromParent();
      crafts.fill(undefined);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
