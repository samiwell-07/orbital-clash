import type { PaletteId, World } from '@/types';

export type FloorPattern = 'hex' | 'panels' | 'organic' | 'dunes' | 'ice' | 'lava';
export type InlayStyle = 'strips' | 'veins' | 'dots' | 'none';

export interface Palette {
  id: PaletteId;
  label: string;
  pattern: FloorPattern;
  /** Floor plates: base/alt are the two main tones, seam the gaps (or dirt patches for organic), bevel the edge highlight. */
  floor: { base: number; alt: number; seam: number; bevel: number; roughness: number; metalness: number };
  /** Emissive accents baked into the floor texture; intensity > 1 so bloom picks them up. */
  inlay: { color: number; intensity: number; style: InlayStyle; amount: number };
  rock: { color: number; dark: number; moss: number; style: 'rock' | 'metal'; metalness: number };
  skirt: { top: number; bottom: number };
  space: { a: number; b: number; nebula: number };
  craterGlow: number;
  dust: number;
  grid: number;
  /** Decorative crystal colour (null = none). */
  crystal: number | null;
  light: { exposure: number; key: number; keyIntensity: number; sky: number; ground: number; hemiIntensity: number; rim: number; fill: number };
}

const LIGHT = { keyIntensity: 2.6, hemiIntensity: 0.55, rim: 0x6fd8ff };

export const PALETTES: Record<PaletteId, Palette> = {
  kreios: {
    id: 'kreios', label: 'Kreios', pattern: 'panels',
    floor: { base: 0x6b5a52, alt: 0x8c7b6a, seam: 0x2a2220, bevel: 0x9a8878, roughness: 0.78, metalness: 0.12 },
    inlay: { color: 0xffb347, intensity: 3, style: 'dots', amount: 0.3 },
    rock: { color: 0x3a312d, dark: 0x1a1513, moss: 0x5a4a40, style: 'rock', metalness: 0.05 },
    skirt: { top: 0x4a3c36, bottom: 0x07060a },
    space: { a: 0x05060f, b: 0x1b1224, nebula: 0x6a3a2a },
    craterGlow: 0xffb347, dust: 0xe6c8a0, grid: 0xffe2c0, crystal: null,
    light: { ...LIGHT, exposure: 1.05, key: 0xfff1dc, sky: 0x8fa8ff, ground: 0x2a2038, fill: 0xffb347 },
  },
  hathor: {
    id: 'hathor', label: 'Hathor', pattern: 'dunes',
    floor: { base: 0xa88444, alt: 0x7a5c2c, seam: 0x5a4220, bevel: 0xc8a35a, roughness: 0.9, metalness: 0 },
    inlay: { color: 0x37e0c8, intensity: 3.2, style: 'dots', amount: 0.25 },
    rock: { color: 0x7a6038, dark: 0x3a2a14, moss: 0x9a7c48, style: 'rock', metalness: 0 },
    skirt: { top: 0x6e5530, bottom: 0x0a0704 },
    space: { a: 0x07050c, b: 0x2a1a22, nebula: 0x8a5a2a },
    craterGlow: 0x37e0c8, dust: 0xf0d8a0, grid: 0xfff0c8, crystal: null,
    light: { ...LIGHT, exposure: 1.0, key: 0xffe2b0, sky: 0xc8b078, ground: 0x4a3018, fill: 0x37e0c8 },
  },
  aether: {
    id: 'aether', label: 'Aether', pattern: 'ice',
    floor: { base: 0x8aa2c4, alt: 0xa8c0de, seam: 0x2c4a7a, bevel: 0xdbe8f5, roughness: 0.35, metalness: 0.1 },
    inlay: { color: 0xb5e6ff, intensity: 2.6, style: 'veins', amount: 0.5 },
    rock: { color: 0x9eb4cf, dark: 0x4a6286, moss: 0xdbe8f5, style: 'rock', metalness: 0.1 },
    skirt: { top: 0x9eb4cf, bottom: 0x0a1020 },
    space: { a: 0x050a18, b: 0x12244a, nebula: 0x4a8ad0 },
    craterGlow: 0xb5e6ff, dust: 0xe0f2ff, grid: 0xd8ecff, crystal: 0xb5e6ff,
    light: { ...LIGHT, exposure: 1.12, key: 0xf0f6ff, sky: 0xa8c8ff, ground: 0x2a3858, fill: 0xb5e6ff },
  },
  helios: {
    id: 'helios', label: 'Helios', pattern: 'lava',
    floor: { base: 0x2a1f1f, alt: 0x3c2c2a, seam: 0x120c0c, bevel: 0x5a4440, roughness: 0.7, metalness: 0.2 },
    inlay: { color: 0xff7a2e, intensity: 4, style: 'veins', amount: 0.6 },
    rock: { color: 0x2a1c1a, dark: 0x0e0808, moss: 0x5a2a1a, style: 'rock', metalness: 0.1 },
    skirt: { top: 0x5a1a0e, bottom: 0x060202 },
    space: { a: 0x0a0405, b: 0x2a0c0a, nebula: 0xc0381a },
    craterGlow: 0xff5a1a, dust: 0xff9a50, grid: 0xffc090, crystal: null,
    light: { ...LIGHT, exposure: 1.0, key: 0xffd8b8, sky: 0xff9a6a, ground: 0x2a0c08, fill: 0xff5a1a },
  },
  gaia: {
    id: 'gaia', label: 'Gaia', pattern: 'organic',
    floor: { base: 0x4f5a22, alt: 0x7f9433, seam: 0x8a6b34, bevel: 0x6a7d2a, roughness: 0.92, metalness: 0 },
    inlay: { color: 0x58e0b0, intensity: 2.5, style: 'none', amount: 0 },
    rock: { color: 0x3d4030, dark: 0x1a1c12, moss: 0x6a7d2a, style: 'rock', metalness: 0 },
    skirt: { top: 0x3d4030, bottom: 0x06070a },
    space: { a: 0x040806, b: 0x0c2018, nebula: 0x2a8a60 },
    craterGlow: 0x58e0b0, dust: 0xc8e090, grid: 0xe0f0b0, crystal: 0x58e0b0,
    light: { ...LIGHT, exposure: 1.1, key: 0xffe9c0, sky: 0xa8c070, ground: 0x3a2c18, fill: 0x58e0b0 },
  },
  kronos: {
    id: 'kronos', label: 'Kronos', pattern: 'hex',
    floor: { base: 0x5a5896, alt: 0x6e6ca8, seam: 0x1c1a3a, bevel: 0x7f7cc4, roughness: 0.55, metalness: 0.35 },
    inlay: { color: 0x33e6ff, intensity: 2.6, style: 'strips', amount: 0.3 },
    rock: { color: 0x26244a, dark: 0x0e0d24, moss: 0x4a4890, style: 'metal', metalness: 0.6 },
    skirt: { top: 0x3a3870, bottom: 0x05040f },
    space: { a: 0x05060f, b: 0x16102b, nebula: 0x4a2a8a },
    craterGlow: 0x33e6ff, dust: 0xb8b4ff, grid: 0xb8bcff, crystal: 0x7fe9ff,
    light: { ...LIGHT, exposure: 1.0, key: 0xf2f0ff, sky: 0x8f93ff, ground: 0x2a2038, fill: 0x33e6ff },
  },
};

export const ALL_PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export function getPalette(id: PaletteId): Palette {
  return PALETTES[id] ?? PALETTES.kreios;
}

/** The world carries no map palette; bionic worlds without a comet default to Kronos. */
export function resolvePaletteId(world: World): PaletteId {
  return world.settings.comet ?? (world.settings.profile === 'bionic' ? 'kronos' : 'kreios');
}
