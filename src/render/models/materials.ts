import { Color, MeshBasicMaterial, MeshStandardMaterial, AdditiveBlending, DoubleSide } from 'three';
import type { Material } from 'three';
import { TEAM_BODY, TEAM_GLINT, TEAM_GLOW, teamIndex } from '@/render/instancing/colorTables';

const registry = new Map<string, Material>();

function memo<T extends Material>(key: string, make: () => T): T {
  let m = registry.get(key) as T | undefined;
  if (!m) { m = make(); registry.set(key, m); }
  return m;
}

/** PBR material with optional emissive; vertexColors on for assembled geometry. */
export function stdMat(color: number, metalness = 0.6, roughness = 0.45, vertexColors = true): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness, vertexColors, envMapIntensity: 0.9 });
}

/** Emissive-dominant PBR material (dark diffuse so the colour comes from emission; intensity > 1 blooms). */
export function glowMat(hex: number, intensity: number, vertexColors = false): MeshStandardMaterial {
  const c = new Color(hex);
  return new MeshStandardMaterial({
    color: c.clone().multiplyScalar(0.25), emissive: c, emissiveIntensity: intensity,
    metalness: 0.1, roughness: 0.4, vertexColors,
  });
}

/** Additive unlit material for beams / halos; colour can exceed 1 to feed bloom. */
export function beamMat(hex: number, boost = 2.2, opacity = 0.9, vertexColors = false): MeshBasicMaterial {
  const c = new Color(hex).multiplyScalar(boost);
  return new MeshBasicMaterial({
    color: c, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, vertexColors, side: DoubleSide,
  });
}

/** Shared platform steel (colour comes from vertex colours and per-instance damage tint). */
export const platformMat = (): MeshStandardMaterial => memo('platform', () => stdMat(0xffffff, 0.7, 0.45));

/** Shared team trim ring/crest: owner-colour emissive (style guide section 5). */
export const teamTrimMat = (team: number): MeshStandardMaterial => {
  const t = teamIndex(team);
  return memo(`trim${t}`, () => glowMat(TEAM_GLOW[t], 1.5));
};

export const unitBodyMat = (team: number): MeshStandardMaterial => {
  const t = teamIndex(team);
  return memo(`ubody${t}`, () => {
    const m = stdMat(TEAM_BODY[t], 0.4, 0.35);
    m.emissive = new Color(TEAM_GLOW[t]);
    m.emissiveIntensity = 0.22;
    return m;
  });
};

export const unitGlowMat = (team: number): MeshStandardMaterial => {
  const t = teamIndex(team);
  return memo(`uglow${t}`, () => {
    const m = glowMat(TEAM_GLOW[t], 3.2, true);
    m.color = new Color(TEAM_GLINT[t]).multiplyScalar(0.5);
    return m;
  });
};

export const sharedBeam = (key: string, hex: number, boost?: number, opacity?: number, vc = false): MeshBasicMaterial =>
  memo(`beam:${key}`, () => beamMat(hex, boost, opacity, vc));

export const sharedMat = <T extends Material>(key: string, make: () => T): T => memo(key, make);

export function disposeMaterials(): void {
  for (const m of registry.values()) m.dispose();
  registry.clear();
}
