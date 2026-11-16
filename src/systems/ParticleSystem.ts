import type { World } from '../types';
import { createFloatingText } from '../entities/misc';

const MAX_SHAKE = 14;
const SHAKE_DECAY = 28;

let searchIndex = 0;

/** Activates a pooled particle (no-op if pool exhausted). */
export function emitParticle(
  world: World,
  x: number,
  y: number,
  vx: number,
  vy: number,
  life: number,
  size: number,
  color: string,
  drag: number = 1,
): void {
  const pool = world.particles;
  const n = pool.length;
  if (n === 0) return;
  for (let i = 0; i < n; i++) {
    const idx = (searchIndex + i) % n;
    const p = pool[idx]!;
    if (p.active) continue;
    searchIndex = (idx + 1) % n;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.drag = drag;
    return;
  }
}

/** Radial burst of `count` particles. */
export function emitBurst(
  world: World,
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
  life: number,
  size: number = 2.5,
): void {
  const rng = Math.random;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const s = speed * (0.3 + 0.7 * rng());
    emitParticle(
      world,
      x,
      y,
      Math.cos(a) * s,
      Math.sin(a) * s,
      life * (0.6 + 0.4 * rng()),
      size * (0.6 + 0.6 * rng()),
      color,
      0.15,
    );
  }
}

export function addRing(world: World, x: number, y: number, maxRadius: number, color: string, life: number): void {
  world.rings.push({ x, y, radius: 0, maxRadius, color, life, maxLife: life });
}

export function addText(world: World, x: number, y: number, text: string, color: string): void {
  world.texts.push(createFloatingText(x, y, text, color));
}

export function addShake(world: World, amount: number): void {
  world.shake = Math.min(MAX_SHAKE, world.shake + amount);
}

/** Updates particles, beams, rings, texts, shake decay, base hitFlash and cursor failFlash decay. */
export function updateEffects(world: World, dt: number): void {
  const pool = world.particles;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]!;
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      continue;
    }
    if (p.drag !== 1) {
      const k = Math.pow(p.drag, dt);
      p.vx *= k;
      p.vy *= k;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  if (world.beams.length > 0) {
    for (const b of world.beams) b.life -= dt;
    world.beams = world.beams.filter((b) => b.life > 0);
  }

  if (world.rings.length > 0) {
    for (const r of world.rings) {
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.maxLife;
      r.radius = r.maxRadius * (1 - (1 - t) * (1 - t));
    }
    world.rings = world.rings.filter((r) => r.life > 0);
  }

  if (world.texts.length > 0) {
    for (const t of world.texts) {
      t.life -= dt;
      t.y += t.vy * dt;
    }
    world.texts = world.texts.filter((t) => t.life > 0);
  }

  world.shake = Math.max(0, world.shake - SHAKE_DECAY * dt);

  for (const base of world.bases) base.hitFlash = Math.max(0, base.hitFlash - dt);
  for (const pl of world.players) pl.cursor.failFlash = Math.max(0, pl.cursor.failFlash - dt);

  for (const t of world.towers) {
    t.flash = Math.max(0, t.flash - dt);
    if (t.buildAnim < 1) t.buildAnim = Math.min(1, t.buildAnim + dt * 2.5);
  }
}
