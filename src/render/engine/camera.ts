import { MAP_H, MAP_W } from '@/config/constants';

export interface CameraDefaults {
  fovDeg: number;
  pitchDeg: number;
  near: number;
  far: number;
  margin: number;
  introScale: number;
  introSec: number;
}

/** Style-guide camera defaults. */
export const CAMERA_DEFAULTS: Readonly<CameraDefaults> = {
  fovDeg: 28,
  pitchDeg: 62,
  near: 1,
  far: 400,
  /** Extra room around the map (6 %). */
  margin: 1.06,
  /** Intro dolly starts this much further away and eases in. */
  introScale: 80 / 64,
  introSec: 0.5,
};

export interface FitInput {
  aspect: number;
  mapW: number;
  mapH: number;
  fovDeg?: number;
  pitchDeg?: number;
  margin?: number;
}

/**
 * Smallest camera distance (target -> eye) at which every corner of the map rectangle is inside the frustum.
 * The camera orbits the map centre, pitched down by `pitchDeg`, with vertical fov `fovDeg`.
 */
export function computeFitDistance(input: FitInput): number {
  const fov = ((input.fovDeg ?? CAMERA_DEFAULTS.fovDeg) * Math.PI) / 180;
  const pitch = ((input.pitchDeg ?? CAMERA_DEFAULTS.pitchDeg) * Math.PI) / 180;
  const margin = input.margin ?? CAMERA_DEFAULTS.margin;
  const tV = Math.tan(fov / 2);
  const tH = tV * Math.max(input.aspect, 0.1);
  const hx = input.mapW / 2;
  const hz = input.mapH / 2;
  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  let d = 0;
  // A ground corner (dx, dz) has depth D - dz*cos, screen-x dx and screen-y dz*sin.
  for (const dz of [-hz, hz]) {
    d = Math.max(d, hx / tH + dz * cos, (Math.abs(dz) * sin) / tV + dz * cos);
  }
  return d * margin;
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
}

/** Eye position for a target, distance and pitch; yaw 0 puts the eye south (+z) of the target. */
export function cameraPose(cx: number, cz: number, distance: number, pitchDeg = CAMERA_DEFAULTS.pitchDeg): CameraPose {
  const pitch = (pitchDeg * Math.PI) / 180;
  return { x: cx, y: Math.sin(pitch) * distance, z: cz + Math.cos(pitch) * distance, tx: cx, ty: 0, tz: cz };
}

export function easeOutCubic(t: number): number {
  const k = 1 - Math.min(1, Math.max(0, t));
  return 1 - k * k * k;
}

export const DEFAULT_MAP_SIZE = { w: MAP_W, h: MAP_H };
