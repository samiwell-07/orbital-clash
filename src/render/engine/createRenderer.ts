import * as THREE from 'three';
import { MAP_H, MAP_W } from '@/config/constants';
import type { PaletteId, RendererApi, SimEvent, World } from '@/types';
import type { RenderContext, RenderLayer, RenderLayerFactory } from '../layer';
import { getPalette, resolvePaletteId } from '../terrain/palettes';
import { CAMERA_DEFAULTS } from './camera';
import { placeCamera } from './cameraRig';
import { createEnvironment } from './environment';
import { WebGLUnsupportedError } from './errors';
import { createLayerStack, type LayerStack } from './layers';
import { createLighting, type Lighting } from './lighting';
import { createPost, type Post } from './post';
import type { RendererView } from './project';
import { effectivePixelRatio, presetFor, type QualityLevel, QualityScaler } from './quality';
import { kickFor, ShakeState, type ShakeOffset } from './shake';

export interface RendererWithView extends RendererApi {
  /** Camera plus canvas size in CSS pixels; feed it to worldToScreen / screenToWorld. */
  getView(): RendererView;
  setQuality(level: QualityLevel): void;
  getQuality(): QualityLevel;
  /** Adaptive scaling lowers quality when frames stay slow; on by default. */
  setAdaptiveQuality(enabled: boolean): void;
  /** Force a map palette (the world only knows its comet id); applied on the next load(). */
  setPalette(id: PaletteId | null): void;
  getLayer<T extends RenderLayer = RenderLayer>(name: string): T | undefined;
}

interface Gpu {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lighting: Lighting;
  post: Post;
  stack: LayerStack;
  env: THREE.Texture;
}

export function createRenderer(layerFactories: readonly RenderLayerFactory[]): RendererWithView {
  let gpu: Gpu | null = null;
  let width = 1280;
  let height = 720;
  let mapW = MAP_W;
  let mapH = MAP_H;
  let forcedPalette: PaletteId | null = null;
  let adaptive = true;
  let intro = CAMERA_DEFAULTS.introSec;
  let lastNow = -1;
  let lastWall = 0;
  const shake = new ShakeState();
  const scaler = new QualityScaler('high');
  const offset: ShakeOffset = { x: 0, y: 0, roll: 0 };

  const view: RendererView = {
    get camera() {
      return needGpu().camera;
    },
    get width() {
      return width;
    },
    get height() {
      return height;
    },
  };

  function needGpu(): Gpu {
    if (!gpu) throw new Error('Renderer.init() must be called first');
    return gpu;
  }

  function applySize(): void {
    if (!gpu) return;
    const preset = presetFor(scaler.state);
    const pr = effectivePixelRatio(typeof window === 'undefined' ? 1 : window.devicePixelRatio, preset);
    gpu.gl.setPixelRatio(pr);
    gpu.gl.setSize(width, height, false);
    gpu.post.setSize(width, height, pr);
    gpu.post.applyQuality(preset);
    gpu.lighting.setShadows(preset.shadows, preset.shadowMapSize);
    gpu.camera.aspect = width / height;
    gpu.camera.updateProjectionMatrix();
  }

  function advanceCamera(dt: number): void {
    intro = Math.min(CAMERA_DEFAULTS.introSec, intro + dt);
    placeCamera(needGpu().camera, mapW, mapH, intro, offset);
  }

  function init(canvas: HTMLCanvasElement): void {
    if (gpu) return;
    let gl: THREE.WebGLRenderer;
    try {
      gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (err) {
      throw new WebGLUnsupportedError(undefined, err);
    }
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.setClearColor(0x05060f);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_DEFAULTS.fovDeg, width / height, CAMERA_DEFAULTS.near, CAMERA_DEFAULTS.far);
    const env = createEnvironment(gl);
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    const lighting = createLighting(scene);
    lighting.fitToMap(mapW, mapH);
    const post = createPost(gl, scene, camera, presetFor(scaler.state));
    const ctx: RenderContext = {
      scene,
      camera,
      renderer: gl,
      shake: (amount) => shake.add(amount),
      flash: (color, strength) => post.flash(color, strength),
    };
    gpu = { gl, scene, camera, lighting, post, env, stack: createLayerStack(ctx, scene, layerFactories) };
    applySize();
    advanceCamera(0);
  }

  function load(world: World): void {
    const g = needGpu();
    mapW = world.grid.w;
    mapH = world.grid.h;
    const id = forcedPalette ?? resolvePaletteId(world);
    const palette = getPalette(id);
    g.lighting.fitToMap(mapW, mapH);
    g.lighting.applyPalette(palette);
    g.gl.toneMappingExposure = palette.light.exposure;
    g.stack.load(world, forcedPalette);
    intro = 0;
    shake.trauma = 0;
  }

  function trackFrameTime(): void {
    const wall = performance.now();
    if (adaptive && lastWall > 0 && gpu) {
      const next = scaler.push(wall - lastWall);
      if (next) applySize();
    }
    lastWall = wall;
  }

  function draw(world: World, alpha: number, events: readonly SimEvent[], nowSec: number): void {
    const g = needGpu();
    trackFrameTime();
    const dt = lastNow < 0 ? 1 / 60 : Math.min(0.1, Math.max(0, nowSec - lastNow));
    lastNow = nowSec;
    for (const e of events) {
      const kick = kickFor(e);
      if (!kick) continue;
      shake.add(kick.shake);
      if (kick.flash) g.post.flash(kick.flash.color, kick.flash.strength);
    }
    shake.step(dt);
    shake.offset(nowSec, offset);
    advanceCamera(dt);
    g.stack.update(world, alpha, events, nowSec);
    g.post.render(dt, nowSec);
  }

  return {
    init,
    resize(w, h) {
      width = Math.max(1, Math.floor(w));
      height = Math.max(1, Math.floor(h));
      applySize();
    },
    load,
    draw,
    dispose() {
      if (!gpu) return;
      gpu.stack.dispose();
      gpu.post.dispose();
      gpu.env.dispose();
      gpu.gl.dispose();
      gpu = null;
    },
    getView: () => view,
    setQuality(level) {
      scaler.set(level);
      applySize();
    },
    getQuality: () => scaler.state.level,
    setAdaptiveQuality(enabled) {
      adaptive = enabled;
    },
    setPalette(id) {
      forcedPalette = id;
    },
    getLayer: (name) => gpu?.stack.get(name),
  };
}
