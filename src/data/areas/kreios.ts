import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'First Impact', hits: 5, start: 300, par: 240, ai: 1,
    map: { w: 30, h: 20, style: 'plain', seed: 101, thorium: 2, rocks: 10 },
    hints: ['Open the build menu with R1/E and drop Turrets on the path to your base.', 'Grab rocks and drag them to a Turret to smash them for Thorium.', 'Build a Basic Ops tower, then open the attack menu to send Scouts at the alien base.'],
  },
  {
    name: 'Rock Fall', hits: 8, start: 300, par: 300, ai: 1,
    map: { w: 30, h: 20, style: 'plain', layout: 'side', seed: 102, thorium: 3, rocks: 24, craters: 8 },
    hints: ['Meteoroids keep falling: smash them with Turrets and Lasers to fund your army.', 'Lasers hit ground and air and smash rocks; place one near the rock lanes.'],
  },
  {
    name: 'Crossroads', hits: 10, start: 300, par: 360, ai: 2,
    map: { w: 34, h: 22, style: 'lanes', seed: 103, thorium: 2, rocks: 14 },
    hints: ['Units follow the shortest open path: wall off one lane to steer them into your Turrets.', 'Never seal the base completely: leave one route open.', 'Gateways teleport ground units between paired tiles.'],
    alt: { id: 'sweep', text: 'Or destroy 6 alien structures', type: 'destroyStructures', value: 6 },
  },
  {
    name: 'Hold the Line', hits: 12, start: 320, par: 390, ai: 2,
    map: { w: 34, h: 22, style: 'rooms', layout: 'side', seed: 104, thorium: 2, rocks: 14 },
    hints: ['Upgrade weapons to add black corner marks; maxed towers grow bigger.', 'Recycle a damaged tower for a partial refund, or repair it when Thorium allows.'],
    extraTech: ['pulsar'],
  },
  {
    name: 'Hammer Time', hits: 15, start: 340, par: 420, ai: 3,
    map: { w: 36, h: 24, style: 'spires', seed: 105, thorium: 2, rocks: 16 },
    hints: ['Special Ops towers build Hammers: slow, heavy siege units that crush structures.', 'Hold the build button on a tower to cycle its output.'],
  },
  {
    name: 'Pressure Point', hits: 15, start: 340, par: 420, ai: 3,
    map: { w: 40, h: 26, style: 'maze', seed: 106, thorium: 2, rocks: 16 },
    hints: ['Lock the attack menu so units keep streaming while you build.', 'Stack Tanks and Hammers, then release them together.'],
  },
  {
    name: 'Crater Core', hits: 20, start: 360, par: 480, ai: 4,
    map: { w: 44, h: 28, style: 'ring', seed: 107, thorium: 2, rocks: 18 },
    hints: ['Defend and attack at once: keep Turrets and Lasers on both rings.', 'Time your release for just after a wave dies on your defences.'],
  },
];

export const KREIOS_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('kreios', i, s));

export const KREIOS_RESURGENCE: Mission = makeMission('kreios', 0, {
  name: 'Kreios Resurgence', hits: 70, start: 450, par: 720, ai: 10,
  map: { w: 48, h: 30, style: 'ring', layout: 'side', seed: 190, thorium: 1, rocks: 10, craters: 20 },
  extraTech: ['thief'],
}, true);
