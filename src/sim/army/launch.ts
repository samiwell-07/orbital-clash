import type { Emit, Player, PlayerId, System, UnitKind, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { addUnit } from '@/sim/core';
import { AIR_HEIGHT, RELEASE_RATE } from './constants';
import { storedOf, takeStored } from './storage';
import { attachUnit, createTrain, spacingFor, type Link } from './train';

interface Release {
  acc: number[];
  tail: (Link | null)[];
}

const states = new WeakMap<World, Release>();

function stateFor(w: World): Release {
  let s = states.get(w);
  if (!s) {
    s = { acc: [0, 0, 0, 0], tail: [null, null, null, null] };
    states.set(w, s);
  }
  return s;
}

function validTarget(w: World, p: Player, t: PlayerId): boolean {
  const q = w.players[t];
  return t !== p.id && q.alive && q.baseBuilt && q.team !== p.team;
}

/** The player's attack target, re-aimed at the next living enemy when the stored one is gone. -1 when none. */
export function resolveTarget(w: World, p: Player): PlayerId | -1 {
  const cur = p.attack.targetPlayer;
  if (validTarget(w, p, cur)) return cur;
  for (let i = 1; i <= 4; i++) {
    const t = ((cur + i) % 4) as PlayerId;
    if (validTarget(w, p, t)) {
      p.attack.targetPlayer = t;
      return t;
    }
  }
  return -1;
}

/** Releases one stored unit at the base, chained behind `tail` (null starts a new train). */
function launchOne(w: World, p: Player, kind: UnitKind, target: PlayerId, tail: Link | null): Link {
  const def = UNIT_DEFS[kind];
  takeStored(p, kind, 1);
  const x = p.baseTx + 0.5;
  const y = p.baseTy + 0.5;
  const unit = addUnit(w, {
    kind, owner: p.id, targetPlayer: target, x, y,
    z: def.layer === 'air' ? AIR_HEIGHT : 0,
    hp: def.hp, maxHp: def.hp, layer: def.layer,
    trainIndex: tail ? tail.unit.trainIndex + 1 : 0,
  });
  p.stats.unitsLaunched++;
  return attachUnit(unit, tail ? tail.train : createTrain(x, y, true), tail);
}

/**
 * Releases up to `count` stored units at once as one train toward the owner's target (scripts, AI
 * waves). Followers queue inside the base and leave single-file at the train spacing.
 * Returns how many were launched.
 */
export function launchBatch(w: World, owner: PlayerId, kind: UnitKind, count: number, emit?: Emit): number {
  const p = w.players[owner];
  const target = resolveTarget(w, p);
  if (target < 0 || !p.baseBuilt) return 0;
  const n = Math.min(count, storedOf(p, kind));
  let tail: Link | null = null;
  for (let i = 0; i < n; i++) tail = launchOne(w, p, kind, target as PlayerId, tail);
  if (n > 0 && emit) emit({ t: 'unitLaunched', owner, kind, count: n });
  return n;
}

/** Stage 'launch': while a kind is selected (or locked) release stored units one by one as a train. */
export const launchSystem: System = (w, dt, emit) => {
  const st = stateFor(w);
  for (const p of w.players) {
    const id = p.id;
    const kind = p.attack.selected;
    const target = kind !== null && p.alive && p.baseBuilt ? resolveTarget(w, p) : -1;
    if (kind === null || target < 0 || storedOf(p, kind) <= 0) {
      st.acc[id] = 0;
      st.tail[id] = null;
      continue;
    }
    let tail = st.tail[id];
    if (tail && (tail.unit.state === 'dead' || tail.unit.kind !== kind || tail.unit.targetPlayer !== target)) tail = null;
    let acc = st.acc[id] + RELEASE_RATE * dt;
    const gap = spacingFor(kind);
    let launched = 0;
    while (acc >= 1 && storedOf(p, kind) > 0) {
      if (tail && tail.unit.travelled < gap) break;
      tail = launchOne(w, p, kind, target as PlayerId, tail);
      acc -= 1;
      launched++;
    }
    st.acc[id] = Math.min(acc, 1);
    st.tail[id] = tail;
    if (launched > 0) emit({ t: 'unitLaunched', owner: id, kind, count: launched });
  }
};
