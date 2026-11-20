import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'Cloud Break', hits: 30, start: 440, par: 600, ai: 6,
    map: { size: 27, thorium: 2, rocks: 16,
      ridges: [[2, 14, 8, 17, 4]], trenches: [[16, 2, 16, 6, 21]] },
    hints: ['Drones fly straight over the maze: Lasers and Bombers are the answer.', 'Ground-only Turrets and Pulsars cannot touch aircraft.'],
  },
  {
    name: 'Switchyard', hits: 32, start: 460, par: 630, ai: 6,
    map: { size: 28, thorium: 2, rocks: 16,
      ridges: [[2, 11, 10, 14, 12], [2, 17, 8, 20, 12]],
      trenches: [[4, 14, 9], [4, 23, 9, 25]] },
    hints: ['Switches disable a structure for a few seconds: aim them at enemy weapons.', 'Send a Switch ahead of your column to open a hole in the defence.'],
  },
  {
    name: 'Updraft', hits: 35, start: 460, par: 660, ai: 7,
    map: { size: 29, layout: 'side', thorium: 2, rocks: 16,
      ridges: [[2, 6, 7, 9, 10, 12, 13, 15]], trenches: [[7, 2, 10, 5, 13, 8, 16]] },
    hints: ['Build a hybrid defence: Lasers for air, Pulsars for the ground crowd.'],
  },
  {
    name: 'Frostbite', hits: 35, start: 480, par: 660, ai: 7,
    map: { size: 28, thorium: 1, rocks: 9,
      ridges: [[12, 3, 21, 12, 15], [2, 13, 8]], trenches: [[18, 5, 15, 9, 18]] },
    hints: ['Recycle spent towers and rebuild where the pressure is.'],
    alt: { id: 'thaw', text: 'Or destroy 12 alien structures', type: 'destroyStructures', value: 12 },
  },
  {
    name: 'Torpedo Run', hits: 40, start: 480, par: 690, ai: 7,
    map: { size: 29, thorium: 2, rocks: 16,
      ridges: [[2, 11, 19, 8, 16], [6, 14, 11]],
      trenches: [[14, 2, 14, 7, 12], [2, 20, 6, 24]] },
    hints: ['Torpedoes are fast and fragile: a Pulsar speed trap pops them.', 'Your own Torpedoes shatter structures: send them after their Pulsars.'],
  },
  {
    name: 'Skybridge', hits: 40, start: 500, par: 720, ai: 7,
    map: { size: 29, layout: 'side', thorium: 2, rocks: 16,
      ridges: [[9, 2, 9, 12, 18, 8]], trenches: [[13, 4, 13, 9, 16], [2, 6, 6]] },
    hints: ['A Carrier airlifts up to 20 ground units over the maze straight into the base.', 'Stop enemy Carriers with Lasers before they reach you.'],
  },
  {
    name: 'Zenith Core', hits: 45, start: 500, par: 750, ai: 8,
    map: { size: 30, thorium: 2, rocks: 18,
      ridges: [[12, 6, 22, 16, 19], [2, 12, 6, 15, 9]],
      trenches: [[13, 10, 18, 15], [18, 2, 23]] },
    hints: ['Air and ground arrive together: layer Lasers behind Pulsars.'],
  },
];

export const AETHER_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('aether', i, s));

export const AETHER_RESURGENCE: Mission = makeMission('aether', 0, {
  name: 'Aether Resurgence', hits: 90, start: 450, par: 960, ai: 10,
  map: { size: 30, layout: 'side', thorium: 1, rocks: 9,
    ridges: [[2, 7, 10, 13, 13, 17, 10], [8, 2, 14, 6, 17, 10]],
    trenches: [[2, 3, 5, 5], [13, 10, 13, 8, 10]] },
  extraTech: ['waypoint'],
}, true);
