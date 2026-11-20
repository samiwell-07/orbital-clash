import type { Mission, UnitKind, WeaponKind } from '@/types';
import { Layout } from './layout';
import { Script, scheduleBursts } from './script';
import { areaMap, finishMission, type AreaSpec } from './spec';

/** No wave leaves the alien base before this second. */
const FIRST_WAVE_MIN = 30;

type Wave = readonly [seconds: number, forces: Partial<Record<UnitKind, number>>];
export interface SwarmArea extends Omit<AreaSpec, 'ai' | 'extraTech'> {
  briefing: string;
  garrison: readonly WeaponKind[];
  installation: 'researchLab' | 'missileDefense';
  /** Salvaged installation beside the lead pilot's pad. */
  salvage?: 'missileSilo' | 'researchLab';
  /** Extra front weapons; preplaced at t=0 with the garrison (the seconds are kept as authored history only). */
  reinforcements: readonly (readonly [seconds: number, kind: WeaponKind])[];
  waves: readonly Wave[];
}

export function swarmMission(comet: 'gaia' | 'kronos', index: number, spec: SwarmArea, resurgence = false): Mission {
  const map = areaMap(comet, index, spec, resurgence);
  const layout = new Layout(map);
  const s = new Script();
  function sites(n: number, front: boolean) {
    const tiles = layout.pick(n, layout.enemy, 2, front ? 8 : 4, front);
    if (tiles.length !== n) throw new Error(`${map.id}: not enough ${front ? 'front' : 'rear'} sites`);
    return tiles;
  }
  const [installation, ops] = sites(2, false);
  s.preplace(spec.installation, installation.tx, installation.ty);
  s.preplace('basicOps', ops.tx, ops.ty, 1, 'tank');
  const fort = sites(spec.garrison.length + spec.reinforcements.length, true);
  // Fully geared from t=0: the reinforcements stand with the garrison; the authored times no longer apply.
  [...spec.garrison, ...spec.reinforcements.map(([, kind]) => kind)].forEach((kind, i) => s.preplace(kind, fort[i].tx, fort[i].ty));
  if (spec.salvage) {
    const [tile] = layout.pick(1, layout.human, 2, 4, false, layout.enemy);
    if (!tile) throw new Error(`${map.id}: no salvage site`);
    s.pre.push({ ...tile, kind: spec.salvage, level: 0, owner: 0 });
  }
  s.message(0, spec.briefing);
  const end = Math.floor(spec.par * 0.94);
  const ai = Math.min(10, 5 + index + (resurgence ? 3 : 0));
  scheduleBursts(s, { par: spec.par, ai, end: end - 3, cap: index < 3 && !resurgence ? 2 : 3 });
  for (const [t, forces] of spec.waves) {
    for (const [kind, n] of Object.entries(forces) as [UnitKind, number][]) s.release(Math.max(FIRST_WAVE_MIN, t), kind, n);
  }
  s.releaseAll(end);
  return finishMission(comet, index, spec, resurgence, 'bionic', map, s);
}
