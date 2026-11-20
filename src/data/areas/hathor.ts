import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'Dune Gate', hits: 20, start: 380, par: 480, ai: 4,
    map: { size: 26, layout: 'side', thorium: 3, rocks: 18,
      ridges: [[10, 2, 10, 16, 12]], trenches: [[3, 4, 6, 6, 8]] },
    hints: ['Pulsars hit everything within one tile: put them on the front line.', 'Lasers and Pulsars never touch rocks: only Harvesters turn them into Thorium.'],
  },
  {
    name: 'Sand Thieves', hits: 22, start: 380, par: 510, ai: 4,
    map: { size: 26, thorium: 3, rocks: 18,
      ridges: [[2, 12, 7, 15, 12, 18]], trenches: [[2, 16, 4, 19, 9, 22]] },
    hints: ['Thieves convert your stored units: kill them before they reach your army.', 'Thieves are weak: Pulsars and Turrets shred them.'],
  },
  {
    name: 'Blast Radius', hits: 25, start: 400, par: 540, ai: 5,
    map: { size: 28, thorium: 2, rocks: 16,
      ridges: [[11, 2, 11, 9], [15, 5, 15, 13]], trenches: [[19, 2, 19, 10, 22]] },
    hints: ['Bombers splash everything in a column.', 'Fast units slip past slow shells: pair Bombers with Pulsars.'],
  },
  {
    name: 'Mirage', hits: 25, start: 400, par: 540, ai: 5,
    map: { size: 27, thorium: 1, rocks: 7,
      ridges: [[2, 12, 9, 21, 4, 16]], trenches: [[13, 11, 16, 8]] },
    hints: ['Rocks are scarce: plan every purchase and recycle what you no longer need.'],
    alt: { id: 'harvest', text: 'Or collect 700 Thorium', type: 'thorium', value: 700 },
  },
  {
    name: 'Twin Spires', hits: 28, start: 420, par: 570, ai: 5,
    map: { size: 28, layout: 'side', thorium: 2, rocks: 16,
      ridges: [[10, 10, 16, 12, 12]], trenches: [[10, 2, 10, 6, 7]] },
    hints: ['Two lanes lead to your base: split your defence or block one entirely.'],
  },
  {
    name: 'Counterstrike', hits: 30, start: 420, par: 600, ai: 6,
    map: { size: 29, thorium: 2, rocks: 16,
      ridges: [[2, 12, 11, 17, 14]], trenches: [[6, 21, 6, 16, 8], [13, 3, 13, 8]] },
    hints: ['Release your own army the moment an alien wave is spent.', 'Keep the attack menu locked and rebuild defences while it marches.'],
    extraTech: ['torpedoes'],
  },
  {
    name: "Pharaoh's Core", hits: 35, start: 440, par: 630, ai: 6,
    map: { size: 30, thorium: 2, rocks: 18,
      ridges: [[2, 12, 13, 24, 4, 16, 10, 21, 7]],
      trenches: [[17, 2, 17, 3, 14], [2, 27, 9]] },
    hints: ['The alien base is layered: expect Pulsars, Bombers and Thieves in depth.'],
    alt: { id: 'razed', text: 'Or destroy 14 alien structures', type: 'destroyStructures', value: 14 },
  },
];

export const HATHOR_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('hathor', i, s));

export const HATHOR_RESURGENCE: Mission = makeMission('hathor', 0, {
  name: 'Hathor Resurgence', hits: 80, start: 450, par: 840, ai: 10,
  map: { size: 30, layout: 'side', thorium: 1, rocks: 9,
    ridges: [[9, 2, 9, 18], [15, 2, 15, 10]],
    trenches: [[12, 7, 12, 14], [2, 6, 6, 3]] },
  extraTech: ['torpedoes', 'drone'],
}, true);
