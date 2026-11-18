import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'Cinder Gate', hits: 40, start: 520, par: 720, ai: 8,
    map: { w: 44, h: 28, style: 'lanes', layout: 'side', seed: 401, thorium: 2, rocks: 16, craters: 20 },
    hints: ['Everything you have learned is available: the alien economy is strong, strike early.'],
  },
  {
    name: 'Waypoint', hits: 45, start: 520, par: 750, ai: 8,
    map: { w: 44, h: 28, style: 'spires', seed: 402, thorium: 2, rocks: 16 },
    hints: ['Waypoints steer your armies: route them past weak towers.', 'Place a waypoint, then release units to see them take the detour.'],
  },
  {
    name: 'Magma Maze', hits: 45, start: 540, par: 780, ai: 8,
    map: { w: 46, h: 28, style: 'maze', seed: 403, thorium: 2, rocks: 16 },
    hints: ['The alien maze is long: breach it with Hammers or Torpedoes.'],
  },
  {
    name: 'Solar Flare', hits: 50, start: 540, par: 780, ai: 9,
    map: { w: 46, h: 28, style: 'rooms', layout: 'side', seed: 404, thorium: 2, rocks: 16 },
    hints: ['The pressure never lets up: build before each wave lands.'],
    alt: { id: 'flare', text: 'Or destroy 16 alien structures', type: 'destroyStructures', value: 16 },
  },
  {
    name: 'Eclipse', hits: 50, start: 500, par: 810, ai: 9,
    map: { w: 46, h: 30, style: 'ring', seed: 405, thorium: 1, rocks: 8 },
    hints: ['Thorium is scarce: pour it into upgrades that earn their keep.'],
  },
  {
    name: 'Heat Sink', hits: 55, start: 560, par: 840, ai: 9,
    map: { w: 48, h: 30, style: 'lanes', seed: 406, thorium: 2, rocks: 16, craters: 24 },
    hints: ['Defend every lane and watch the sky: Carriers drop whole armies.'],
  },
  {
    name: 'Sun Core', hits: 60, start: 600, par: 870, ai: 9,
    map: { w: 48, h: 30, style: 'ring', layout: 'side', seed: 407, thorium: 2, rocks: 18, craters: 22 },
    hints: ['The finale uses the full alien toolkit: build everything and keep it repaired.'],
  },
];

export const HELIOS_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('helios', i, s));

export const HELIOS_RESURGENCE: Mission = makeMission('helios', 0, {
  name: 'Helios Resurgence', hits: 100, start: 450, par: 1200, ai: 10,
  map: { w: 48, h: 30, style: 'maze', seed: 490, thorium: 1, rocks: 8, craters: 26 },
}, true);
