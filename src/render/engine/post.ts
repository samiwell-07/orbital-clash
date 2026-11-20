import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GRADE_DEFAULTS, GradeShader } from './shaders';
import type { QualityPreset } from './quality';

export const BLOOM = { strength: 0.55, radius: 0.5, threshold: 0.82 } as const;
const FLASH_DECAY = 4.5;

export interface Post {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  /** Sets the frame buffer size (CSS pixels) and pixel ratio. */
  setSize(width: number, height: number, pixelRatio: number): void;
  applyQuality(preset: QualityPreset): void;
  /** Colour pulse over the whole frame (strongest at the edges); decays by itself. */
  flash(color: number, strength: number): void;
  render(dt: number, timeSec: number): void;
  dispose(): void;
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, preset: QualityPreset): Post {
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: preset.samples });
  const composer = new EffectComposer(renderer, target);
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  const gradeUniforms = THREE.UniformsUtils.clone(GradeShader.uniforms as unknown as Record<string, THREE.IUniform>);
  const flashColor = new THREE.Color(1, 0.2, 0.2);
  gradeUniforms.uFlashColor.value = flashColor;
  gradeUniforms.uShadowTint.value = new THREE.Color(0.02, 0.05, 0.1);
  const grade = new ShaderPass(new THREE.ShaderMaterial({ ...GradeShader, uniforms: gradeUniforms }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  let flash = 0;
  let w = 1;
  let h = 1;
  let pr = 1;
  let bloomScale = preset.bloomScale;

  const sizeBloom = (): void => bloom.setSize(Math.max(2, Math.floor(w * pr * bloomScale)), Math.max(2, Math.floor(h * pr * bloomScale)));

  return {
    composer,
    bloom,
    setSize(width, height, pixelRatio) {
      w = width;
      h = height;
      pr = pixelRatio;
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      sizeBloom();
    },
    applyQuality(p) {
      bloomScale = p.bloomScale;
      bloom.strength = p.bloomStrength;
      gradeUniforms.uAberration.value = GRADE_DEFAULTS.aberration * p.gradeFx;
      gradeUniforms.uGrain.value = GRADE_DEFAULTS.grain * p.gradeFx;
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        if (t.samples !== p.samples) {
          t.samples = p.samples;
          t.dispose();
        }
      }
      sizeBloom();
    },
    flash(color, strength) {
      flashColor.set(color);
      flash = Math.max(flash, Math.min(1, strength));
    },
    render(dt, timeSec) {
      flash = Math.max(0, flash - FLASH_DECAY * dt);
      gradeUniforms.uFlash.value = flash;
      gradeUniforms.uTime.value = timeSec % 100;
      composer.render(dt);
    },
    dispose() {
      composer.dispose();
      bloom.dispose();
      target.dispose();
      grade.dispose();
    },
  };
}
