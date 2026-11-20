import type { StructureKind } from '@/types';
import type { StructureView } from './common';
import { buildTurret } from './turret';
import { buildLaser } from './laser';
import { buildPulsar } from './pulsar';
import { buildBomber } from './bomber';
import { buildBasicOps } from './basicOps';
import { buildSpecialOps } from './specialOps';
import { buildHarvester, buildResearchLab } from './economy';
import { buildMissileDefense, buildMissileSilo } from './silo';
import { buildGateway, buildWaypoint } from './portal';

export type ViewFactory = (team: number) => StructureView;

export const VIEW_FACTORIES: Readonly<Record<StructureKind, ViewFactory>> = {
  turret: buildTurret,
  laser: buildLaser,
  pulsar: buildPulsar,
  bomber: buildBomber,
  basicOps: buildBasicOps,
  specialOps: buildSpecialOps,
  harvester: buildHarvester,
  researchLab: buildResearchLab,
  missileSilo: buildMissileSilo,
  missileDefense: buildMissileDefense,
  gateway: buildGateway,
  waypoint: buildWaypoint,
};
