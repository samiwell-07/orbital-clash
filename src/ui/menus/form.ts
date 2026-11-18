import type { UiNav } from '../screens/types';

export type Row =
  | { k: 'button'; id: string; label: string; enabled?: boolean; icon?: string }
  | { k: 'slider'; id: string; label: string; min: number; max: number; step: number; value: number; fmt?: (v: number) => string }
  | { k: 'choice'; id: string; label: string; options: readonly string[]; index: number }
  | { k: 'label'; id: string; label: string };

export interface FormEvent {
  /** Row whose value changed (slider/choice). */
  changed?: string;
  /** Button row confirmed. */
  activated?: string;
  back?: boolean;
}

const isSelectable = (r: Row): boolean => r.k !== 'label' && !(r.k === 'button' && r.enabled === false);

/**
 * Pure menu-form state: up/down moves between rows (skipping labels and disabled buttons, wrapping),
 * left/right adjusts sliders and choices (holding accelerates sliders), confirm activates buttons or cycles choices.
 */
export class Form {
  index = 0;
  private streak = 0;
  private sinceAdjust = 99;

  constructor(public rows: Row[]) {
    this.index = Math.max(0, rows.findIndex(isSelectable));
  }

  get current(): Row | undefined {
    return this.rows[this.index];
  }

  row(id: string): Row | undefined {
    return this.rows.find((r) => r.id === id);
  }

  value(id: string): number {
    const r = this.row(id);
    return r?.k === 'slider' ? r.value : r?.k === 'choice' ? r.index : 0;
  }

  /** Replaces rows (e.g. when the player count changes) keeping the selection on the same id when possible. */
  setRows(rows: Row[]): void {
    const id = this.current?.id;
    this.rows = rows;
    const at = rows.findIndex((r) => r.id === id);
    this.index = at >= 0 ? at : Math.min(this.index, Math.max(0, rows.length - 1));
    if (!isSelectable(rows[this.index] ?? { k: 'label', id: '', label: '' })) this.move(1);
  }

  move(dir: 1 | -1): void {
    const n = this.rows.length;
    for (let i = 1; i <= n; i++) {
      const j = (((this.index + dir * i) % n) + n) % n;
      if (isSelectable(this.rows[j])) {
        this.index = j;
        return;
      }
    }
  }

  adjust(dir: 1 | -1, mult = 1): string | undefined {
    const r = this.current;
    if (!r) return undefined;
    if (r.k === 'slider') {
      const v = Math.min(r.max, Math.max(r.min, r.value + dir * r.step * mult));
      const next = Math.round(v / r.step) * r.step;
      const clamped = Math.min(r.max, Math.max(r.min, Number(next.toFixed(6))));
      if (clamped === r.value) return undefined;
      r.value = clamped;
      return r.id;
    }
    if (r.k === 'choice') {
      const n = r.options.length;
      r.index = (((r.index + dir) % n) + n) % n;
      return r.id;
    }
    return undefined;
  }

  handle(nav: UiNav, dt: number): FormEvent {
    this.sinceAdjust += dt;
    if (nav.up) this.move(-1);
    if (nav.down) this.move(1);
    const dir = nav.left ? -1 : nav.right ? 1 : 0;
    if (dir) {
      this.streak = this.sinceAdjust < 0.5 ? this.streak + 1 : 0;
      this.sinceAdjust = 0;
      const changed = this.adjust(dir, this.streak >= 8 ? 5 : 1);
      if (changed) return { changed };
    }
    if (nav.confirm) {
      const r = this.current;
      if (r?.k === 'button' && r.enabled !== false) return { activated: r.id };
      if (r?.k === 'choice') {
        const changed = this.adjust(1);
        if (changed) return { changed };
      }
    }
    if (nav.back) return { back: true };
    return {};
  }
}

export function buttonRows(items: readonly { id: string; label: string; enabled?: boolean; icon?: string }[]): Row[] {
  return items.map((i) => ({ k: 'button' as const, ...i }));
}
