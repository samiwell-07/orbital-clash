import type { Mission } from '@/types';
import { makeMission } from './spec';
import type { AreaSpec } from './spec';

const SPECS: readonly AreaSpec[] = [
  {
    name: 'Cloud Break', hits: 30, start: 440, par: 600, ai: 6,
    map: { w: 40, h: 26, style: 'plain', seed: 301, thorium: 2, rocks: 16, craters: 14 },
    hints: ['Drones fly straight over the maze: Lasers and Bombers are the answer.', 'Ground-only Turrets and Pulsars cannot touch aircraft.'],
  },
  {
    name: 'Switchyard', hits: 32, start: 460, par: 630, ai: 6,
    map: { w: 40, h: 26, style: 'lanes', seed: 302, thorium: 2, rocks: 16 },
    hints: ['Switches disable a structure for a few seconds: aim them at enemy weapons.', 'Send a Switch ahead of your column to open a hole in the defence.'],
  },
  {
    name: 'Updraft', hits: 35, start: 460, par: 660, ai: 7,
    map: { w: 42, h: 28, style: 'spires', layout: 'side', seed: 303, thorium: 2, rocks: 16 },
    hints: ['Build a hybrid defence: Lasers for air, Pulsars for the ground crowd.'],
  },
  {
    name: 'Frostbite', hits: 35, start: 480, par: 660, ai: 7,
    map: { w: 42, h: 28, style: 'rooms', seed: 304, thorium: 1, rocks: 9 },
    hints: ['Recycle spent towers and rebuild where the pressure is.'],
    alt: { id: 'thaw', text: 'Or destroy 12 alien structures', type: 'destroyStructures', value: 12 },
  },
  {
    name: 'Torpedo Run', hits: 40, start: 480, par: 690, ai: 7,
    map: { w: 44, h: 28, style: 'maze', seed: 305, thorium: 2, rocks: 16 },
    hints: ['Torpedoes are fast and fragile: a Pulsar speed trap pops them.', 'Your own Torpedoes shatter structures: send them after their Pulsars.'],
  },
  {
    name: 'Skybridge', hits: 40, start: 500, par: 720, ai: 7,
    map: { w: 46, h: 28, style: 'lanes', layout: 'side', seed: 306, thorium: 2, rocks: 16 },
    hints: ['A Carrier airlifts up to 20 ground units over the maze straight into the base.', 'Stop enemy Carriers with Lasers before they reach you.'],
  },
  {
    name: 'Zenith Core', hits: 45, start: 500, par: 750, ai: 8,
    map: { w: 48, h: 30, style: 'ring', seed: 307, thorium: 2, rocks: 18 },
    hints: ['Air and ground arrive together: layer Lasers behind Pulsars.'],
  },
];

export const AETHER_AREAS: readonly Mission[] = SPECS.map((s, i) => makeMission('aether', i, s));

export const AETHER_RESURGENCE: Mission = makeMission('aether', 0, {
  name: 'Aether Resurgence', hits: 90, start: 450, par: 960, ai: 10,
  map: { w: 48, h: 30, style: 'spires', layout: 'side', seed: 390, thorium: 1, rocks: 9, craters: 22 },
  extraTech: ['waypoint'],
}, true);
