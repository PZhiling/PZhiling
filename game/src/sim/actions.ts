/**
 * The shared move set.
 *
 * Every fighter inherits these; a character definition overrides the ones that
 * should feel different (a grappler's throw, an assassin's dash) and adds its
 * own specials on top. Frame counts are in 60 Hz ticks.
 */

import type { Action, Frame } from './types';

/** Terse frame constructor so the tables below stay readable. */
export function f(dur: number, pose: string, extra: Partial<Frame> = {}): Frame {
  return { dur, pose, ...extra };
}

export const SHARED: Record<string, Action> = {
  // ---- idle / locomotion -------------------------------------------------
  stand: {
    id: 'stand',
    tag: 'system',
    loop: true,
    mobile: true,
    turnable: true,
    frames: [f(26, 'stand'), f(26, 'stand2')],
  },
  walk: {
    id: 'walk',
    tag: 'movement',
    loop: true,
    mobile: true,
    turnable: true,
    frames: [f(7, 'walk1'), f(7, 'walk2'), f(7, 'walk3'), f(7, 'walk4')],
  },
  run: {
    id: 'run',
    tag: 'movement',
    loop: true,
    mobile: true,
    frames: [f(5, 'run1'), f(5, 'run2'), f(5, 'run3'), f(5, 'run2')],
  },
  runStop: {
    id: 'runStop',
    tag: 'movement',
    next: 'stand',
    frames: [f(6, 'land', { vx: 0 }), f(5, 'stand')],
  },

  // ---- jumping -----------------------------------------------------------
  jump: {
    id: 'jump',
    tag: 'movement',
    next: 'jumpAir',
    frames: [f(4, 'jumpPrep'), f(3, 'jumpRise', { fx: [{ kind: 'dust', count: 6 }] })],
  },
  jumpAir: {
    id: 'jumpAir',
    tag: 'movement',
    loop: true,
    frames: [f(10, 'jumpRise'), f(10, 'jumpApex'), f(999, 'jumpFall')],
  },
  land: {
    id: 'land',
    tag: 'movement',
    next: 'stand',
    mobile: true,
    frames: [f(4, 'land', { vx: 0, fx: [{ kind: 'dust', count: 8 }], sfx: 'land' }), f(3, 'stand')],
  },
  landHard: {
    id: 'landHard',
    tag: 'movement',
    next: 'stand',
    frames: [
      f(9, 'land', { vx: 0, fx: [{ kind: 'shockring', scale: 0.7 }, { kind: 'dust', count: 16 }], sfx: 'landHard' }),
      f(6, 'stand'),
    ],
  },

  // ---- dash / roll -------------------------------------------------------
  dash: {
    id: 'dash',
    tag: 'movement',
    next: 'stand',
    cooldown: 26,
    frames: [
      f(4, 'dash', { vx: 7.4, fx: [{ kind: 'dashline' }], sfx: 'whoosh' }),
      f(7, 'dash', { vx: 5.2 }),
      f(6, 'land', { vx: 0.8 }),
    ],
  },
  rollBack: {
    id: 'rollBack',
    tag: 'movement',
    next: 'stand',
    cooldown: 40,
    frames: [
      f(4, 'tumble', { vx: -6, invuln: true }),
      f(8, 'tumble', { vx: -4.4, invuln: true }),
      f(6, 'getup', { vx: -0.6 }),
    ],
  },

  // ---- basic attack chain ------------------------------------------------
  // Three links, each cancellable into the next only on the recovery frames.
  // That is the whole reason LF2 combat reads as "chains" and not as mashing.
  attack1: {
    id: 'attack1',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(3, 'punch1'),
      f(4, 'punch1', {
        hit: { box: { x: 26, y: 44, w: 34, h: 22 }, dmg: 11, kbx: 2.4, hitstun: 12, fall: 4, guard: 6, hitstop: 3, shake: 1.5, once: true, sfx: 'hit1' },
      }),
      f(9, 'punch1', { cancel: ['attack2'] }),
    ],
  },
  attack2: {
    id: 'attack2',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(3, 'punch2'),
      f(4, 'punch2', {
        hit: { box: { x: 30, y: 42, w: 36, h: 24 }, dmg: 15, kbx: 3.2, hitstun: 13, fall: 6, guard: 8, hitstop: 4, shake: 2, once: true, sfx: 'hit1' },
      }),
      f(11, 'punch2', { cancel: ['attack3'] }),
    ],
  },
  attack3: {
    id: 'attack3',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(5, 'punch3', { vx: 1.6 }),
      f(5, 'punch3', {
        vx: 2.2,
        hit: { box: { x: 34, y: 40, w: 42, h: 30 }, dmg: 24, kbx: 6.5, kby: 3.4, hitstun: 20, fall: 14, guard: 14, hitstop: 7, shake: 4.5, once: true, launcher: true, sfx: 'hit2' },
        fx: [{ kind: 'slash', x: 38, y: 44, scale: 1.1 }],
      }),
      f(16, 'punch3', { vx: 0 }),
    ],
  },

  /** Running attack — commits hard, hits hard. */
  attackRun: {
    id: 'attackRun',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(4, 'elbow', { vx: 6.2 }),
      f(6, 'elbow', {
        vx: 5.0,
        hit: { box: { x: 30, y: 42, w: 40, h: 28 }, dmg: 24, kbx: 7, kby: 3, hitstun: 22, fall: 16, guard: 16, hitstop: 6, shake: 4, once: true, sfx: 'hit2' },
        fx: [{ kind: 'slash', x: 34, y: 44 }],
      }),
      f(16, 'land', { vx: 0.5 }),
    ],
  },

  /** Air attack — the standard jump-in. */
  attackAir: {
    id: 'attackAir',
    tag: 'basic',
    next: 'jumpAir',
    frames: [
      f(4, 'aerialKick'),
      f(10, 'aerialKick', {
        hit: { box: { x: 26, y: 20, w: 40, h: 34 }, dmg: 18, kbx: 3.4, kby: -1.5, hitstun: 16, fall: 10, guard: 12, hitstop: 5, shake: 2.5, once: true, sfx: 'hit1' },
        fx: [{ kind: 'slash', x: 30, y: 26, scale: 0.9 }],
      }),
      f(8, 'jumpFall'),
    ],
  },

  /** Jump attack aimed downward — the one that starts juggles. */
  attackAirDown: {
    id: 'attackAirDown',
    tag: 'basic',
    next: 'jumpAir',
    frames: [
      f(5, 'stomp', { vy: -1 }),
      f(12, 'stomp', {
        vy: -9,
        hit: { box: { x: 6, y: -6, w: 34, h: 30 }, dmg: 22, kbx: 1.5, kby: 4.5, hitstun: 18, fall: 20, guard: 14, hitstop: 6, shake: 5, once: true, sfx: 'hit2' },
      }),
    ],
  },

  // ---- defense -----------------------------------------------------------
  defend: {
    id: 'defend',
    tag: 'system',
    loop: true,
    frames: [f(999, 'guard')],
  },
  defendHit: {
    id: 'defendHit',
    tag: 'reaction',
    next: 'defend',
    frames: [f(5, 'guardHit', { vx: -1.2 }), f(6, 'guard')],
  },
  defendBreak: {
    id: 'defendBreak',
    tag: 'reaction',
    next: 'stand',
    frames: [
      f(10, 'hurt2', { vx: -3, fx: [{ kind: 'guardbreak' }], sfx: 'break' }),
      f(16, 'hurt1', { vx: -0.5 }),
    ],
  },

  // ---- hit reactions -----------------------------------------------------
  hurt: {
    id: 'hurt',
    tag: 'reaction',
    next: 'stand',
    frames: [f(6, 'hurt1'), f(6, 'hurt1')],
  },
  hurtHeavy: {
    id: 'hurtHeavy',
    tag: 'reaction',
    next: 'stand',
    frames: [f(8, 'hurt2'), f(10, 'hurt1')],
  },
  launched: {
    id: 'launched',
    tag: 'reaction',
    next: 'fall',
    frames: [f(8, 'hurtUp'), f(999, 'tumble')],
  },
  fall: {
    id: 'fall',
    tag: 'reaction',
    loop: true,
    frames: [f(6, 'tumble')],
  },
  down: {
    id: 'down',
    tag: 'reaction',
    next: 'getup',
    frames: [
      f(3, 'lying', { fx: [{ kind: 'dust', count: 12 }], sfx: 'thud' }),
      f(26, 'lying'),
    ],
  },
  getup: {
    id: 'getup',
    tag: 'reaction',
    next: 'stand',
    frames: [f(8, 'getup', { invuln: true }), f(6, 'stand', { invuln: true })],
  },
  frozen: {
    id: 'frozen',
    tag: 'reaction',
    next: 'stand',
    frames: [f(1, 'frozen')],
  },
  dead: {
    id: 'dead',
    tag: 'system',
    loop: true,
    frames: [f(20, 'lying'), f(999, 'dead')],
  },

  // ---- grapple -----------------------------------------------------------
  grab: {
    id: 'grab',
    tag: 'basic',
    next: 'stand',
    cooldown: 30,
    frames: [
      f(4, 'grab', { vx: 2.5 }),
      f(6, 'grab', {
        vx: 0,
        hit: { box: { x: 24, y: 40, w: 30, h: 34 }, dmg: 0, hitstun: 0, unblockable: true, once: true, hitstop: 0, sfx: 'grab' },
      }),
      f(10, 'stand'),
    ],
  },
  hold: {
    id: 'hold',
    tag: 'system',
    loop: true,
    frames: [f(999, 'hold')],
  },
  holdPunch: {
    id: 'holdPunch',
    tag: 'basic',
    next: 'hold',
    frames: [
      f(3, 'punch2'),
      f(3, 'punch2', { fx: [{ kind: 'impact', x: 24, y: 46, scale: 0.7 }], sfx: 'hit1' }),
      f(8, 'hold'),
    ],
  },
  throwFwd: {
    id: 'throwFwd',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(7, 'throwWind'),
      f(5, 'throwRelease', { fx: [{ kind: 'slash', x: 30, y: 50, scale: 1.2 }], sfx: 'whoosh' }),
      f(14, 'stand'),
    ],
  },
  held: {
    id: 'held',
    tag: 'reaction',
    loop: true,
    frames: [f(999, 'held')],
  },
  thrown: {
    id: 'thrown',
    tag: 'reaction',
    next: 'fall',
    frames: [f(999, 'tumble')],
  },

  // ---- weapon attacks (active only while carrying one) -------------------
  weaponSwing: {
    id: 'weaponSwing',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(4, 'slashWind'),
      f(5, 'slash1', {
        vx: 1.4,
        hit: { box: { x: 34, y: 42, w: 46, h: 36 }, dmg: 26, kbx: 5, kby: 2, hitstun: 18, fall: 14, guard: 16, hitstop: 5, shake: 3, once: true, sfx: 'slash' },
        fx: [{ kind: 'arc', x: 34, y: 44, scale: 1.2 }],
      }),
      f(13, 'slash2'),
    ],
  },
  weaponThrow: {
    id: 'weaponThrow',
    tag: 'basic',
    next: 'stand',
    frames: [
      f(5, 'throwWind'),
      f(4, 'stab', { spawn: [{ kind: 'thrownWeapon', x: 26, y: 44, vx: 12 }], sfx: 'whoosh' }),
      f(12, 'stand'),
    ],
  },

  // ---- flavour -----------------------------------------------------------
  taunt: {
    id: 'taunt',
    tag: 'system',
    next: 'stand',
    frames: [f(18, 'taunt'), f(18, 'taunt'), f(12, 'stand')],
  },
  victory: {
    id: 'victory',
    tag: 'system',
    loop: true,
    frames: [f(30, 'victory'), f(30, 'stand2')],
  },
  intro: {
    id: 'intro',
    tag: 'system',
    next: 'stand',
    frames: [f(24, 'intro'), f(16, 'stand')],
  },
};

/** Build a character's action table from the shared set plus overrides. */
export function buildActions(own: Record<string, Action>): Record<string, Action> {
  const out: Record<string, Action> = {};
  for (const k of Object.keys(SHARED)) out[k] = SHARED[k];
  for (const k of Object.keys(own)) out[k] = { ...own[k], id: k };
  return out;
}
