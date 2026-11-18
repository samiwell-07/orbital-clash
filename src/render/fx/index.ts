import * as THREE from 'three';
import type { SimEvent, World } from '@/types';
import type { RenderContext, RenderLayer, RenderLayerFactory } from '../layer';
import { createLiveSystem, createQuadSystem } from './quadSystem';
import { createPointSystem } from './particleSystem';
import { createFxTextures, defaultCanvasFactory, type CanvasFactory } from './textures';
import { createCmd, routeEvent } from './eventRouter';
import { FxBudget, PopBatcher } from './budget';
import { dispatch, type DispatchCtx } from './dispatch';
import { BeamTracker, MAX_BEAMS } from './emitters/beams';
import { emitUnitPop } from './emitters/explosion';
import { createTrailSampler, trailCap } from './emitters/trails';
import { updateAmbient } from './emitters/ambient';
import { WorldEnv } from './worldEnv';
import { createRng, type Fx } from './types';

/** Per-family capacities (strict particle budget; ring buffers overwrite the oldest). */
export const CAPACITY = { glow: 8192, spark: 4096, smoke: 3072, shard: 1024, ring: 256, beam: 256, tracer: 512 } as const;

export function createFxLayerWith(ctx: RenderContext, canvasFactory: CanvasFactory): RenderLayer {
  const group = new THREE.Group();
  group.name = 'fx';
  const tex = createFxTextures(canvasFactory);
  const glow = createPointSystem(CAPACITY.glow, { map: tex.glow, additive: true, drag: 1.0, fadePow: 1.2, colorEnd: 0.8, gain: 1.6, maxSize: 400 });
  const spark = createPointSystem(CAPACITY.spark, { map: tex.spark, additive: true, drag: 0.8, fadePow: 0.8, colorEnd: 0.7, gain: 2.2, maxSize: 128 });
  const smoke = createPointSystem(CAPACITY.smoke, { map: tex.smoke, additive: false, drag: 1.5, fadePow: 1.0, colorEnd: 1.0, gain: 1.0, maxSize: 600 });
  const shard = createPointSystem(CAPACITY.shard, { map: tex.spark, additive: true, drag: 0, fadePow: 0.35, colorEnd: 0.9, gain: 2.0, maxSize: 128 });
  const ring = createQuadSystem(CAPACITY.ring, 'ring', tex.ring, 1.4, 1.8);
  const beam = createQuadSystem(CAPACITY.beam, 'beam', tex.beam, 1.5, 2.0);
  const tracer = createQuadSystem(CAPACITY.tracer, 'tracer', tex.beam, 0.3, 2.2);
  const live = createLiveSystem(MAX_BEAMS, tex.beam, 2.4);
  const points = [smoke, glow, spark, shard];
  const quads = [ring, beam, tracer, live];
  [smoke.points, ring.mesh, glow.points, spark.points, shard.points, beam.mesh, tracer.mesh, live.mesh].forEach((o, i) => {
    o.renderOrder = 10 + i;
    group.add(o);
  });

  const fx: Fx = {
    glow, spark, smoke, shard, ring, beam, tracer, live,
    now: 0,
    lod: 1,
    rnd: createRng(),
    shake: (a) => ctx.shake(a),
    flash: (c, s) => ctx.flash(c, s),
  };
  const env = new WorldEnv();
  const budget = new FxBudget();
  const dctx: DispatchCtx = { fx, beams: new BeamTracker(), pops: new PopBatcher() };
  const trails = createTrailSampler();
  const cmd = createCmd();
  const size = new THREE.Vector2();
  const popOut = (x: number, y: number, n: number, owner: number) => emitUnitPop(fx, x, y, n, owner);
  let epoch = NaN;
  let last = 0;

  return {
    name: 'fx',
    group,
    load(world: World) {
      env.bind(world);
      budget.reset();
      dctx.pops.reset();
      trails.reset();
      points.forEach((p) => p.reset());
      quads.forEach((q) => q.reset());
      dctx.beams.reset(live);
    },
    update(world: World, _alpha: number, events: readonly SimEvent[], nowSec: number) {
      if (Number.isNaN(epoch)) epoch = nowSec;
      const time = nowSec - epoch;
      const dt = Math.min(0.1, Math.max(0, time - last));
      last = time;
      fx.now = time;
      env.tick(time);
      budget.beginFrame(time, events.length, world.units.length);
      fx.lod = budget.lod;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.t === 'structureBuilt') env.remember(ev.id, ev.tx, ev.ty);
        if (routeEvent(ev, env, cmd) && budget.allow(cmd.kind)) dispatch(cmd, dctx);
      }
      dctx.pops.flush(time, popOut);
      if (!world.paused) {
        trails.sample(world, fx, trailCap(fx, world.units.length));
        updateAmbient(world, fx, dt);
      }
      dctx.beams.update(fx);
      ctx.renderer.getDrawingBufferSize(size);
      const scale = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov) / 2));
      for (let i = 0; i < points.length; i++) points[i].update(time, scale);
      for (let i = 0; i < quads.length; i++) quads[i].update(time);
    },
    dispose() {
      points.forEach((p) => p.dispose());
      quads.forEach((q) => q.dispose());
      tex.dispose();
      group.removeFromParent();
    },
  };
}

export const createFxLayer: RenderLayerFactory = (ctx) => createFxLayerWith(ctx, defaultCanvasFactory);
