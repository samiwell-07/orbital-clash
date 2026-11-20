import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'Cinder Gate', hits: 40, start: 520, par: 720, ai: 8,
    map: { size: 29, layout: 'side', thorium: 2, rocks: 16,
      ridges: [[10, 2, 10, 17, 13, 20]], trenches: [[2, 6, 6, 4], [14, 5, 17, 8, 20]] },
    hints: ['Everything you have learned is available: the alien economy is strong, strike early.'],
  },
  {
    name: 'Waypoint', hits: 45, start: 520, par: 750, ai: 8,
    map: { size: 29, thorium: 2, rocks: 16,
      ridges: [[2, 11, 9, 14, 13, 18, 17], [2, 17, 5, 21, 10]],
      trenches: [[4, 25, 8, 23, 12]] },
    hints: ['Waypoints steer your armies: route them past weak towers.', 'Place a waypoint, then release units to see them take the detour.'],
  },
  {
    name: 'Magma Maze', hits: 45, start: 540, par: 780, ai: 8,
    map: { size: 30, thorium: 2, rocks: 16,
      ridges: [[2, 11, 22], [8, 13, 27]],
      trenches: [[12, 2, 12, 6, 20], [3, 20, 6, 23, 8]] },
    hints: ['The alien maze is long: breach it with Hammers or Torpedoes.'],
  },
  {
    name: 'Solar Flare', hits: 50, start: 540, par: 780, ai: 9,
    map: { size: 30, layout: 'side', thorium: 2, rocks: 16,
      ridges: [[10, 10, 10, 4, 20, 12, 14, 8, 17]], trenches: [[2, 5, 6, 8, 8], [9, 16, 13]] },
    hints: ['The pressure never lets up: build before each wave lands.'],
    alt: { id: 'flare', text: 'Or destroy 16 alien structures', type: 'destroyStructures', value: 16 },
  },
  {
    name: 'Eclipse', hits: 50, start: 500, par: 810, ai: 9,
    map: { size: 30, thorium: 1, rocks: 8,
      ridges: [[12, 9, 20, 18], [2, 18, 6, 22, 10]],
      trenches: [[17, 4, 24, 12], [13, 12, 16, 14]] },
    hints: ['Thorium is scarce: pour it into upgrades that earn their keep.'],
  },
  {
    name: 'Heat Sink', hits: 55, start: 560, par: 840, ai: 9,
    map: { size: 30, thorium: 2, rocks: 16,
      ridges: [[2, 11, 16], [2, 17, 11], [2, 23, 8]],
      trenches: [[6, 14, 12], [5, 20, 10], [5, 26, 10]] },
    hints: ['Defend every lane and watch the sky: Carriers drop whole armies.'],
  },
  {
    name: 'Sun Core', hits: 60, start: 600, par: 870, ai: 9,
    map: { size: 30, layout: 'side', thorium: 2, rocks: 18,
      ridges: [[13, 7, 21, 10, 19, 17], [2, 6, 7, 3, 10]],
      trenches: [[12, 11, 16, 14], [12, 2, 19, 4]] },
    hints: ['The finale uses the full alien toolkit: build everything and keep it repaired.'],
  },
];

export const HELIOS_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('helios', i, s));

export const HELIOS_RESURGENCE: Mission = makeMission('helios', 0, {
  name: 'Helios Resurgence', hits: 100, start: 450, par: 1200, ai: 10,
  map: { size: 30, thorium: 1, rocks: 8,
    ridges: [[2, 11, 13, 25, 4, 15, 10, 21, 7]],
    trenches: [[2, 27, 11], [6, 17, 8, 19]] },
}, true);
