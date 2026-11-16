import type { BuildAction } from '../types';

/**
 * Single source of truth for hotkeys. Used by PlayerController (input) and the sidebar (labels).
 * Each action accepts a list of KeyboardEvent.code values; `label` is what the sidebar shows.
 */
export interface KeyBinding {
  action: BuildAction;
  codes: string[];
  label: string;
}

export interface KeyBindings {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  /** Context action: drop/pick up rock, else upgrade own tower, else build selected tower. */
  act: string[];
  actLabel: string;
  moveLabel: string;
  slots: KeyBinding[];
}

export const P1_BINDINGS: KeyBindings = {
  up: ['KeyW'],
  down: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  act: ['Space'],
  actLabel: 'SPACE',
  moveLabel: 'WASD',
  slots: [
    { action: { type: 'build', kind: 'laser' }, codes: ['Digit1'], label: '1' },
    { action: { type: 'build', kind: 'cannon' }, codes: ['Digit2'], label: '2' },
    { action: { type: 'build', kind: 'cryo' }, codes: ['Digit3'], label: '3' },
    { action: { type: 'build', kind: 'plasma' }, codes: ['Digit4'], label: '4' },
    { action: { type: 'build', kind: 'refinery' }, codes: ['Digit5'], label: '5' },
    { action: { type: 'upgrade' }, codes: ['KeyX'], label: 'X' },
    { action: { type: 'sell' }, codes: ['KeyC'], label: 'C' },
    { action: { type: 'send', kind: 'scout' }, codes: ['KeyQ'], label: 'Q' },
    { action: { type: 'send', kind: 'tank' }, codes: ['KeyE'], label: 'E' },
    { action: { type: 'send', kind: 'shielded' }, codes: ['KeyR'], label: 'R' },
    { action: { type: 'send', kind: 'bomber' }, codes: ['KeyF'], label: 'F' },
    { action: { type: 'launch' }, codes: ['KeyG'], label: 'G' },
    { action: { type: 'research', kind: 'maxLevel3' }, codes: ['Digit6'], label: '6' },
    { action: { type: 'research', kind: 'swarmSpeed' }, codes: ['Digit7'], label: '7' },
    { action: { type: 'research', kind: 'doubleHarvest' }, codes: ['Digit8'], label: '8' },
  ],
};

export const P2_BINDINGS: KeyBindings = {
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  act: ['Enter'],
  actLabel: 'ENTER',
  moveLabel: 'ARROWS',
  slots: [
    { action: { type: 'build', kind: 'laser' }, codes: ['Numpad1', 'KeyY'], label: 'N1' },
    { action: { type: 'build', kind: 'cannon' }, codes: ['Numpad2', 'KeyU'], label: 'N2' },
    { action: { type: 'build', kind: 'cryo' }, codes: ['Numpad3', 'KeyI'], label: 'N3' },
    { action: { type: 'build', kind: 'plasma' }, codes: ['Numpad4', 'KeyO'], label: 'N4' },
    { action: { type: 'build', kind: 'refinery' }, codes: ['Numpad5', 'KeyP'], label: 'N5' },
    { action: { type: 'upgrade' }, codes: ['Numpad0', 'KeyN'], label: 'N0' },
    { action: { type: 'sell' }, codes: ['NumpadDecimal', 'KeyM'], label: 'N.' },
    { action: { type: 'send', kind: 'scout' }, codes: ['Numpad7', 'KeyH'], label: 'N7' },
    { action: { type: 'send', kind: 'tank' }, codes: ['Numpad8', 'KeyJ'], label: 'N8' },
    { action: { type: 'send', kind: 'shielded' }, codes: ['Numpad9', 'KeyK'], label: 'N9' },
    { action: { type: 'send', kind: 'bomber' }, codes: ['NumpadAdd', 'KeyL'], label: 'N+' },
    { action: { type: 'launch' }, codes: ['NumpadEnter', 'Semicolon'], label: 'N↵' },
    { action: { type: 'research', kind: 'maxLevel3' }, codes: ['NumpadDivide', 'Comma'], label: 'N/' },
    { action: { type: 'research', kind: 'swarmSpeed' }, codes: ['NumpadMultiply', 'Period'], label: 'N*' },
    { action: { type: 'research', kind: 'doubleHarvest' }, codes: ['NumpadSubtract', 'Slash'], label: 'N-' },
  ],
};

/** Global keys handled by Game (M is taken by P2's alternate sell key, so mute uses ` or F2). */
export const PAUSE_CODES = ['Escape'];
export const MUTE_CODES = ['Backquote', 'F2'];
