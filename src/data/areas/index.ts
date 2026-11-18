import type { CometId, Mission } from '@/types';
import { registerMap } from '@/sim/core';
import { AETHER_AREAS, AETHER_RESURGENCE } from './aether';
import { HATHOR_AREAS, HATHOR_RESURGENCE } from './hathor';
import { HELIOS_AREAS, HELIOS_RESURGENCE } from './helios';
import { KREIOS_AREAS, KREIOS_RESURGENCE } from './kreios';
import { COMETS } from './spec';

export { seedFor } from './seeds';
export { TEACH, unlockedBefore } from './spec';

const AREAS: Record<CometId, readonly Mission[]> = {
  kreios: KREIOS_AREAS, hathor: HATHOR_AREAS, aether: AETHER_AREAS, helios: HELIOS_AREAS,
};
const RESURGENCE: Record<CometId, Mission> = {
  kreios: KREIOS_RESURGENCE, hathor: HATHOR_RESURGENCE, aether: AETHER_RESURGENCE, helios: HELIOS_RESURGENCE,
};

/** The 28 campaign areas in play order (areas 1-28), then the four Resurgence missions. */
export const ALL_MISSIONS: readonly Mission[] = [
  ...COMETS.flatMap((c) => AREAS[c]),
  ...COMETS.map((c) => RESURGENCE[c]),
];

for (const m of ALL_MISSIONS) registerMap(m.map);

export function getMission(comet: CometId, index: number, resurgence = false): Mission | null {
  if (resurgence) return RESURGENCE[comet];
  return AREAS[comet][index] ?? null;
}

export interface AreaSummary {
  id: string;
  comet: CometId;
  index: number;
  /** 1-28 for regular areas, 0 for Resurgence. */
  number: number;
  label: string;
  name: string;
  resurgence: boolean;
  teaches: string | null;
  parTimeSec: number;
  startThorium: number;
  enemyHits: Mission['enemyHits'];
  objectives: readonly string[];
  hintCount: number;
  mapW: number;
  mapH: number;
  thoriumLevel: 1 | 2 | 3;
}

/** Plain objects for the area-select UI. */
export function missionSummaries(): AreaSummary[] {
  return ALL_MISSIONS.map((m) => {
    const number = m.resurgence ? 0 : COMETS.indexOf(m.comet) * 7 + m.index + 1;
    return {
      id: m.id, comet: m.comet, index: m.index, number, label: m.resurgence ? 'Resurgence' : `Area ${number}`,
      name: m.name, resurgence: m.resurgence, teaches: m.teaches, parTimeSec: m.parTimeSec,
      startThorium: m.startThorium, enemyHits: m.enemyHits, objectives: m.objectives.map((o) => o.text),
      hintCount: m.hints.length, mapW: m.map.w, mapH: m.map.h, thoriumLevel: m.map.thoriumLevel,
    };
  });
}
