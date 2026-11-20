import type { Fx } from './types';
import type { FxCmd } from './eventRouter';
import type { PopBatcher } from './budget';
import { BeamTracker } from './emitters/beams';
import { emitExplosion, emitMegaExplosion, emitStructureCollapse } from './emitters/explosion';
import { emitBomberShot, emitBuildSparkle, emitHitSparks, emitLaserMuzzle, emitPulsarShot, emitRecycleDissolve, emitTurretShot } from './emitters/sparks';
import { emitLaunchWhoosh, emitRepairPulse, emitTeleportColumn, emitThoriumPulse } from './emitters/rings';
import { emitRockBurst, emitThoriumGlow, emitTokenFlight } from './emitters/thorium';
import { emitShieldRipple } from './emitters/shield';
import { CYAN, playerColor } from './palette';

export interface DispatchCtx {
  fx: Fx;
  beams: BeamTracker;
  pops: PopBatcher;
}

/** Runs the emitter(s) for a routed command. Tile (x, y) becomes world (x, h, z = y). */
export function dispatch(c: FxCmd, ctx: DispatchCtx): void {
  const { fx } = ctx;
  switch (c.kind) {
    case 'explosion': emitExplosion(fx, c.x, c.y, c.n, c.big); break;
    case 'hitSparks': emitHitSparks(fx, c.x, c.y); break;
    case 'collapse': emitStructureCollapse(fx, c.x, c.y); break;
    case 'unitPop': ctx.pops.add(c.x, c.y, c.owner); break;
    case 'rockBurst': emitRockBurst(fx, c.x, c.y, c.n, c.tx, c.ty); break;
    case 'thoriumPulse': emitThoriumPulse(fx, c.x, c.y); break;
    case 'shot': dispatchShot(c, fx); break;
    case 'beam':
      ctx.beams.touch(c.owner, c.x, c.y, c.tx, c.ty, fx.now);
      break;
    case 'baseHit': emitShieldRipple(fx, c.x, c.y, playerColor(c.owner), c.n); break;
    case 'baseDestroyed': emitMegaExplosion(fx, c.x, c.y, playerColor(c.owner)); break;
    case 'teleport': emitTeleportColumn(fx, c.x, c.y); break;
    case 'launch': emitLaunchWhoosh(fx, c.x, c.y, c.owner, c.n); break;
    case 'build': emitBuildSparkle(fx, c.x, c.y, c.owner >= 0 ? playerColor(c.owner) : CYAN, c.big); break;
    case 'recycle': emitRecycleDissolve(fx, c.x, c.y); break;
    case 'repair': emitRepairPulse(fx, c.x, c.y); break;
    case 'rockSpawn': emitThoriumGlow(fx, c.x, c.y); break;
    case 'token': emitTokenFlight(fx, c.x, c.y, c.tx, c.ty, c.sub === 'health'); break;
  }
}

function dispatchShot(c: FxCmd, fx: Fx): void {
  switch (c.sub) {
    case 'laser': emitLaserMuzzle(fx, c.x, c.y, c.owner); break;
    case 'pulsar': emitPulsarShot(fx, c.x, c.y, Math.max(3, Math.hypot(c.tx - c.x, c.ty - c.y) + 0.3)); break;
    case 'bomber': emitBomberShot(fx, c.x, c.y, c.tx, c.ty); break;
    default: emitTurretShot(fx, c.x, c.y, c.tx, c.ty);
  }
}
