import type { CometId, MapDef, PaletteId } from '@/types';
import { aetherDrift, aetherHalo, aetherPrism, aetherSpires } from './aether';
import { heliosCaldera, heliosFurnace, heliosForge, heliosVents } from './helios';
import { hathorCanyon, hathorDunes, hathorMesa, hathorOasis } from './hathor';
import { kreiosBasin, kreiosCrater, kreiosFissure, kreiosRidge } from './kreios';

export interface BattleMapSummary {
  id: string;
  name: string;
  comet: CometId;
  palette: PaletteId;
  w: number;
  h: number;
  minPlayers: number;
  maxPlayers: number;
  /** Thorium symbols shown under the map (1..3). */
  thoriumLevel: 1 | 2 | 3;
  /** Players choose their own base tile (baseTiles are all null). */
  freeBase: boolean;
  /** Shipped with the base game, added by patch 1.03, or part of the Orbital Clash expansion set (two per comet). */
  release: 'base' | 'patch-1.03' | 'expansion';
  rockCount: number;
}

const BASE_MAPS: readonly MapDef[] = [kreiosCrater(), hathorDunes(), aetherDrift(), heliosForge()];
const PATCH_MAPS: readonly MapDef[] = [kreiosRidge(), hathorOasis(), aetherSpires(), heliosFurnace()];
const EXPANSION_MAPS: readonly MapDef[] = [
  kreiosFissure(), kreiosBasin(), hathorMesa(), hathorCanyon(), aetherPrism(), aetherHalo(), heliosCaldera(), heliosVents(),
];

/** All sixteen battle maps: base game, the four added by patch 1.03 (one per comet), then the expansion set (two per comet). */
export const BATTLE_MAPS: readonly MapDef[] = [...BASE_MAPS, ...PATCH_MAPS, ...EXPANSION_MAPS];

export function battleMapById(id: string): MapDef | undefined {
  return BATTLE_MAPS.find((m) => m.id === id);
}

function summarize(m: MapDef, release: BattleMapSummary['release']): BattleMapSummary {
  return {
    id: m.id,
    name: m.name,
    comet: m.palette as CometId,
    palette: m.palette,
    w: m.w,
    h: m.h,
    minPlayers: 2,
    maxPlayers: m.baseTiles.length,
    thoriumLevel: m.thoriumLevel,
    freeBase: m.baseTiles.every((t) => t === null),
    release,
    rockCount: m.rockCount,
  };
}

/** Everything the map-select UI needs, without the terrain rows. */
export function battleMapSummaries(): BattleMapSummary[] {
  return [
    ...BASE_MAPS.map((m) => summarize(m, 'base')),
    ...PATCH_MAPS.map((m) => summarize(m, 'patch-1.03')),
    ...EXPANSION_MAPS.map((m) => summarize(m, 'expansion')),
  ];
}
