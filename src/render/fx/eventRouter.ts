import type { SimEvent } from '@/types';

export type FxKind =
  | 'explosion' | 'hitSparks' | 'collapse' | 'unitPop' | 'rockBurst' | 'thoriumPulse' | 'shot' | 'beam'
  | 'baseHit' | 'baseDestroyed' | 'teleport' | 'launch' | 'build' | 'recycle' | 'repair' | 'rockSpawn';

/** Flat, reusable command: the router fills one instance per event, so routing allocates nothing. */
export interface FxCmd {
  kind: FxKind;
  /** Tile coordinates (sim space). */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Kind-specific magnitude: explosion radius, thorium, unit count, hits-left fraction, level. */
  n: number;
  owner: number;
  big: boolean;
  /** Weapon / unit kind where relevant. */
  sub: string;
}

export interface Pos {
  x: number;
  y: number;
}

/** World lookups the router needs; implemented over the World by the layer, stubbed in tests. */
export interface RouteEnv {
  structurePos(id: number, out: Pos): boolean;
  basePos(owner: number, out: Pos): boolean;
  /** Remaining base hits as a 0..1 fraction. */
  hitsFrac(owner: number): number;
}

export function createCmd(): FxCmd {
  return { kind: 'explosion', x: 0, y: 0, tx: NaN, ty: NaN, n: 0, owner: 0, big: false, sub: '' };
}

const scratch: Pos = { x: 0, y: 0 };

function set(out: FxCmd, kind: FxKind, x: number, y: number, owner: number, n = 0, big = false, sub = ''): true {
  out.kind = kind;
  out.x = x;
  out.y = y;
  out.tx = NaN;
  out.ty = NaN;
  out.n = n;
  out.owner = owner;
  out.big = big;
  out.sub = sub;
  return true;
}

/** Maps one SimEvent to an fx command. Returns false when the event has no visual effect. */
export function routeEvent(ev: SimEvent, env: RouteEnv, out: FxCmd): boolean {
  switch (ev.t) {
    case 'explosion': return set(out, 'explosion', ev.x, ev.y, -1, ev.radius, ev.big);
    case 'structureHit': return set(out, 'hitSparks', ev.x, ev.y, -1);
    case 'structureDestroyed': return set(out, 'collapse', ev.x, ev.y, ev.owner, 0, true, ev.kind);
    case 'unitDied': return set(out, 'unitPop', ev.x, ev.y, ev.owner, 1, false, ev.kind);
    case 'structureBuilt': return set(out, 'build', ev.tx + 0.5, ev.ty + 0.5, ev.owner, 0, false, ev.kind);
    case 'baseBuilt': return set(out, 'build', ev.tx + 0.5, ev.ty + 0.5, ev.owner, 0, true, 'base');
    case 'structureUpgraded':
      return env.structurePos(ev.id, scratch) && set(out, 'build', scratch.x, scratch.y, -1, ev.level, false, 'upgrade');
    case 'structureRecycled':
      return env.structurePos(ev.id, scratch) && set(out, 'recycle', scratch.x, scratch.y, ev.owner, ev.refund);
    case 'structureRepaired':
      return env.structurePos(ev.id, scratch) && set(out, 'repair', scratch.x, scratch.y, -1, ev.cost);
    case 'unitSpawned':
      return env.structurePos(ev.fromId, scratch) && set(out, 'teleport', scratch.x, scratch.y, ev.owner, 0, false, ev.kind);
    case 'unitLaunched':
      return env.basePos(ev.owner, scratch) && set(out, 'launch', scratch.x, scratch.y, ev.owner, ev.count, false, ev.kind);
    case 'shot':
      set(out, 'shot', ev.x, ev.y, -1, 0, false, ev.kind);
      out.tx = ev.tx;
      out.ty = ev.ty;
      return true;
    case 'beam':
      set(out, 'beam', ev.x, ev.y, ev.owner);
      out.tx = ev.tx;
      out.ty = ev.ty;
      return true;
    case 'rockSpawned': return set(out, 'rockSpawn', ev.x, ev.y, -1);
    case 'rockSmashed':
      set(out, 'rockBurst', ev.x, ev.y, ev.owner, ev.thorium);
      if (env.basePos(ev.owner, scratch)) {
        out.tx = scratch.x;
        out.ty = scratch.y;
      }
      return true;
    case 'thorium':
      return env.basePos(ev.owner, scratch) && set(out, 'thoriumPulse', scratch.x, scratch.y, ev.owner, ev.amount);
    case 'baseHit':
      return env.basePos(ev.target, scratch) && set(out, 'baseHit', scratch.x, scratch.y, ev.target, env.hitsFrac(ev.target));
    case 'baseDestroyed':
      return env.basePos(ev.target, scratch) && set(out, 'baseDestroyed', scratch.x, scratch.y, ev.target, 0, true);
    default:
      return false;
  }
}
