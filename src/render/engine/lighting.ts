import * as THREE from 'three';
import type { Palette } from '../terrain/palettes';

/**
 * Style-guide light numbers are relative; three's ACES curve (which pre-multiplies by 1/0.6) and physical light units
 * make them ~2x too hot against the guide's albedos, so everything is scaled to keep floors below the bloom threshold.
 */
export const LIGHT_SCALE = 0.55;

export const LIGHT_DEFAULTS = {
  azimuthDeg: -35,
  elevationDeg: 52,
  keyIntensity: 2.6 * LIGHT_SCALE,
  hemiIntensity: 0.55 * LIGHT_SCALE,
  rimIntensity: 0.8 * LIGHT_SCALE,
  fillIntensity: 0.35 * LIGHT_SCALE,
  shadowBias: -0.0004,
  shadowNormalBias: 0.6,
  shadowRadius: 3,
  shadowMargin: 4,
} as const;

/** Unit vector from the scene towards the key light (from the top-left of the screen). */
export function keyLightDirection(azimuthDeg: number = LIGHT_DEFAULTS.azimuthDeg, elevationDeg: number = LIGHT_DEFAULTS.elevationDeg): THREE.Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

export interface Lighting {
  key: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  rim: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  applyPalette(p: Palette): void;
  fitToMap(w: number, h: number): void;
  setShadows(enabled: boolean, mapSize: number): void;
}

export function createLighting(scene: THREE.Scene): Lighting {
  const hemi = new THREE.HemisphereLight(0x8fa8ff, 0x2a2038, LIGHT_DEFAULTS.hemiIntensity);
  const key = new THREE.DirectionalLight(0xfff1dc, LIGHT_DEFAULTS.keyIntensity);
  const rim = new THREE.DirectionalLight(0x6fd8ff, LIGHT_DEFAULTS.rimIntensity);
  const fill = new THREE.DirectionalLight(0x33e6ff, LIGHT_DEFAULTS.fillIntensity);
  key.castShadow = true;
  key.shadow.bias = LIGHT_DEFAULTS.shadowBias;
  key.shadow.normalBias = LIGHT_DEFAULTS.shadowNormalBias;
  key.shadow.radius = LIGHT_DEFAULTS.shadowRadius;
  scene.add(hemi, key, key.target, rim, rim.target, fill, fill.target);
  const dir = keyLightDirection();

  function fitToMap(w: number, h: number): void {
    const cx = w / 2;
    const cz = h / 2;
    const m = LIGHT_DEFAULTS.shadowMargin;
    key.target.position.set(cx, 0, cz);
    key.position.copy(dir).multiplyScalar(80).add(key.target.position);
    rim.target.position.set(cx, 0, cz);
    rim.position.set(cx + 30, 24, cz + 30);
    fill.target.position.set(cx, 0, cz);
    fill.position.set(cx - 40, 14, cz + 25);
    const cam = key.shadow.camera;
    cam.position.copy(key.position);
    cam.lookAt(key.target.position);
    cam.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const p = new THREE.Vector3();
    for (const y of [-1, 4]) {
      for (const [x, z] of [[-m, -m], [w + m, -m], [-m, h + m], [w + m, h + m]]) {
        box.expandByPoint(p.set(x, y, z).applyMatrix4(cam.matrixWorldInverse));
      }
    }
    cam.left = box.min.x;
    cam.right = box.max.x;
    cam.bottom = box.min.y;
    cam.top = box.max.y;
    cam.near = Math.max(0.1, -box.max.z - 5);
    cam.far = -box.min.z + 5;
    cam.updateProjectionMatrix();
  }

  return {
    key,
    hemi,
    rim,
    fill,
    fitToMap,
    applyPalette(p) {
      key.color.set(p.light.key);
      key.intensity = p.light.keyIntensity * LIGHT_SCALE;
      hemi.intensity = p.light.hemiIntensity * LIGHT_SCALE;
      hemi.color.set(p.light.sky);
      hemi.groundColor.set(p.light.ground);
      rim.color.set(p.light.rim);
      fill.color.set(p.light.fill);
    },
    setShadows(enabled, mapSize) {
      key.castShadow = enabled;
      if (key.shadow.mapSize.x !== mapSize) {
        key.shadow.mapSize.set(mapSize, mapSize);
        key.shadow.map?.dispose();
        key.shadow.map = null;
      }
    },
  };
}
