/**
 * Particle and effect system.
 *
 * The simulation emits named events ("fireBurst", "crossSlash", …); this turns
 * them into particles and draws them. Keeping the mapping here means a designer
 * can rename or restyle an effect without touching combat code, and the sim
 * stays deterministic because none of this feeds back into it.
 *
 * Particles live in world space (x, y, z) so they sort into the same depth
 * order as fighters instead of always floating on top.
 */

import { clamp } from '../core/math';
import { fxRng as rng } from '../core/rng';
import { hexA } from './rig';

type Shape =
  | 'spark'
  | 'ember'
  | 'smoke'
  | 'ring'
  | 'shard'
  | 'petal'
  | 'feather'
  | 'arc'
  | 'cross'
  | 'flash'
  | 'line'
  | 'glow'
  | 'bolt'
  | 'rune';

interface Particle {
  shape: Shape;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  size2: number;
  color: string;
  color2: string;
  rot: number;
  rotV: number;
  grav: number;
  drag: number;
  additive: boolean;
  /** Shape-specific scratch (arc sweep, line length, …). */
  a: number;
  b: number;
}

const MAX_PARTICLES = 520;

/**
 * Soft radial sprites, baked once per colour.
 *
 * Building a `createRadialGradient` per particle per frame was the single
 * biggest cost in the renderer — a few hundred glows dropped the frame rate by
 * half. Blitting a cached 64px sprite with `globalAlpha` looks the same and
 * costs a fraction.
 */
const dotCache = new Map<string, HTMLCanvasElement>();

function softDot(color: string): HTMLCanvasElement {
  let c = dotCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g2 = c.getContext('2d')!;
  const g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, hexA(color, 1));
  g.addColorStop(0.45, hexA(color, 0.45));
  g.addColorStop(1, hexA(color, 0));
  g2.fillStyle = g;
  g2.fillRect(0, 0, 64, 64);
  if (dotCache.size > 80) dotCache.clear();
  dotCache.set(color, c);
  return c;
}

/** Two-stop version for embers and impact flashes: hot core, coloured falloff. */
const flareCache = new Map<string, HTMLCanvasElement>();

function softFlare(core: string, edge: string): HTMLCanvasElement {
  const key = `${core}|${edge}`;
  let c = flareCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g2 = c.getContext('2d')!;
  const g = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, hexA(core, 1));
  g.addColorStop(0.34, hexA(core, 0.85));
  g.addColorStop(0.68, hexA(edge, 0.4));
  g.addColorStop(1, hexA(edge, 0));
  g2.fillStyle = g;
  g2.fillRect(0, 0, 64, 64);
  if (flareCache.size > 80) flareCache.clear();
  flareCache.set(key, c);
  return c;
}

function blit(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  if (r <= 0.2 || alpha <= 0.01) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export class FxSystem {
  private parts: Particle[] = [];

  /**
   * 0.35–1, driven by the measured frame rate. Burst sizes and the particle
   * ceiling scale with it, so a weak phone loses particle density rather than
   * frames — the effects still read, they are just less dense.
   */
  quality = 1;

  private get cap(): number {
    return Math.round(MAX_PARTICLES * this.quality);
  }

  clear(): void {
    this.parts.length = 0;
  }

  get count(): number {
    return this.parts.length;
  }

  private push(p: Partial<Particle> & { shape: Shape; x: number; y: number; z: number; life: number }): void {
    if (this.parts.length >= this.cap) this.parts.shift();
    this.parts.push({
      vx: 0, vy: 0, vz: 0,
      maxLife: p.life,
      size: 3, size2: 3,
      color: '#ffffff', color2: '#ffffff',
      rot: 0, rotV: 0,
      grav: 0, drag: 0.94,
      additive: true,
      a: 0, b: 0,
      ...p,
    } as Particle);
  }

  /** Translate a simulation FX event into particles. */
  emit(kind: string, x: number, y: number, z: number, scale: number, color: string, count: number, facing: number): void {
    const s = scale || 1;
    // Every burst honours the quality scale, but never drops below one
    // particle — a hit with no feedback at all is worse than a sparse one.
    count = Math.max(1, Math.round(count * this.quality));
    switch (kind) {
      case 'impact':
        this.push({ shape: 'flash', x, y, z, life: 10, size: 22 * s, color, additive: true });
        this.push({ shape: 'ring', x, y, z, life: 14, size: 6 * s, size2: 46 * s, color, a: 3 * s });
        break;

      case 'hitSpark':
      case 'shockBurst':
      case 'sparkBurst':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          const sp = rng.range(2, 8) * s;
          this.push({
            shape: 'spark', x, y, z, life: rng.range(10, 22),
            vx: Math.cos(a) * sp + facing * 1.5, vy: Math.sin(a) * sp,
            vz: rng.range(-0.6, 0.6), size: rng.range(1.4, 3.2) * s,
            color, color2: '#ffffff', grav: 0.12, drag: 0.9, a: rng.range(6, 16),
          });
        }
        break;

      case 'fireBurst':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'ember', x, y, z, life: rng.range(18, 40),
            vx: Math.cos(a) * rng.range(1, 5) * s, vy: Math.sin(a) * rng.range(1, 4) * s + 1,
            size: rng.range(3, 9) * s, color: '#ffca6a', color2: '#ff3a00',
            grav: -0.04, drag: 0.93,
          });
        }
        this.push({ shape: 'ring', x, y, z, life: 16, size: 8 * s, size2: 62 * s, color: '#ff8a3c', a: 4 * s });
        break;

      case 'frostBurst':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'shard', x, y, z, life: rng.range(16, 34),
            vx: Math.cos(a) * rng.range(2, 6) * s, vy: Math.sin(a) * rng.range(2, 5) * s,
            size: rng.range(3, 8) * s, color: '#dff6ff', color2: '#4aa8ff',
            rot: rng.range(0, 6.28), rotV: rng.range(-0.2, 0.2), grav: 0.16, drag: 0.95,
          });
        }
        this.push({ shape: 'ring', x, y, z, life: 18, size: 6 * s, size2: 58 * s, color: '#9fdcff', a: 3 * s });
        break;

      case 'darkBurst':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'smoke', x, y, z, life: rng.range(20, 44),
            vx: Math.cos(a) * rng.range(1, 4) * s, vy: Math.sin(a) * rng.range(1, 3) * s,
            size: rng.range(6, 16) * s, color: '#8b5cf6', color2: '#1b0836',
            grav: -0.02, drag: 0.94, additive: false,
          });
        }
        this.push({ shape: 'ring', x, y, z, life: 16, size: 8 * s, size2: 54 * s, color: '#c88bff', a: 3 * s });
        break;

      case 'poisonBurst':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'smoke', x, y, z, life: rng.range(24, 50),
            vx: Math.cos(a) * rng.range(1, 3) * s, vy: Math.abs(Math.sin(a)) * rng.range(1, 3) * s,
            size: rng.range(6, 14) * s, color: '#8fdc5a', color2: '#20401c',
            grav: -0.03, drag: 0.95, additive: false,
          });
        }
        break;

      case 'dustBurst':
      case 'dust':
        for (let i = 0; i < count; i++) {
          this.push({
            shape: 'smoke', x: x + rng.range(-10, 10) * s, y: y + rng.range(0, 6), z, life: rng.range(18, 36),
            vx: rng.range(-2.4, 2.4) * s, vy: rng.range(0.4, 2) * s,
            size: rng.range(5, 13) * s, color: '#d8c9ac', color2: '#6d5c44',
            grav: -0.02, drag: 0.9, additive: false,
          });
        }
        break;

      case 'guardSpark':
        for (let i = 0; i < count; i++) {
          const a = rng.range(-1, 1);
          this.push({
            shape: 'spark', x, y, z, life: rng.range(8, 16),
            vx: facing * rng.range(-1, -5), vy: a * 4,
            size: rng.range(1.2, 2.6) * s, color: '#bcd8ff', color2: '#ffffff', drag: 0.9, a: 10,
          });
        }
        this.push({ shape: 'arc', x, y, z, life: 12, size: 26 * s, color: '#9fc8ff', a: facing, b: 1 });
        break;

      case 'armorSpark':
        for (let i = 0; i < count; i++) {
          this.push({
            shape: 'spark', x, y, z, life: rng.range(8, 14),
            vx: rng.range(-4, 4), vy: rng.range(-1, 4),
            size: rng.range(1.4, 3) * s, color: '#ffd166', color2: '#fff2c0', drag: 0.88, a: 8,
          });
        }
        break;

      case 'guardbreak':
        this.push({ shape: 'flash', x, y, z, life: 14, size: 40 * s, color: '#ffd166' });
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'shard', x, y, z, life: rng.range(20, 40),
            vx: Math.cos(a) * rng.range(3, 8), vy: Math.sin(a) * rng.range(3, 7),
            size: rng.range(4, 9) * s, color: '#ffe9a8', color2: '#c98a2a',
            rot: rng.range(0, 6.28), rotV: rng.range(-0.3, 0.3), grav: 0.24, drag: 0.97,
          });
        }
        break;

      case 'slash':
      case 'arc':
        this.push({ shape: 'arc', x, y, z, life: 12, size: 42 * s, color, a: facing, b: 1.5 });
        break;

      case 'crossSlash':
        this.push({ shape: 'cross', x, y, z, life: 16, size: 54 * s, color, a: facing, b: 0 });
        this.push({ shape: 'flash', x, y, z, life: 10, size: 30 * s, color });
        break;

      case 'slashStorm':
        for (let i = 0; i < count; i++) {
          this.push({
            shape: 'arc', x: x + rng.range(-30, 30), y: y + rng.range(-10, 50), z,
            life: rng.range(8, 14), size: rng.range(24, 44) * s, color,
            a: rng.chance(0.5) ? 1 : -1, b: rng.range(0.6, 1.6),
          });
        }
        break;

      case 'shockring':
        this.push({ shape: 'ring', x, y, z, life: 20, size: 10 * s, size2: 96 * s, color, a: 5 * s });
        this.push({ shape: 'ring', x, y, z, life: 26, size: 6 * s, size2: 68 * s, color: '#ffffff', a: 2 });
        break;

      case 'frostRing':
        this.push({ shape: 'ring', x, y, z, life: 24, size: 10 * s, size2: 92 * s, color: '#bfe8ff', a: 4 * s });
        for (let i = 0; i < 14; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'shard', x, y: y + 4, z, life: rng.range(20, 38),
            vx: Math.cos(a) * rng.range(2, 6), vy: rng.range(1, 5),
            size: rng.range(4, 10) * s, color: '#eaf9ff', color2: '#5aa8e0',
            rot: rng.range(0, 6.28), rotV: rng.range(-0.2, 0.2), grav: 0.2,
          });
        }
        break;

      case 'firePillar':
        for (let i = 0; i < 26; i++) {
          this.push({
            shape: 'ember', x: x + rng.range(-14, 14), y: y + rng.range(0, 20), z, life: rng.range(20, 44),
            vx: rng.range(-1.2, 1.2), vy: rng.range(4, 10) * s,
            size: rng.range(5, 13) * s, color: '#ffd27a', color2: '#ff3a00', grav: -0.06, drag: 0.96,
          });
        }
        break;

      case 'charge':
      case 'chargeBig': {
        const big = kind === 'chargeBig';
        const n = big ? 22 : 10;
        for (let i = 0; i < n; i++) {
          const a = rng.range(0, Math.PI * 2);
          const r = rng.range(40, big ? 130 : 80) * s;
          this.push({
            shape: 'spark',
            x: x + Math.cos(a) * r, y: y + 36 + Math.sin(a) * r * 0.7, z,
            life: rng.range(16, 30),
            // Converge on the caster — reads as "gathering power" immediately.
            vx: -Math.cos(a) * r * 0.06, vy: -Math.sin(a) * r * 0.05,
            size: rng.range(1.6, 3.6) * s, color, color2: '#ffffff', drag: 1.0, a: 12,
          });
        }
        if (big) {
          this.push({ shape: 'ring', x, y: y + 30, z, life: 26, size: 120 * s, size2: 12 * s, color, a: 4 });
          this.push({ shape: 'rune', x, y: y + 4, z, life: 40, size: 70 * s, color, a: 0 });
        }
        break;
      }

      case 'buffAura':
      case 'healRing':
        this.push({ shape: 'ring', x, y: y + 4, z, life: 32, size: 12 * s, size2: 76 * s, color, a: 3 });
        for (let i = 0; i < 12; i++) {
          this.push({
            shape: 'glow', x: x + rng.range(-18, 18), y: y + rng.range(0, 10), z, life: rng.range(24, 46),
            vy: rng.range(1, 2.6), size: rng.range(2, 5) * s, color, drag: 1,
          });
        }
        break;

      case 'healMotes':
      case 'lifesteal':
        for (let i = 0; i < count; i++) {
          this.push({
            shape: 'glow', x: x + rng.range(-20, 20), y: y + rng.range(-10, 20), z, life: rng.range(20, 40),
            vy: rng.range(0.8, 2.2), size: rng.range(2, 4.5) * s, color, drag: 1,
          });
        }
        break;

      case 'ghostTrail':
      case 'dashline':
        for (let i = 0; i < 6; i++) {
          this.push({
            shape: 'line', x: x - facing * i * 9, y: y + rng.range(10, 60), z, life: rng.range(8, 16),
            vx: -facing * rng.range(1, 3), size: rng.range(16, 40), color, a: facing, drag: 0.9,
          });
        }
        break;

      case 'emberTrail':
        for (let i = 0; i < 8; i++) {
          this.push({
            shape: 'ember', x: x - facing * rng.range(0, 30), y: y + rng.range(4, 60), z, life: rng.range(14, 30),
            vx: -facing * rng.range(0.5, 2), vy: rng.range(0, 1.5),
            size: rng.range(3, 8), color: '#ffb03a', color2: '#ff4a12', grav: -0.03,
          });
        }
        break;

      case 'spinAura':
        for (let i = 0; i < 6; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'arc', x: x + Math.cos(a) * 22, y: y + 40 + Math.sin(a) * 16, z,
            life: rng.range(6, 12), size: rng.range(26, 46), color, a: rng.chance(0.5) ? 1 : -1, b: rng.range(0.8, 1.8),
          });
        }
        break;

      case 'bladeRing':
        this.push({ shape: 'ring', x, y: y + 40, z, life: 10, size: 30, size2: 66, color: '#cfeaff', a: 2 });
        break;

      case 'petalSwirl':
        for (let i = 0; i < count * 4; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'petal', x: x + Math.cos(a) * 30, y: y + 40 + Math.sin(a) * 30, z, life: rng.range(30, 70),
            vx: Math.cos(a) * 2.4, vy: Math.sin(a) * 2 + 0.6,
            size: rng.range(4, 9), color: '#ffd6e8', color2: '#ff5f9e',
            rot: rng.range(0, 6.28), rotV: rng.range(-0.15, 0.15), grav: -0.01, drag: 0.98, additive: false,
          });
        }
        break;

      case 'featherBurst':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'feather', x, y: y + 30, z, life: rng.range(30, 60),
            vx: Math.cos(a) * rng.range(2, 6), vy: Math.sin(a) * rng.range(2, 5),
            size: rng.range(6, 14), color: '#f4f0e6', color2: '#c9a06a',
            rot: rng.range(0, 6.28), rotV: rng.range(-0.12, 0.12), grav: 0.04, drag: 0.97, additive: false,
          });
        }
        break;

      case 'divelines':
        for (let i = 0; i < 10; i++) {
          this.push({
            shape: 'line', x: x + rng.range(-24, 24), y: y + rng.range(20, 90), z, life: rng.range(6, 12),
            vy: 6, size: rng.range(22, 50), color, a: 0, b: 1, drag: 1,
          });
        }
        break;

      case 'drainBeam':
        for (let i = 0; i < 8; i++) {
          this.push({
            shape: 'glow', x: x + rng.range(-90, 90), y: y + rng.range(10, 80), z, life: rng.range(12, 24),
            vx: rng.range(-2, 2), vy: rng.range(-1, 1), size: rng.range(2, 5), color, drag: 1,
          });
        }
        break;

      case 'beamCore':
        this.push({ shape: 'flash', x, y, z, life: 14, size: 60 * s, color });
        this.push({ shape: 'ring', x, y, z, life: 20, size: 20 * s, size2: 100 * s, color, a: 5 });
        break;

      case 'muzzle':
        this.push({ shape: 'flash', x, y, z, life: 7, size: 16 * s, color });
        for (let i = 0; i < count; i++) {
          this.push({
            shape: 'spark', x, y, z, life: rng.range(6, 12),
            vx: facing * rng.range(2, 6), vy: rng.range(-2, 2),
            size: rng.range(1.2, 2.6), color, color2: '#ffffff', drag: 0.9, a: 8,
          });
        }
        break;

      case 'clash':
        this.push({ shape: 'flash', x, y, z, life: 12, size: 34 * s, color: '#ffffff' });
        this.push({ shape: 'ring', x, y, z, life: 18, size: 8, size2: 70 * s, color: '#ffffff', a: 3 });
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'spark', x, y, z, life: rng.range(10, 20),
            vx: Math.cos(a) * rng.range(3, 9), vy: Math.sin(a) * rng.range(3, 9),
            size: rng.range(1.4, 3), color: '#ffe9a8', color2: '#ffffff', drag: 0.9, a: 12,
          });
        }
        break;

      case 'koBurst':
        this.push({ shape: 'flash', x, y, z, life: 18, size: 70 * s, color: '#ffffff' });
        this.push({ shape: 'ring', x, y, z, life: 28, size: 10, size2: 130 * s, color, a: 6 });
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'spark', x, y, z, life: rng.range(20, 46),
            vx: Math.cos(a) * rng.range(4, 12), vy: Math.sin(a) * rng.range(4, 11),
            size: rng.range(2, 4.5), color, color2: '#ffffff', grav: 0.1, drag: 0.94, a: 16,
          });
        }
        break;

      case 'respawn':
        this.push({ shape: 'ring', x, y, z, life: 30, size: 130 * s, size2: 10, color, a: 4 });
        for (let i = 0; i < count; i++) {
          this.push({
            shape: 'glow', x: x + rng.range(-30, 30), y: y + rng.range(0, 80), z, life: rng.range(20, 40),
            vy: rng.range(-2, -0.5), size: rng.range(2, 5), color, drag: 1,
          });
        }
        break;

      case 'vanish':
        this.push({ shape: 'ring', x, y: y + 36, z, life: 16, size: 50 * s, size2: 4, color, a: 3 });
        for (let i = 0; i < 14; i++) {
          this.push({
            shape: 'smoke', x: x + rng.range(-14, 14), y: y + rng.range(0, 70), z, life: rng.range(14, 28),
            vx: rng.range(-1.5, 1.5), vy: rng.range(0, 2), size: rng.range(6, 14),
            color, color2: '#1b0836', additive: false, drag: 0.94,
          });
        }
        break;

      case 'airJump':
        this.push({ shape: 'ring', x, y, z, life: 14, size: 8, size2: 54 * s, color, a: 2.5 });
        break;

      case 'mpFail':
        this.push({ shape: 'glow', x, y, z, life: 20, vy: 1.2, size: 5 * s, color, drag: 1 });
        break;

      case 'frostShatter':
        for (let i = 0; i < count; i++) {
          const a = rng.range(0, Math.PI * 2);
          this.push({
            shape: 'shard', x, y, z, life: rng.range(20, 40),
            vx: Math.cos(a) * rng.range(3, 8), vy: Math.sin(a) * rng.range(2, 7),
            size: rng.range(4, 10), color: '#eaf9ff', color2: '#5aa8e0',
            rot: rng.range(0, 6.28), rotV: rng.range(-0.3, 0.3), grav: 0.24,
          });
        }
        break;

      case 'ember':
      case 'spark':
      case 'poisonPuff':
        for (let i = 0; i < count; i++) {
          this.push({
            shape: kind === 'poisonPuff' ? 'smoke' : 'ember',
            x: x + rng.range(-10, 10), y: y + rng.range(-8, 8), z, life: rng.range(14, 30),
            vx: rng.range(-1, 1), vy: rng.range(0.6, 2), size: rng.range(2, 6),
            color, color2: kind === 'poisonPuff' ? '#20401c' : '#ff4a12',
            additive: kind !== 'poisonPuff', grav: -0.03,
          });
        }
        break;

      case 'coil':
        for (let i = 0; i < 12; i++) {
          this.push({
            shape: 'ring', x: x + rng.range(-16, 16), y: y + rng.range(-20, 30), z,
            life: rng.range(10, 22), size: rng.range(6, 20), size2: rng.range(30, 56), color, a: 2,
          });
        }
        break;

      case 'rootBurst':
        for (let i = 0; i < 16; i++) {
          this.push({
            shape: 'line', x: x + rng.range(-60, 60), y: rng.range(0, 20), z, life: rng.range(20, 40),
            vy: rng.range(2, 5), size: rng.range(20, 50), color, a: 0, b: 1, drag: 0.9,
          });
        }
        break;

      case 'stormClouds':
      case 'darkVeil':
        for (let i = 0; i < 18; i++) {
          this.push({
            shape: 'smoke', x: x + rng.range(-260, 260), y: rng.range(120, 220), z, life: rng.range(40, 90),
            vx: rng.range(-1, 1), size: rng.range(30, 70),
            color: kind === 'darkVeil' ? '#3a1a52' : '#2a3550', color2: '#0b0714',
            additive: false, drag: 0.99,
          });
        }
        break;

      default:
        // Unknown effects still produce something, so a typo in data never
        // silently drops feedback.
        this.push({ shape: 'flash', x, y, z, life: 8, size: 18 * s, color });
        break;
    }
  }

  /** Ambient trail that follows a fighter, driven by their Look. */
  ambient(kind: string, x: number, y: number, z: number, color: string): void {
    switch (kind) {
      case 'embers':
        this.push({ shape: 'ember', x: x + rng.range(-12, 12), y: y + rng.range(6, 50), z, life: rng.range(20, 44), vy: rng.range(0.6, 1.8), size: rng.range(1.6, 4), color: '#ffb03a', color2: '#ff4a12', grav: -0.02 });
        break;
      case 'frost':
        this.push({ shape: 'shard', x: x + rng.range(-14, 14), y: y + rng.range(10, 60), z, life: rng.range(24, 50), vy: rng.range(-0.8, -0.2), size: rng.range(2, 4.5), color: '#dff6ff', color2: '#7cc4ff', rot: rng.range(0, 6.28), rotV: 0.08, grav: 0 });
        break;
      case 'sparks':
        this.push({ shape: 'spark', x: x + rng.range(-14, 14), y: y + rng.range(10, 60), z, life: rng.range(8, 16), vx: rng.range(-1, 1), vy: rng.range(-1, 1), size: rng.range(1, 2.4), color: '#eaf6ff', color2: color, a: 6 });
        break;
      case 'petals':
        this.push({ shape: 'petal', x: x + rng.range(-18, 18), y: y + rng.range(20, 70), z, life: rng.range(40, 90), vx: rng.range(-0.8, 0.8), vy: rng.range(-0.6, -0.1), size: rng.range(3, 6), color: '#ffd6e8', color2: '#ff5f9e', rot: rng.range(0, 6.28), rotV: rng.range(-0.08, 0.08), additive: false, drag: 0.99 });
        break;
      case 'shadow':
        this.push({ shape: 'smoke', x: x + rng.range(-12, 12), y: y + rng.range(0, 40), z, life: rng.range(18, 36), vy: rng.range(0.2, 1), size: rng.range(5, 12), color, color2: '#150726', additive: false, drag: 0.95 });
        break;
      case 'leaves':
        this.push({ shape: 'petal', x: x + rng.range(-18, 18), y: y + rng.range(10, 60), z, life: rng.range(40, 80), vx: rng.range(-1, 1), vy: rng.range(-0.5, 0.2), size: rng.range(3, 7), color: '#a8d06a', color2: '#4a6b28', rot: rng.range(0, 6.28), rotV: 0.06, additive: false, drag: 0.99 });
        break;
      case 'motes':
        this.push({ shape: 'glow', x: x + rng.range(-20, 20), y: y + rng.range(10, 70), z, life: rng.range(24, 48), vy: rng.range(0.2, 0.8), size: rng.range(0.9, 1.8), color, drag: 1 });
        break;
      default:
        break;
    }
  }

  /** Weather runs on the same pool so it sorts and fades with everything else. */
  weather(kind: string, camX: number, width: number, groundY: number): void {
    const x = camX + rng.range(-60, width + 60);
    switch (kind) {
      case 'snow':
        this.push({ shape: 'glow', x, y: 320, z: rng.range(20, 130), life: 200, vx: rng.range(-0.6, 0.2), vy: -rng.range(0.5, 1.4), size: rng.range(0.9, 2), color: '#ffffff', drag: 1 });
        break;
      case 'rain':
        this.push({ shape: 'line', x, y: 340, z: rng.range(20, 130), life: 44, vx: -1.6, vy: -13, size: rng.range(14, 26), color: 'rgba(190,220,255,0.55)', a: 0, b: 1, drag: 1 });
        break;
      case 'embers':
        this.push({ shape: 'ember', x, y: rng.range(0, 40), z: rng.range(20, 130), life: 150, vx: rng.range(-0.4, 0.6), vy: rng.range(0.5, 1.6), size: rng.range(1.6, 4), color: '#ffb03a', color2: '#ff4a12', grav: -0.008, drag: 1 });
        break;
      case 'petals':
        this.push({ shape: 'petal', x, y: 320, z: rng.range(20, 130), life: 300, vx: rng.range(-1, 0.4), vy: -rng.range(0.4, 1), size: rng.range(3, 7), color: '#ffd6e8', color2: '#ff8ab4', rot: rng.range(0, 6.28), rotV: rng.range(-0.06, 0.06), additive: false, drag: 1 });
        break;
      case 'sand':
        this.push({ shape: 'smoke', x: camX - 60, y: rng.range(0, 140), z: rng.range(20, 130), life: 130, vx: rng.range(3, 7), size: rng.range(10, 30), color: '#e0c48a', color2: '#a07840', additive: false, drag: 1 });
        break;
      case 'ash':
        this.push({ shape: 'smoke', x, y: 320, z: rng.range(20, 130), life: 260, vx: rng.range(-0.5, 0.5), vy: -rng.range(0.3, 0.8), size: rng.range(2, 6), color: '#6b6270', color2: '#2a2430', additive: false, drag: 1 });
        break;
      case 'fireflies':
        this.push({ shape: 'glow', x, y: rng.range(20, 150), z: rng.range(20, 130), life: 150, vx: rng.range(-0.4, 0.4), vy: rng.range(-0.3, 0.3), size: rng.range(0.7, 1.5), color: '#c8ff9a', drag: 1 });
        break;
      case 'stars':
        this.push({ shape: 'glow', x, y: rng.range(80, 300), z: rng.range(20, 130), life: 160, vy: rng.range(-0.2, 0.2), size: rng.range(0.6, 1.5), color: '#dfe8ff', drag: 1 });
        break;
      default:
        break;
    }
    void groundY;
  }

  update(): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vy -= p.grav;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rot += p.rotV;
      if (--p.life <= 0) this.parts.splice(i, 1);
    }
  }

  /**
   * Draws every particle whose depth falls in [zMin, zMax).
   * The renderer calls this between fighter bands so particles interleave with
   * the cast instead of forming a flat sheet over the scene.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    project: (x: number, y: number, z: number) => { sx: number; sy: number; scale: number },
    zMin: number,
    zMax: number,
  ): void {
    // Switching the composite mode is expensive, so only touch it when the
    // particle actually needs a different one.
    let additive = false;
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.parts) {
      if (p.z < zMin || p.z >= zMax) continue;
      const t = p.life / p.maxLife;
      const { sx, sy, scale } = project(p.x, p.y, p.z);
      if (p.additive !== additive) {
        additive = p.additive;
        ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';
      }
      drawParticle(ctx, p, sx, sy, scale, t);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  sx: number,
  sy: number,
  scale: number,
  t: number,
): void {
  const size = p.size * scale;
  switch (p.shape) {
    case 'flash':
      blit(ctx, softFlare('#ffffff', p.color), sx, sy, p.size * scale * (1.2 - t * 0.4), t);
      break;
    case 'glow':
      blit(ctx, softDot(p.color), sx, sy, size * (1.4 + (1 - t) * 0.8), t * 0.9);
      break;
    case 'spark': {
      const len = (p.a || 8) * scale * t;
      const vlen = Math.hypot(p.vx, p.vy) || 1;
      ctx.strokeStyle = hexA(p.color, clamp(t * 1.2, 0, 1));
      ctx.lineWidth = Math.max(0.7, size * t);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (p.vx / vlen) * len, sy + (p.vy / vlen) * len);
      ctx.stroke();
      break;
    }
    case 'ember':
      blit(ctx, softFlare(p.color, p.color2), sx, sy, size * t * 2.2, t);
      break;
    case 'smoke':
      blit(ctx, softFlare(p.color, p.color2), sx, sy, size * (1.6 - t * 0.7), t * 0.5);
      break;
    case 'ring': {
      const k = 1 - t;
      const r = (p.size + (p.size2 - p.size) * k) * scale;
      ctx.strokeStyle = hexA(p.color, t * 0.9);
      ctx.lineWidth = Math.max(0.6, (p.a || 3) * scale * t);
      ctx.beginPath();
      // Slightly squashed: the ground plane is seen at an angle.
      ctx.ellipse(sx, sy, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'shard': {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      const g = ctx.createLinearGradient(0, -size, 0, size);
      g.addColorStop(0, hexA(p.color, t));
      g.addColorStop(1, hexA(p.color2, t * 0.6));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.45, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'petal': {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.fillStyle = hexA(p.color, t);
      ctx.beginPath();
      ctx.ellipse(0, 0, size, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexA(p.color2, t * 0.6);
      ctx.beginPath();
      ctx.ellipse(size * 0.25, 0, size * 0.5, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'feather': {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot);
      ctx.fillStyle = hexA(p.color, t);
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.quadraticCurveTo(0, -size * 0.5, size, 0);
      ctx.quadraticCurveTo(0, size * 0.5, -size, 0);
      ctx.fill();
      ctx.strokeStyle = hexA(p.color2, t * 0.8);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'arc': {
      const r = p.size * scale * (0.7 + (1 - t) * 0.6);
      const sweep = (p.b || 1.2) * (0.6 + t * 0.6);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(p.a >= 0 ? 1 : -1, 1);
      ctx.strokeStyle = hexA(p.color, t);
      ctx.lineWidth = Math.max(1, 7 * scale * t);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r, -sweep, sweep);
      ctx.stroke();
      ctx.strokeStyle = hexA('#ffffff', t * 0.7);
      ctx.lineWidth = Math.max(0.6, 2.4 * scale * t);
      ctx.beginPath();
      ctx.arc(0, 0, r, -sweep * 0.85, sweep * 0.85);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'cross': {
      const r = p.size * scale * (0.8 + (1 - t) * 0.5);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(0.5);
      for (let i = 0; i < 2; i++) {
        ctx.rotate(Math.PI / 2);
        const g = ctx.createLinearGradient(-r, 0, r, 0);
        g.addColorStop(0, hexA(p.color, 0));
        g.addColorStop(0.5, hexA('#ffffff', t));
        g.addColorStop(1, hexA(p.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(0, -r * 0.14 * t - 1);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r * 0.14 * t + 1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    }
    case 'line': {
      const len = p.size * scale * t;
      const vlen = Math.hypot(p.vx, p.vy) || 1;
      ctx.strokeStyle = p.color.startsWith('rgba') ? p.color : hexA(p.color, t * 0.8);
      ctx.lineWidth = Math.max(0.7, 2.2 * scale);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (p.vx / vlen) * len, sy + (p.vy / vlen) * len);
      ctx.stroke();
      break;
    }
    case 'rune': {
      const r = p.size * scale * (0.6 + (1 - t) * 0.6);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.rot + (1 - t) * 2);
      ctx.strokeStyle = hexA(p.color, t * 0.85);
      ctx.lineWidth = Math.max(0.8, 2 * scale);
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.4;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'bolt':
    default: {
      ctx.fillStyle = hexA(p.color, t);
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}
