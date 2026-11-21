import type { Emit, System, Unit, Vec2, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { ensureFlow, flowDir, flowDist, FLOW_INF } from '@/sim/core';
import { AIR_HEIGHT } from './constants';
import { arrive, atTargetBase, killUnit } from './arrive';
import { chewFor, chewStructure, descend, inChewRange } from './chew';
import { getUnitBehavior, hasUnitBehaviors } from './hooks';
import {
  attachUnit, createTrain, extendTrain, linkOf, sampleTrain, spacingFor,
  type Link, type Train,
} from './train';

const dir: Vec2 = { x: 0, y: 0 };
const pos: Vec2 = { x: 0, y: 0 };
const EPS = 1e-9;

/** Free-running head: advances the tip by up to `rem` tiles (flow field, straight line for air, or chewing). */
function freeMove(w: World, u: Unit, train: Train, rem: number): void {
  const tx = train.hx;
  const ty = train.hy;
  if (u.layer === 'air') {
    const p = w.players[u.targetPlayer];
    if (!p.baseBuilt) return;
    const dx = p.baseTx + 0.5 - tx;
    const dy = p.baseTy + 0.5 - ty;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < EPS) return;
    const step = Math.min(rem, d);
    extendTrain(train, tx + (dx / d) * step, ty + (dy / d) * step);
    u.travelled = train.len;
    return;
  }
  const field = ensureFlow(w, u.targetPlayer);
  flowDir(field, tx, ty, dir);
  if (dir.x === 0 && dir.y === 0) {
    if (flowDist(field, tx, ty) !== FLOW_INF) return;
    const c = chewFor(w, u.owner, u.targetPlayer, Math.floor(tx), Math.floor(ty));
    if (!c) return;
    if (c.s.hp > 0 && inChewRange(tx, ty, c.s)) {
      train.chewS = c.s;
      return;
    }
    descend(w, c.approach, tx, ty, dir);
    if (dir.x === 0 && dir.y === 0) return;
  }
  extendTrain(train, tx + dir.x * rem, ty + dir.y * rem);
  u.travelled = train.len;
}

function advance(w: World, u: Unit, link: Link, dt: number, emit: Emit): void {
  const train = link.train;
  const def = UNIT_DEFS[u.kind];
  if (!train.record) {
    train.hx = u.x;
    train.hy = u.y;
  }
  let lead = link.prev;
  while (lead !== null && lead.unit.state === 'dead') lead = lead.prev;
  link.prev = lead;

  let rem = def.speed * dt;
  if (lead !== null) {
    const room = lead.unit.travelled - spacingFor(u.kind) - u.travelled;
    if (room < rem) rem = room > 0 ? room : 0;
  } else {
    train.chewS = null;
  }

  const before = u.travelled;
  if (rem > 0 && u.travelled < train.len) {
    const s = Math.min(rem, train.len - u.travelled);
    u.travelled += s;
    rem -= s;
  }
  if (rem > EPS && lead === null) freeMove(w, u, train, rem);

  if (u.travelled !== before) {
    sampleTrain(train, u.travelled, pos);
    const dx = pos.x - u.x;
    const dy = pos.y - u.y;
    if (dx * dx + dy * dy > 1e-8) u.heading = Math.atan2(dy, dx);
    u.x = pos.x;
    u.y = pos.y;
  }
  if (u.layer === 'air') u.z = AIR_HEIGHT;

  const cs = train.chewS;
  if (cs !== null && cs.hp > 0 && def.structureDamage > 0 && u.layer === 'ground' && inChewRange(u.x, u.y, cs)) {
    u.state = 'attacking';
    chewStructure(w, u, cs, def, dt, emit);
  } else if (u.state === 'attacking') {
    u.state = 'marching';
  }

  if (atTargetBase(w, u)) arrive(w, u, emit);
}

/** Units not created by the launcher (scripts, tests) become one-unit trains at their current position. */
function adopt(u: Unit): Link {
  u.travelled = 0;
  return attachUnit(u, createTrain(u.x, u.y, false), null);
}

/** Stage 'movement': snake-style train marching, chewing, arrival. Allocation-free per tick. */
export const marchSystem: System = (w, dt, emit) => {
  const units = w.units;
  const behaviors = hasUnitBehaviors();
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.state === 'dead') continue;
    if (u.hp <= 0) {
      killUnit(w, u, emit);
      continue;
    }
    if (u.state === 'guarding') continue;
    const link = linkOf(u) ?? adopt(u);
    if (behaviors) {
      const b = getUnitBehavior(u.kind);
      if (b && b(w, u, dt, emit)) continue;
    }
    advance(w, u, link, dt, emit);
  }
};
