import type { EntityId, PlayerId, Projectile, Rock, Structure, Unit, World } from '@/types';
import { occupy, vacate } from './grid';

export function newId(w: World): EntityId {
  return w.nextId++;
}

type StructureInit = Partial<Structure> & Pick<Structure, 'kind' | 'owner' | 'tx' | 'ty'>;

/** Creates a structure, registers it and marks its tile occupied (bumps grid version). */
export function addStructure(w: World, p: StructureInit): Structure {
  const maxHp = p.maxHp ?? p.hp ?? 1;
  const s: Structure = {
    id: p.id ?? newId(w),
    kind: p.kind,
    owner: p.owner,
    tx: p.tx,
    ty: p.ty,
    level: p.level ?? 0,
    hp: p.hp ?? maxHp,
    maxHp,
    cooldown: p.cooldown ?? 0,
    targetId: p.targetId ?? 0,
    output: p.output ?? null,
    buildProgress: p.buildProgress ?? 0,
    scripted: p.scripted ?? false,
  };
  w.structures.set(s.id, s);
  occupy(w.grid, s.tx, s.ty, s.id);
  return s;
}

/** Removes a structure and frees its tile. Returns the removed structure, if any. */
export function removeStructure(w: World, id: EntityId): Structure | undefined {
  const s = w.structures.get(id);
  if (!s) return undefined;
  w.structures.delete(id);
  vacate(w.grid, s.tx, s.ty, id);
  return s;
}

export function structureAt(w: World, tx: number, ty: number): Structure | undefined {
  if (tx < 0 || ty < 0 || tx >= w.grid.w || ty >= w.grid.h) return undefined;
  const id = w.grid.occupant[ty * w.grid.w + tx];
  return id === 0 ? undefined : w.structures.get(id);
}

type UnitInit = Partial<Unit> & Pick<Unit, 'kind' | 'owner' | 'x' | 'y'>;

export function addUnit(w: World, p: UnitInit): Unit {
  const maxHp = p.maxHp ?? p.hp ?? 1;
  const u: Unit = {
    id: p.id ?? newId(w),
    kind: p.kind,
    owner: p.owner,
    targetPlayer: p.targetPlayer ?? w.players[p.owner].attack.targetPlayer,
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
    heading: p.heading ?? 0,
    hp: p.hp ?? maxHp,
    maxHp,
    layer: p.layer ?? 'ground',
    state: p.state ?? 'marching',
    trainIndex: p.trainIndex ?? 0,
    travelled: p.travelled ?? 0,
    aux: p.aux ?? 0,
  };
  w.units.push(u);
  return u;
}

/** Stable in-place compaction of units flagged state === 'dead'. Returns number removed. */
export function removeDeadUnits(w: World): number {
  const units = w.units;
  let j = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.state !== 'dead') units[j++] = u;
  }
  const removed = units.length - j;
  units.length = j;
  return removed;
}

type ProjectileInit = Partial<Projectile> & Pick<Projectile, 'owner' | 'kind' | 'x' | 'y'>;

export function addProjectile(w: World, p: ProjectileInit): Projectile {
  const pr: Projectile = {
    id: p.id ?? newId(w),
    owner: p.owner,
    kind: p.kind,
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
    vx: p.vx ?? 0,
    vy: p.vy ?? 0,
    damage: p.damage ?? 0,
    splash: p.splash ?? 0,
    targetId: p.targetId ?? 0,
    targetShip: p.targetShip ?? -1,
    life: p.life ?? 1,
    layerMask: p.layerMask ?? 'both',
  };
  w.projectiles.push(pr);
  return pr;
}

type RockInit = Partial<Rock> & Pick<Rock, 'x' | 'y'>;

export function addRock(w: World, p: RockInit): Rock {
  const r: Rock = {
    id: p.id ?? newId(w),
    x: p.x,
    y: p.y,
    vx: p.vx ?? 0,
    vy: p.vy ?? 0,
    size: p.size ?? 1,
    thorium: p.thorium ?? 0,
    state: p.state ?? 'drifting',
    carriedBy: p.carriedBy ?? -1,
    spin: p.spin ?? 0,
  };
  w.rocks.push(r);
  return r;
}

export function structuresOf(w: World, owner: PlayerId): Structure[] {
  const out: Structure[] = [];
  for (const s of w.structures.values()) if (s.owner === owner) out.push(s);
  return out;
}
