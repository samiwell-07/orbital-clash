import type { Projectile, ProjectileKind, Team, World } from '../types';

export interface ProjectileSpec {
  team: Team;
  kind: ProjectileKind;
  x: number;
  y: number;
  targetId: number | null;
  tx: number;
  ty: number;
  speed: number;
  damage: number;
  splashRadius: number;
  slowFactor?: number;
  slowDuration?: number;
}

export function createProjectile(world: World, spec: ProjectileSpec): Projectile {
  return {
    id: world.nextId++,
    team: spec.team,
    kind: spec.kind,
    x: spec.x,
    y: spec.y,
    tx: spec.tx,
    ty: spec.ty,
    targetId: spec.targetId,
    speed: spec.speed,
    damage: spec.damage,
    splashRadius: spec.splashRadius,
    slowFactor: spec.slowFactor ?? 1,
    slowDuration: spec.slowDuration ?? 0,
    alive: true,
    angle: Math.atan2(spec.ty - spec.y, spec.tx - spec.x),
    trailTimer: 0,
  };
}
