/**
 * Projectile catalogue.
 *
 * A `SpawnDef` in a frame only names a kind and an offset; everything about
 * how that kind flies, looks and hurts lives here. Characters therefore share
 * the same shot machinery while their shots still look nothing alike.
 */

import type { Element, HitDef } from '../sim/types';

export interface ProjectileDef {
  /** Renderer recipe. */
  style:
    | 'orb'
    | 'bolt'
    | 'wave'
    | 'shard'
    | 'beam'
    | 'blade'
    | 'rock'
    | 'petal'
    | 'scythe'
    | 'spark'
    | 'weapon'
    | 'ring'
    | 'meteor'
    | 'geyser'
    | 'mine';
  color: string;
  color2?: string;
  element: Element;
  scale: number;
  life: number;
  speed: number;
  gravity: number;
  /** Beam-like shots pass through, blasts stop on the first target. */
  pierce: number;
  /** Clash strength against opposing projectiles. */
  power: number;
  homing: number;
  hit: HitDef;
  /** Trail density, purely cosmetic. */
  trail: number;
  /** Spawned when the projectile expires or connects. */
  burst?: string;
  /** Light radius contributed to the scene. */
  light: number;
}

const base = (h: Partial<HitDef>): HitDef => ({
  box: { x: 0, y: 0, w: 30, h: 30 },
  dmg: 12,
  kbx: 4,
  hitstun: 16,
  fall: 10,
  guard: 10,
  hitstop: 4,
  shake: 2,
  blockable: true,
  ...h,
});

export const PROJECTILES: Record<string, ProjectileDef> = {
  // ---- fire --------------------------------------------------------------
  fireball: {
    style: 'orb', color: '#ffb03a', color2: '#ff4a12', element: 'fire', scale: 1, life: 110,
    speed: 8.2, gravity: 0, pierce: 0, power: 12, homing: 0, trail: 1.2, light: 90, burst: 'fireBurst',
    hit: base({ dmg: 20, kbx: 5.5, fall: 16, hitstop: 6, shake: 3.5, element: 'fire', box: { x: 0, y: 0, w: 40, h: 40 } }),
  },
  flameWave: {
    style: 'wave', color: '#ff8a3c', color2: '#ff2d00', element: 'fire', scale: 1.35, life: 46,
    speed: 6.4, gravity: 0, pierce: 9, power: 26, homing: 0, trail: 2.2, light: 130,
    hit: base({ dmg: 9, kbx: 2.4, hitstun: 10, fall: 6, hitstop: 2, shake: 1.6, element: 'fire', box: { x: 0, y: 0, w: 70, h: 76 } }),
  },
  meteor: {
    style: 'meteor', color: '#ffd27a', color2: '#e02b00', element: 'fire', scale: 1.7, life: 200,
    speed: 3.2, gravity: 0.42, pierce: 2, power: 40, homing: 0, trail: 3, light: 200, burst: 'fireBurst',
    hit: base({ dmg: 34, kbx: 7, kby: 5, hitstun: 26, fall: 26, hitstop: 9, shake: 8, element: 'fire', box: { x: 0, y: 0, w: 76, h: 76 } }),
  },

  // ---- lightning ---------------------------------------------------------
  boltOrb: {
    style: 'orb', color: '#bfe9ff', color2: '#3f7bff', element: 'shock', scale: 0.9, life: 120,
    speed: 9.6, gravity: 0, pierce: 0, power: 10, homing: 0.05, trail: 1.6, light: 110, burst: 'shockBurst',
    hit: base({ dmg: 17, kbx: 4, fall: 12, hitstop: 5, shake: 3, element: 'shock' }),
  },
  chainBolt: {
    style: 'bolt', color: '#eaf6ff', color2: '#6aa8ff', element: 'shock', scale: 1, life: 26,
    speed: 17, gravity: 0, pierce: 6, power: 18, homing: 0.16, trail: 2.4, light: 150,
    hit: base({ dmg: 11, kbx: 2, hitstun: 12, fall: 5, hitstop: 3, shake: 2, element: 'shock', box: { x: 0, y: 0, w: 46, h: 34 } }),
  },
  skyStrike: {
    style: 'beam', color: '#ffffff', color2: '#8ab6ff', element: 'shock', scale: 1.4, life: 22,
    speed: 0, gravity: 0, pierce: 9, power: 50, homing: 0, trail: 0, light: 240,
    hit: base({ dmg: 30, kbx: 3, kby: 3, hitstun: 24, fall: 22, hitstop: 8, shake: 7, element: 'shock', box: { x: 0, y: 0, w: 54, h: 260 }, once: true }),
  },

  // ---- ice ---------------------------------------------------------------
  iceShard: {
    style: 'shard', color: '#dff6ff', color2: '#4aa8ff', element: 'ice', scale: 0.8, life: 100,
    speed: 10.5, gravity: 0.02, pierce: 1, power: 8, homing: 0, trail: 0.8, light: 60, burst: 'frostBurst',
    hit: base({ dmg: 13, kbx: 3, fall: 8, hitstop: 4, shake: 2, element: 'ice', box: { x: 0, y: 0, w: 30, h: 24 } }),
  },
  iceSpike: {
    style: 'geyser', color: '#eaf9ff', color2: '#3d8fe0', element: 'ice', scale: 1.2, life: 40,
    speed: 0, gravity: 0, pierce: 9, power: 30, homing: 0, trail: 0, light: 90,
    hit: base({ dmg: 22, kbx: 2, kby: 6.5, hitstun: 22, fall: 20, hitstop: 7, shake: 4.5, element: 'ice', launcher: true, box: { x: 0, y: 0, w: 44, h: 110 }, once: true }),
  },
  blizzard: {
    style: 'wave', color: '#e8fbff', color2: '#79c9ff', element: 'ice', scale: 1.5, life: 70,
    speed: 5.2, gravity: 0, pierce: 9, power: 34, homing: 0, trail: 2.6, light: 120,
    hit: base({ dmg: 7, kbx: 1.5, hitstun: 8, fall: 4, hitstop: 2, shake: 1.4, element: 'ice', box: { x: 0, y: 0, w: 90, h: 90 } }),
  },

  // ---- wind --------------------------------------------------------------
  windBlade: {
    style: 'blade', color: '#e6fff4', color2: '#37d6a0', element: 'wind', scale: 1, life: 84,
    speed: 12, gravity: 0, pierce: 2, power: 12, homing: 0, trail: 1.4, light: 70,
    hit: base({ dmg: 14, kbx: 3.6, fall: 9, hitstop: 4, shake: 2.2, element: 'wind', box: { x: 0, y: 0, w: 48, h: 34 } }),
  },
  cyclone: {
    style: 'ring', color: '#dcfff0', color2: '#2fc79a', element: 'wind', scale: 1.6, life: 90,
    speed: 2.6, gravity: 0, pierce: 9, power: 40, homing: 0, trail: 1.8, light: 100,
    hit: base({ dmg: 5, kbx: 0, hitstun: 8, fall: 2, hitstop: 1, shake: 1, element: 'wind', vacuum: 2.4, box: { x: 0, y: 0, w: 86, h: 130 } }),
  },

  // ---- dark / shadow -----------------------------------------------------
  shadowBolt: {
    style: 'orb', color: '#c88bff', color2: '#4b1f8c', element: 'dark', scale: 0.95, life: 110,
    speed: 8.8, gravity: 0, pierce: 1, power: 11, homing: 0.09, trail: 1.8, light: 80, burst: 'darkBurst',
    hit: base({ dmg: 18, kbx: 4.2, fall: 12, hitstop: 5, shake: 2.8, element: 'dark', lifesteal: 0.25 }),
  },
  darkScythe: {
    style: 'scythe', color: '#e0b3ff', color2: '#2c0f52', element: 'dark', scale: 1.3, life: 96,
    speed: 7.4, gravity: 0, pierce: 9, power: 24, homing: 0, trail: 2, light: 110,
    hit: base({ dmg: 16, kbx: 2.6, hitstun: 18, fall: 10, hitstop: 5, shake: 3, element: 'dark', box: { x: 0, y: 0, w: 62, h: 70 }, lifesteal: 0.2 }),
  },
  voidMine: {
    style: 'mine', color: '#b57bff', color2: '#1b0836', element: 'dark', scale: 1, life: 300,
    speed: 4.5, gravity: 0.35, pierce: 0, power: 14, homing: 0, trail: 0.6, light: 70, burst: 'darkBurst',
    hit: base({ dmg: 26, kbx: 4, kby: 5.5, hitstun: 24, fall: 22, hitstop: 7, shake: 5, element: 'dark', launcher: true, box: { x: 0, y: 0, w: 68, h: 68 } }),
  },

  // ---- holy / light ------------------------------------------------------
  holyBeam: {
    style: 'beam', color: '#fff6d8', color2: '#ffc93c', element: 'holy', scale: 1.2, life: 30,
    speed: 0, gravity: 0, pierce: 9, power: 60, homing: 0, trail: 0, light: 220,
    hit: base({ dmg: 6, kbx: 1.2, hitstun: 6, fall: 3, hitstop: 1, shake: 1.2, element: 'holy', box: { x: 0, y: 0, w: 420, h: 56 } }),
  },
  sunDisc: {
    style: 'ring', color: '#fff2b0', color2: '#ff9d1e', element: 'holy', scale: 1.25, life: 150,
    speed: 6.6, gravity: 0, pierce: 9, power: 30, homing: 0.03, trail: 2, light: 170,
    hit: base({ dmg: 12, kbx: 2.2, hitstun: 12, fall: 7, hitstop: 3, shake: 2, element: 'holy', box: { x: 0, y: 0, w: 56, h: 56 } }),
  },

  // ---- water / poison ----------------------------------------------------
  waterLance: {
    style: 'blade', color: '#dff4ff', color2: '#1e7fd0', element: 'normal', scale: 1.1, life: 90,
    speed: 11, gravity: 0, pierce: 2, power: 14, homing: 0, trail: 1.5, light: 70,
    hit: base({ dmg: 15, kbx: 4.4, fall: 10, hitstop: 4, shake: 2.4, box: { x: 0, y: 0, w: 54, h: 28 } }),
  },
  poisonSpit: {
    style: 'orb', color: '#c8ff8a', color2: '#2e7d32', element: 'poison', scale: 0.85, life: 90,
    speed: 7.4, gravity: 0.14, pierce: 0, power: 8, homing: 0, trail: 1, light: 50, burst: 'poisonBurst',
    hit: base({ dmg: 10, kbx: 2.4, hitstun: 12, fall: 6, hitstop: 3, shake: 1.6, element: 'poison' }),
  },
  tidalWave: {
    style: 'wave', color: '#cfeeff', color2: '#0e6fb8', element: 'normal', scale: 1.6, life: 76,
    speed: 6.8, gravity: 0, pierce: 9, power: 44, homing: 0, trail: 2.4, light: 110,
    hit: base({ dmg: 11, kbx: 5.5, kby: 2, hitstun: 14, fall: 9, hitstop: 3, shake: 3, box: { x: 0, y: 0, w: 96, h: 100 } }),
  },

  // ---- earth / crystal ---------------------------------------------------
  rock: {
    style: 'rock', color: '#b08b63', color2: '#5a4230', element: 'normal', scale: 1.1, life: 160,
    speed: 7.2, gravity: 0.34, pierce: 0, power: 16, homing: 0, trail: 0.5, light: 0, burst: 'dustBurst',
    hit: base({ dmg: 19, kbx: 5, kby: 2.4, fall: 16, hitstop: 6, shake: 4 }),
  },
  stoneWall: {
    style: 'geyser', color: '#c19a6b', color2: '#6b4f37', element: 'normal', scale: 1.3, life: 46,
    speed: 0, gravity: 0, pierce: 9, power: 40, homing: 0, trail: 0, light: 0,
    hit: base({ dmg: 20, kbx: 3, kby: 6, hitstun: 22, fall: 20, hitstop: 7, shake: 5, launcher: true, box: { x: 0, y: 0, w: 50, h: 96 }, once: true }),
  },
  crystalShot: {
    style: 'shard', color: '#ffd9f2', color2: '#c33bd6', element: 'normal', scale: 0.9, life: 140,
    speed: 13.5, gravity: 0, pierce: 3, power: 10, homing: 0, trail: 1, light: 80,
    hit: base({ dmg: 16, kbx: 2.6, hitstun: 14, fall: 8, hitstop: 4, shake: 2.4, box: { x: 0, y: 0, w: 34, h: 22 } }),
  },
  petal: {
    style: 'petal', color: '#ffd6e8', color2: '#ff5f9e', element: 'wind', scale: 0.7, life: 130,
    speed: 6.4, gravity: -0.01, pierce: 9, power: 6, homing: 0.13, trail: 0.4, light: 40,
    hit: base({ dmg: 5, kbx: 0.8, hitstun: 7, fall: 2, hitstop: 1, shake: 0.8, element: 'wind', box: { x: 0, y: 0, w: 22, h: 22 } }),
  },

  // ---- misc --------------------------------------------------------------
  spearBolt: {
    style: 'blade', color: '#e9f4ff', color2: '#8f6bff', element: 'shock', scale: 1.15, life: 100,
    speed: 14, gravity: 0, pierce: 3, power: 16, homing: 0, trail: 1.6, light: 90,
    hit: base({ dmg: 17, kbx: 3.4, hitstun: 15, fall: 10, hitstop: 4, shake: 2.6, element: 'shock', box: { x: 0, y: 0, w: 66, h: 24 } }),
  },
  thrownWeapon: {
    style: 'weapon', color: '#d8dee9', color2: '#8b95a5', element: 'normal', scale: 1, life: 130,
    speed: 12, gravity: 0.16, pierce: 0, power: 14, homing: 0, trail: 0.4, light: 0,
    hit: base({ dmg: 21, kbx: 5, fall: 15, hitstop: 5, shake: 3 }),
  },
  groundWave: {
    style: 'wave', color: '#f0d9a8', color2: '#8a6134', element: 'normal', scale: 1.2, life: 60,
    speed: 8.5, gravity: 0, pierce: 9, power: 30, homing: 0, trail: 1.2, light: 30,
    hit: base({ dmg: 15, kbx: 3, kby: 5.5, hitstun: 20, fall: 18, hitstop: 6, shake: 4.5, launcher: true, box: { x: 0, y: 0, w: 46, h: 62 } }),
  },
};

export function getProjectile(kind: string): ProjectileDef {
  return PROJECTILES[kind] ?? PROJECTILES.fireball;
}
