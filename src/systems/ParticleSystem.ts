import type { World } from '../types';
import { createFloatingText } from '../entities/misc';

const MAX_SHAKE = 14;
const SHAKE_DECAY = 28;
/** Max pool slots inspected per emit; when the pool is saturated the oldest-ish slot is recycled. */
const MAX_SCAN = 48;

let searchIndex = 0;

/** Activates a pooled particle. Bounded cost: recycles a slot when the pool is saturated. */
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
  if (searchIndex >= n) searchIndex = 0;
  let idx = searchIndex;
  const scan = n < MAX_SCAN ? n : MAX_SCAN;
  for (let i = 0; i < scan; i++) {
    const j = (searchIndex + i) % n;
    if (!pool[j]!.active) {
      idx = j;
      break;
    }
  }
  searchIndex = (idx + 1) % n;
  const p = pool[idx]!;
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

/** Updates particles, beams, rings, texts, shake decay, base hitFlash, cursor failFlash and tower flash/buildAnim. */
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

  const beams = world.beams;
  if (beams.length > 0) {
    let w = 0;
    for (let i = 0; i < beams.length; i++) {
      const b = beams[i]!;
      b.life -= dt;
      if (b.life > 0) beams[w++] = b;
    }
    beams.length = w;
  }

  const rings = world.rings;
  if (rings.length > 0) {
    let w = 0;
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]!;
      r.life -= dt;
      const t = 1 - Math.max(0, r.life) / r.maxLife;
      r.radius = r.maxRadius * (1 - (1 - t) * (1 - t));
      if (r.life > 0) rings[w++] = r;
    }
    rings.length = w;
  }

  const texts = world.texts;
  if (texts.length > 0) {
    let w = 0;
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i]!;
      t.life -= dt;
      t.y += t.vy * dt;
      if (t.life > 0) texts[w++] = t;
    }
    texts.length = w;
  }

  world.shake = Math.max(0, world.shake - SHAKE_DECAY * dt);

  for (const base of world.bases) base.hitFlash = Math.max(0, base.hitFlash - dt);
  for (const pl of world.players) pl.cursor.failFlash = Math.max(0, pl.cursor.failFlash - dt);

  for (const t of world.towers) {
    t.flash = Math.max(0, t.flash - dt);
    if (t.buildAnim < 1) t.buildAnim = Math.min(1, t.buildAnim + dt * 2.5);
  }
}
