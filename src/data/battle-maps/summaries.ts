import type { CometId, MapDef, PaletteId } from '@/types';
import { aetherDrift, aetherSpires } from './aether';
import { heliosFurnace, heliosForge } from './helios';
import { hathorDunes, hathorOasis } from './hathor';
import { kreiosCrater, kreiosRidge } from './kreios';

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
  /** Shipped with the base game or added by patch 1.03. */
  release: 'base' | 'patch-1.03';
  rockCount: number;
}

const BASE_MAPS: readonly MapDef[] = [kreiosCrater(), hathorDunes(), aetherDrift(), heliosForge()];
const PATCH_MAPS: readonly MapDef[] = [kreiosRidge(), hathorOasis(), aetherSpires(), heliosFurnace()];

/** All eight battle maps, base game first, then the four added by patch 1.03 (one per comet). */
export const BATTLE_MAPS: readonly MapDef[] = [...BASE_MAPS, ...PATCH_MAPS];

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
  return [...BASE_MAPS.map((m) => summarize(m, 'base')), ...PATCH_MAPS.map((m) => summarize(m, 'patch-1.03'))];
}
