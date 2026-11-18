import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'Dune Gate', hits: 20, start: 380, par: 480, ai: 4,
    map: { w: 40, h: 26, style: 'lanes', layout: 'side', seed: 201, thorium: 3, rocks: 18 },
    hints: ['Pulsars hit everything within one tile: put them on the front line.', 'Pulsars cannot smash rocks; keep a Turret or Laser nearby for Thorium.'],
  },
  {
    name: 'Sand Thieves', hits: 22, start: 380, par: 510, ai: 4,
    map: { w: 40, h: 26, style: 'spires', seed: 202, thorium: 3, rocks: 18 },
    hints: ['Thieves convert your stored units: kill them before they reach your army.', 'Thieves are weak: Pulsars and Turrets shred them.'],
  },
  {
    name: 'Blast Radius', hits: 25, start: 400, par: 540, ai: 5,
    map: { w: 42, h: 26, style: 'plain', seed: 203, thorium: 2, rocks: 16, craters: 18 },
    hints: ['Bombers splash everything in a column and also smash rocks.', 'Fast units slip past slow shells: pair Bombers with Pulsars.'],
  },
  {
    name: 'Mirage', hits: 25, start: 400, par: 540, ai: 5,
    map: { w: 42, h: 26, style: 'rooms', seed: 204, thorium: 1, rocks: 7 },
    hints: ['Rocks are scarce: plan every purchase and recycle what you no longer need.'],
    alt: { id: 'harvest', text: 'Or collect 700 Thorium', type: 'thorium', value: 700 },
  },
  {
    name: 'Twin Spires', hits: 28, start: 420, par: 570, ai: 5,
    map: { w: 44, h: 26, style: 'spires', layout: 'side', seed: 205, thorium: 2, rocks: 16 },
    hints: ['Two lanes lead to your base: split your defence or block one entirely.'],
  },
  {
    name: 'Counterstrike', hits: 30, start: 420, par: 600, ai: 6,
    map: { w: 44, h: 28, style: 'lanes', seed: 206, thorium: 2, rocks: 16 },
    hints: ['Release your own army the moment an alien wave is spent.', 'Keep the attack menu locked and rebuild defences while it marches.'],
    extraTech: ['torpedoes'],
  },
  {
    name: "Pharaoh's Core", hits: 35, start: 440, par: 630, ai: 6,
    map: { w: 48, h: 30, style: 'maze', seed: 207, thorium: 2, rocks: 18 },
    hints: ['The alien base is layered: expect Pulsars, Bombers and Thieves in depth.'],
    alt: { id: 'razed', text: 'Or destroy 14 alien structures', type: 'destroyStructures', value: 14 },
  },
];

export const HATHOR_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('hathor', i, s));

export const HATHOR_RESURGENCE: Mission = makeMission('hathor', 0, {
  name: 'Hathor Resurgence', hits: 80, start: 450, par: 840, ai: 10,
  map: { w: 48, h: 30, style: 'maze', layout: 'side', seed: 290, thorium: 1, rocks: 9, craters: 24 },
  extraTech: ['torpedoes', 'drone'],
}, true);
