import * as THREE from 'three';
import { CAMERA_DEFAULTS, cameraPose, computeFitDistance, easeOutCubic } from './camera';
import type { ShakeOffset } from './shake';

const target = new THREE.Vector3();

/**
 * Frames the whole map for the camera's current aspect, with the intro dolly (`introSec` = seconds elapsed)
 * and shake applied. Shake translates along the camera's own right/up axes so the view direction stays put.
 */
export function placeCamera(camera: THREE.PerspectiveCamera, mapW: number, mapH: number, introSec: number, shake: ShakeOffset): void {
  const fit = computeFitDistance({ aspect: camera.aspect, mapW, mapH });
  const dolly = 1 + (CAMERA_DEFAULTS.introScale - 1) * (1 - easeOutCubic(introSec / CAMERA_DEFAULTS.introSec));
  const pose = cameraPose(mapW / 2, mapH / 2, fit * dolly);
  const pitch = (CAMERA_DEFAULTS.pitchDeg * Math.PI) / 180;
  const ox = shake.x;
  const oy = shake.y * Math.cos(pitch);
  const oz = -shake.y * Math.sin(pitch);
  camera.position.set(pose.x + ox, pose.y + oy, pose.z + oz);
  camera.up.set(0, 1, 0);
  camera.lookAt(target.set(pose.tx + ox, pose.ty + oy, pose.tz + oz));
  camera.rotateZ(shake.roll);
  camera.updateMatrixWorld();
}
