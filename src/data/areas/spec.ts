import type { CometId, Mission, Objective, UnitKind, WeaponKind } from '@/types';
import { DIFFICULTY_MULT } from '@/config/constants';
import { makeMap } from './builders';
import type { MapSpec } from './builders';
import { Layout } from './layout';
import { registerSeed } from './seeds';
import { Script } from './script';

export const COMETS: readonly CometId[] = ['kreios', 'hathor', 'aether', 'helios'];

/** Tech each area newly teaches (Fandom unlock order); null = nothing new. */
export const TEACH: Readonly<Record<CometId, readonly (string | null)[]>> = {
  kreios: ['tank', 'laser', 'gateways', null, 'hammers', null, null],
  hathor: ['pulsar', 'thief', 'bomber', null, null, null, null],
  aether: ['drone', 'switches', null, null, 'torpedoes', 'carrier', null],
  helios: [null, 'waypoint', null, null, null, null, null],
};

/** Human tech at the start of an area: everything taught by earlier areas (a Resurgence has all of its comet). */
export function unlockedBefore(comet: CometId, index: number, resurgence: boolean): string[] {
  const out: string[] = [];
  for (const c of COMETS) {
    const upTo = c === comet ? (resurgence ? 7 : index) : COMETS.indexOf(c) < COMETS.indexOf(comet) ? 7 : 0;
    for (const k of TEACH[c].slice(0, upTo)) if (k) out.push(k);
  }
  return out;
}

export interface AreaSpec {
  name: string;
  /** Enemy base hits on Normal; other difficulties scale by DIFFICULTY_MULT. */
  hits: number;
  start: number;
  par: number;
  /** Aggression 1..10: defence count, wave size and frequency. */
  ai: number;
  map: Omit<MapSpec, 'id' | 'name' | 'palette'>;
  hints?: readonly string[];
  /** Alien tech the enemy owns in this area on top of what the player has. */
  extraTech?: readonly string[];
  /** Alternative way to win (any objective met wins). */
  alt?: Objective;
}

const WEAPON_ORDER: Record<CometId, WeaponKind[]> = {
  kreios: ['turret', 'laser'], hathor: ['pulsar', 'turret', 'bomber', 'laser'],
  aether: ['laser', 'bomber', 'turret', 'pulsar'], helios: ['bomber', 'pulsar', 'laser', 'turret'],
};
const UNIT_ORDER: Record<CometId, UnitKind[]> = {
  kreios: ['scout', 'tank', 'hammer'], hathor: ['scout', 'thief', 'tank', 'torpedo'],
  aether: ['scout', 'drone', 'carrier', 'switch', 'torpedo', 'tank'],
  helios: ['scout', 'tank', 'drone', 'torpedo', 'hammer', 'thief', 'switch', 'carrier'],
};
const UNIT_TECH: Partial<Record<UnitKind, string>> = {
  tank: 'tank', drone: 'drone', torpedo: 'torpedoes', hammer: 'hammers', thief: 'thief', switch: 'switches', carrier: 'carrier',
};
const WEAPON_TECH: Partial<Record<WeaponKind, string>> = { laser: 'laser', pulsar: 'pulsar', bomber: 'bomber' };
const BASIC_LEVEL: Partial<Record<UnitKind, number>> = { scout: 0, tank: 1, drone: 2, torpedo: 3 };

function waveCount(kind: UnitKind, ai: number, k: number, joined: number, bonus: number): number {
  const base = kind === 'scout' ? 3 + 2 * ai : BASIC_LEVEL[kind] !== undefined ? 1 + 0.7 * ai : 1 + Math.floor(ai / 3);
  return Math.max(1, Math.round(base * (1 + 0.35 * (k - joined)) * bonus));
}

function buildScript(comet: CometId, spec: AreaSpec, enemyTech: Set<string>, alien: string[], layout: Layout, resurgence: boolean): Script {
  const s = new Script();
  const { ai, par } = spec;
  const weapons = WEAPON_ORDER[comet].filter((w) => !WEAPON_TECH[w] || enemyTech.has(WEAPON_TECH[w] as string));
  const units = UNIT_ORDER[comet].filter((u) => !UNIT_TECH[u] || enemyTech.has(UNIT_TECH[u] as string))
    .slice(0, 1 + Math.ceil(ai / 2.5));
  const at = (frac: number) => Math.round(par * frac);
  const bonus = resurgence ? 1.25 : 1;
  const front = layout.pick(1 + Math.floor(ai / 3), layout.enemy, 2, 7, true);
  front.forEach((t, i) => s.preplace(weapons[i % weapons.length], t.tx, t.ty));
  const home = layout.pick(1, layout.enemy, 2, 4, false);
  if (home[0]) s.preplace('basicOps', home[0].tx, home[0].ty);

  for (const key of alien) s.unlock(0, key);
  s.message(0, `${spec.name}: the aliens are dug in. Hold your lines and strike their base.`);

  const defs = layout.pick(2 + ai, layout.enemy, 2, 8, true);
  defs.forEach((t, i) => s.build(6 + Math.round((i * par * 0.45) / defs.length), weapons[(i + 1) % weapons.length], t.tx, t.ty));
  const towers = units.filter((u) => u !== 'scout');
  const basics = towers.filter((u) => BASIC_LEVEL[u] !== undefined);
  const specials = towers.filter((u) => BASIC_LEVEL[u] === undefined);
  const slots = layout.pick(basics.length + (specials.length > 0 ? 1 : 0), layout.enemy, 2, 6, false);
  basics.forEach((u, i) => slots[i] && s.build(at(0.12) + i * 4, 'basicOps', slots[i].tx, slots[i].ty, BASIC_LEVEL[u] as number, u));
  const sp = slots[basics.length];
  if (sp && specials.length > 0) {
    s.build(at(0.2), 'specialOps', sp.tx, sp.ty, 0, specials[0]);
    if (specials[1]) s.setOutput(at(0.55), sp.tx, sp.ty, specials[1]);
  }
  const ups = [...front, ...defs.slice(0, 1 + Math.floor(ai / 2))];
  ups.forEach((t, i) => {
    if (i < 3) s.upgrade(at(0.35) + i * 6, t.tx, t.ty);
  });

  const waves = 3 + Math.ceil(ai * 0.6) + (resurgence ? 2 : 0);
  const t0 = Math.max(resurgence ? at(0.1) : at(0.2), 30);
  const step = (at(0.85) - t0) / (waves - 1);
  for (let k = 0; k < waves; k++) {
    const t = Math.round(t0 + k * step);
    const mix = units.filter((_, j) => j <= k);
    const total = mix.reduce((n, u, j) => n + waveCount(u, ai, k, j, bonus), 0);
    s.message(Math.max(0, t - 2), `Alien wave ${k + 1} of ${waves} is launching (${total} units).`);
    mix.forEach((u, j) => s.release(t, u, waveCount(u, ai, k, j, bonus)));
  }
  if (ai >= 3) {
    s.message(at(0.9) - 1, 'The aliens throw everything they have left at your base!');
    s.releaseAll(at(0.92));
  }
  return s;
}

/** Builds one authored Mission: own map, scripted enemy timeline, objectives, hints, par and difficulty ramp. */
export function makeMission(comet: CometId, index: number, spec: AreaSpec, resurgence = false): Mission {
  const id = resurgence ? `${comet}-r` : `${comet}-${index + 1}`;
  const teaches = resurgence ? null : TEACH[comet][index];
  const unlocked = unlockedBefore(comet, index, resurgence);
  const map = makeMap({ ...spec.map, id: `campaign-${id}`, name: spec.name, palette: comet });
  const layout = new Layout(map);
  const enemyTech = new Set([...unlocked, ...(teaches ? [teaches] : []), ...(spec.extraTech ?? [])]);
  // `teaches` is granted to every player by createWorld; the script only unlocks the enemy's extra alien tech.
  const alien = [...(spec.extraTech ?? [])];
  const script = buildScript(comet, spec, enemyTech, alien, layout, resurgence);
  const m = DIFFICULTY_MULT;
  const hit = (mult: number) => Math.min(100, Math.max(1, Math.round(spec.hits * mult)));
  const objectives: Objective[] = [{ id: 'base', text: 'Destroy the alien base', type: 'destroyBase', value: 1 }];
  if (spec.alt) objectives.push(spec.alt);
  registerSeed(id, script.stock());
  return {
    id, comet, index, name: spec.name, profile: 'base', map, startThorium: spec.start, unlocked, teaches,
    preplaced: script.pre, timeline: script.events, objectives, parTimeSec: spec.par, resurgence,
    hints: resurgence ? [] : spec.hints ?? [],
    enemyHits: {
      beginner: hit(m.beginner.enemy), casual: hit(m.casual.enemy), normal: hit(m.normal.enemy), expert: hit(m.expert.enemy),
    },
  };
}
