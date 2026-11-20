import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'First Impact', hits: 5, start: 300, par: 240, ai: 1,
    map: { size: 22, thorium: 2, rocks: 10,
      ridges: [[2, 13, 5]], trenches: [[13, 3, 16, 5]] },
    hints: ['Open the build menu (RB · R1 / Shift) and place Turrets (A · Cross / E) on the path to your base.', 'Build a Harvester, then grab rocks with your ship (RT · R2 / G) and drop them inside its magnet for Thorium.', 'Build a Basic Ops tower, then tilt the right stick (or arrow keys) toward Scouts to send them at the alien base. Show the attack menu with (RS click · R3 / Space).'],
  },
  {
    name: 'Rock Fall', hits: 8, start: 300, par: 300, ai: 1,
    map: { size: 24, layout: 'side', thorium: 3, rocks: 24,
      ridges: [[2, 4, 9, 6]], trenches: [[12, 2, 12, 7, 15]] },
    hints: ['Meteoroids keep falling: feed them to your Harvesters to fund your army.', 'Upgrade a Harvester to widen its magnet; big rocks take longer but pay much more.'],
  },
  {
    name: 'Crossroads', hits: 10, start: 300, par: 360, ai: 2,
    map: { size: 24, thorium: 2, rocks: 14,
      ridges: [[2, 12, 8, 14]], trenches: [[12, 2, 12, 7, 14]] },
    hints: ['Units follow the shortest open path: wall off one lane to steer them into your Turrets.', 'Never seal the base completely: leave one route open.', 'Gateways teleport ground units between paired tiles.'],
    alt: { id: 'sweep', text: 'Or destroy 6 alien structures', type: 'destroyStructures', value: 6 },
  },
  {
    name: 'Hold the Line', hits: 12, start: 320, par: 390, ai: 2,
    map: { size: 25, layout: 'side', thorium: 2, rocks: 14,
      ridges: [[10, 2, 10, 14]], trenches: [[2, 20, 7, 18]] },
    hints: ['Upgrade weapons to add black corner marks; maxed towers grow bigger.', 'Recycle a damaged tower for a partial refund, or repair it when Thorium allows.'],
    extraTech: ['pulsar'],
  },
  {
    name: 'Hammer Time', hits: 15, start: 340, par: 420, ai: 3,
    map: { size: 26, thorium: 2, rocks: 16,
      ridges: [[2, 19, 5, 16, 8, 13, 11]], trenches: [[2, 23, 8, 20, 11, 17, 14]] },
    hints: ['Special Ops towers build Hammers: slow, heavy siege units that crush structures.', 'Hold the build button (A · Cross / E) on a spawn tower to cycle its output.'],
  },
  {
    name: 'Pressure Point', hits: 15, start: 340, par: 420, ai: 3,
    map: { size: 27, thorium: 2, rocks: 16,
      ridges: [[2, 11, 15, 7, 12]], trenches: [[5, 18, 5, 15, 11, 20, 8]] },
    hints: ['Lock the attack menu so units keep streaming while you build.', 'Stack Tanks and Hammers, then release them together.'],
  },
  {
    name: 'Crater Core', hits: 20, start: 360, par: 480, ai: 4,
    map: { size: 28, thorium: 2, rocks: 18,
      ridges: [[14, 8, 19, 18]], trenches: [[12, 11, 16, 14]] },
    hints: ['Defend and attack at once: keep Turrets and Lasers on both rings.', 'Time your release for just after a wave dies on your defences.'],
  },
];

export const KREIOS_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('kreios', i, s));

export const KREIOS_RESURGENCE: Mission = makeMission('kreios', 0, {
  name: 'Kreios Resurgence', hits: 70, start: 450, par: 720, ai: 10,
  map: { size: 30, layout: 'side', thorium: 1, rocks: 10,
    ridges: [[11, 8, 20, 18, 17], [2, 6, 8, 3]],
    trenches: [[12, 11, 17, 15], [12, 2, 12, 5, 21]] },
  extraTech: ['thief'],
}, true);
