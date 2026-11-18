import type { Difficulty } from '../../types';
import type { Settings } from '../../meta/settings';
import { drawText, COLORS } from '../theme';
import { Form, type Row } from '../menus/form';
import { drawForm } from '../menus/formDraw';
import { drawFooter, drawHeader } from './common';
import type { Screen } from './types';

const LAYOUTS = ['16:9', '4:3'] as const;
const DISPLAYS = ['gamepad', 'keyboard'] as const;
export const DIFFICULTY_ORDER: readonly Difficulty[] = ['beginner', 'casual', 'normal', 'expert'];
export const DIFFICULTY_LABELS = ['Beginner', 'Casual', 'Normal (Ranked)', 'Expert'];
const pct = (v: number): string => `${Math.round(v * 100)}%`;

export function settingsRows(s: Settings): Row[] {
  return [
    { k: 'slider', id: 'master', label: 'Master Volume', min: 0, max: 1, step: 0.05, value: s.masterVolume, fmt: pct },
    { k: 'slider', id: 'sfx', label: 'Effects Volume', min: 0, max: 1, step: 0.05, value: s.sfxVolume, fmt: pct },
    { k: 'slider', id: 'music', label: 'Music Volume', min: 0, max: 1, step: 0.05, value: s.musicVolume, fmt: pct },
    { k: 'choice', id: 'layout', label: 'Video Layout', options: ['16:9 Widescreen', '4:3 Safe Area'], index: LAYOUTS.indexOf(s.videoLayout) },
    { k: 'choice', id: 'display', label: 'Controls Shown', options: ['Gamepad', 'Keyboard'], index: DISPLAYS.indexOf(s.controlsDisplay) },
    { k: 'choice', id: 'difficulty', label: 'Default Difficulty', options: DIFFICULTY_LABELS, index: Math.max(0, DIFFICULTY_ORDER.indexOf(s.defaultDifficulty)) },
    { k: 'button', id: 'back', label: 'Back' },
  ];
}

export function applyForm(base: Settings, form: Form): Settings {
  return {
    ...base,
    masterVolume: form.value('master'),
    sfxVolume: form.value('sfx'),
    musicVolume: form.value('music'),
    videoLayout: LAYOUTS[form.value('layout')] ?? base.videoLayout,
    controlsDisplay: DISPLAYS[form.value('display')] ?? base.controlsDisplay,
    defaultDifficulty: DIFFICULTY_ORDER[form.value('difficulty')] ?? base.defaultDifficulty,
  };
}

export function createSettingsScreen(): Screen {
  let form: Form | null = null;
  let base: Settings | null = null;
  return {
    id: 'settings',
    update(nav, dt, ctx) {
      if (!form || !base) {
        base = ctx.data.save.settings;
        form = new Form(settingsRows(base));
      }
      const ev = form.handle(nav, dt);
      if (ev.back || ev.activated === 'back') return { t: 'pop' };
      if (ev.changed) {
        base = applyForm(base, form);
        return { t: 'settingsChanged', settings: base };
      }
      return null;
    },
    draw(g, size, now, ctx) {
      form ??= new Form(settingsRows(ctx.data.save.settings));
      drawHeader(g, size.w, 'Settings', 'Audio, video layout and controls');
      const w = 760;
      drawForm(g, form, { x: (size.w - w) / 2, y: 200, w, h: size.h - 330 }, now, { rowH: 54, gap: 10 });
      drawText(g, 'Changes are saved automatically', size.w / 2, size.h - 100, { size: 15, color: COLORS.dim, align: 'center' });
      drawFooter(g, size.h, ctx.data.save.settings.controlsDisplay, [{ key: 'move', label: 'Select' }, { key: 'adjust', label: 'Adjust' }, { key: 'back', label: 'Back' }]);
    },
  };
}
