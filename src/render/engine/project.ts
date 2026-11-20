import * as THREE from 'three';

export interface RendererView {
  camera: THREE.PerspectiveCamera;
  /** CSS pixel size of the canvas as last passed to resize(). */
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  /** False when the point is behind the camera or outside the viewport. */
  visible: boolean;
}

const v = new THREE.Vector3();
const dir = new THREE.Vector3();

/** Tile coordinates (x, y) + optional height above ground -> CSS pixels in the canvas. */
export function worldToScreen(view: RendererView, x: number, y: number, height = 0): ScreenPoint {
  view.camera.updateMatrixWorld();
  v.set(x, height, y).project(view.camera);
  const sx = (v.x * 0.5 + 0.5) * view.width;
  const sy = (-v.y * 0.5 + 0.5) * view.height;
  return { x: sx, y: sy, visible: v.z > -1 && v.z < 1 && sx >= 0 && sy >= 0 && sx <= view.width && sy <= view.height };
}

/** CSS pixels -> tile coordinates on the plane `height` above the ground; null if the ray misses it. */
export function screenToWorld(view: RendererView, sx: number, sy: number, height = 0): { x: number; y: number } | null {
  view.camera.updateMatrixWorld();
  v.set((sx / view.width) * 2 - 1, -(sy / view.height) * 2 + 1, 0.5).unproject(view.camera);
  dir.copy(v).sub(view.camera.position);
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (height - view.camera.position.y) / dir.y;
  if (t <= 0) return null;
  return { x: view.camera.position.x + dir.x * t, y: view.camera.position.z + dir.z * t };
}
