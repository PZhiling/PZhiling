/**
 * The roster.
 *
 * Fifteen fighters, each with four signature moves on top of the shared move
 * set. The four `skills` entries are what the mobile skill pad shows, in order,
 * so the ordering is a design decision: cheap/quick first, super last.
 *
 * Balance guideline used throughout:
 *   hp    850–1250   (glass cannons low, tanks high)
 *   mp     380–620   regen 14–24 per second
 *   walk   1.9–3.1   run 4.6–7.0
 * A super costs 220–320 MP, roughly two thirds of a full bar.
 */

import type { Action, CharacterDef } from '../sim/types';
import { buildActions, f } from '../sim/actions';

type Raw = Omit<CharacterDef, 'actions'> & { actions: Record<string, Action> };

function def(c: Raw): CharacterDef {
  return { ...c, actions: buildActions(c.actions) };
}

// ---------------------------------------------------------------------------
// 1. Kraisorn — the reference fighter. Everything else is tuned against him.
// ---------------------------------------------------------------------------
const kraisorn = def({
  id: 'kraisorn',
  name: 'Kraisorn',
  nameTh: 'ไกรสร',
  titleTh: 'อัศวินสิงห์เพลิง',
  bioTh: 'อดีตองครักษ์ที่สาบานจะล้างมลทินให้ราชวงศ์ ดาบของเขาติดไฟทุกครั้งที่โกรธ ตีตรงไปตรงมา แข็งแรงทุกระยะ เหมาะกับคนที่เพิ่งเริ่มเล่น',
  archetype: 'allrounder',
  hp: 1050, mp: 480, mpRegen: 18,
  walkSpeed: 2.5, runSpeed: 5.6, zSpeed: 1.7, jump: 12.2, airJumps: 0,
  weight: 1, half: 15, depth: 9, height: 74,
  look: {
    scale: 1, build: 1.02, skin: '#e8b98c', hair: '#3a2418', hairStyle: 'topknot',
    primary: '#b8342c', secondary: '#3a2a20', trim: '#f0c66a', aura: '#ff7a2e',
    cape: '#8f2620', weapon: 'sword', ambient: 'embers',
  },
  skills: ['flameSlash', 'risingLion', 'emberDash', 'solarCross'],
  actions: {
    flameSlash: {
      id: 'flameSlash', name: 'ฟันเพลิง', desc: 'ปล่อยคลื่นไฟตรงไปข้างหน้า', tag: 'special',
      mpCost: 90, cooldown: 46, next: 'stand',
      frames: [
        f(7, 'slashWind', { fx: [{ kind: 'charge', color: '#ff7a2e' }] }),
        f(4, 'slash1', { vx: 1.8, spawn: [{ kind: 'flameWave', x: 30, y: 44 }], sfx: 'cast', fx: [{ kind: 'arc', x: 34, y: 44, scale: 1.4, color: '#ff7a2e' }] }),
        f(16, 'slash2'),
      ],
    },
    risingLion: {
      id: 'risingLion', name: 'สิงห์ทะยาน', desc: 'อัปเปอร์คัตไฟ ลอยคู่ต่อสู้ขึ้นฟ้า', tag: 'special',
      mpCost: 110, cooldown: 60, next: 'jumpAir',
      frames: [
        f(6, 'castDown', { fx: [{ kind: 'charge', color: '#ffb03a' }] }),
        f(8, 'uppercut', {
          vx: 3.2, vy: 11,
          hit: { box: { x: 18, y: 20, w: 40, h: 78 }, dmg: 26, kbx: 2, kby: 9.5, hitstun: 26, fall: 22, guard: 20, hitstop: 8, shake: 6, once: true, launcher: true, element: 'fire', sfx: 'hit3' },
          fx: [{ kind: 'firePillar', x: 20, y: 0, scale: 1.1 }],
        }),
        f(14, 'jumpFall'),
      ],
    },
    emberDash: {
      id: 'emberDash', name: 'พุ่งอังคาร', desc: 'พุ่งทะลุคู่ต่อสู้พร้อมรอยไฟ', tag: 'special',
      mpCost: 70, cooldown: 54, next: 'stand',
      frames: [
        f(4, 'dash', { vx: 10, invuln: true, fx: [{ kind: 'dashline', color: '#ff7a2e' }], sfx: 'whoosh' }),
        f(8, 'dash', {
          vx: 8.5,
          hit: { box: { x: 0, y: 40, w: 56, h: 46 }, dmg: 18, kbx: 4.5, kby: 2.5, hitstun: 18, fall: 14, guard: 14, hitstop: 5, shake: 3, once: true, element: 'fire' },
          fx: [{ kind: 'emberTrail' }],
        }),
        f(10, 'land', { vx: 0.6 }),
      ],
    },
    solarCross: {
      id: 'solarCross', name: 'กากบาทสุริยะ', desc: 'ท่าไม้ตาย — ฟันไขว้เป็นวงไฟทั่วจอ', tag: 'super',
      mpCost: 260, cooldown: 200, next: 'stand',
      frames: [
        f(16, 'superCast', { flash: '#ff9a3c', slowmo: 0.35, zoom: 1.14, fx: [{ kind: 'chargeBig', color: '#ff7a2e' }], sfx: 'super' }),
        f(6, 'slashWind', { vx: 2 }),
        f(5, 'slash1', {
          vx: 4,
          hit: { box: { x: 20, y: 30, w: 92, h: 80 }, dmg: 30, kbx: 4, kby: 4, hitstun: 22, fall: 16, guard: 30, hitstop: 8, shake: 7, once: true, element: 'fire' },
          fx: [{ kind: 'crossSlash', x: 46, y: 46, scale: 1.6 }],
        }),
        f(6, 'slash2', {
          hit: { box: { x: 20, y: 20, w: 110, h: 96 }, dmg: 42, kbx: 11, kby: 6.5, hitstun: 32, fall: 40, guard: 40, hitstop: 14, shake: 12, once: true, element: 'fire', sfx: 'hit3' },
          fx: [{ kind: 'crossSlash', x: 54, y: 44, scale: 2.1 }, { kind: 'shockring', scale: 1.6, color: '#ff7a2e' }],
          flash: '#ffd08a', zoom: 1.2,
        }),
        f(26, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 2. Nilrat — shadow assassin. Highest damage, lowest health.
// ---------------------------------------------------------------------------
const nilrat = def({
  id: 'nilrat',
  name: 'Nilrat',
  nameTh: 'นิลรัตน์',
  titleTh: 'เงามีดสั้น',
  bioTh: 'ไม่มีใครเคยเห็นหน้าเธอสองครั้ง โจมตีแรงมากแต่เลือดน้อย เล่นยาก ต้องเข้า-ออกให้เป็นจังหวะ',
  archetype: 'assassin',
  hp: 850, mp: 520, mpRegen: 21,
  walkSpeed: 3.05, runSpeed: 7.0, zSpeed: 2.3, jump: 13.4, airJumps: 1,
  weight: 0.82, half: 13, depth: 8, height: 70,
  look: {
    scale: 0.96, build: 0.9, skin: '#d9a87f', hair: '#1b1a24', hairStyle: 'pony',
    primary: '#241f38', secondary: '#12101c', trim: '#8b5cf6', aura: '#a855f7',
    weapon: 'blade', ambient: 'shadow',
  },
  skills: ['shadowStep', 'crossCut', 'shadowBolt', 'thousandCuts'],
  actions: {
    shadowStep: {
      id: 'shadowStep', name: 'ก้าวเงา', desc: 'วาร์ปทะลุไปหลังคู่ต่อสู้', tag: 'special',
      mpCost: 60, cooldown: 44, next: 'stand',
      frames: [
        f(5, 'castWind', { invuln: true, fx: [{ kind: 'vanish', color: '#a855f7' }], sfx: 'warp' }),
        f(6, 'dash', { vx: 16, invuln: true, fx: [{ kind: 'ghostTrail', color: '#a855f7' }] }),
        f(7, 'land', { vx: 0 }),
      ],
    },
    crossCut: {
      id: 'crossCut', name: 'กรีดไขว้', desc: 'สองมีดรัวเร็ว ต่อคอมโบง่าย', tag: 'special',
      mpCost: 80, cooldown: 40, next: 'stand',
      frames: [
        f(4, 'slashWind', { vx: 3 }),
        f(3, 'slash1', {
          vx: 2,
          hit: { box: { x: 26, y: 42, w: 44, h: 34 }, dmg: 13, kbx: 1.2, hitstun: 14, fall: 5, guard: 10, hitstop: 3, shake: 2, once: true, element: 'dark', sfx: 'slash' },
          fx: [{ kind: 'arc', x: 30, y: 46, color: '#c88bff' }],
        }),
        f(3, 'slash2', {
          hit: { box: { x: 28, y: 38, w: 46, h: 38 }, dmg: 15, kbx: 4.5, kby: 3, hitstun: 18, fall: 14, guard: 12, hitstop: 5, shake: 3, once: true, element: 'dark', sfx: 'slash' },
          fx: [{ kind: 'crossSlash', x: 32, y: 44, scale: 0.9, color: '#c88bff' }],
        }),
        f(13, 'stand'),
      ],
    },
    shadowBolt: {
      id: 'shadowBolt', name: 'ลูกธนูมืด', desc: 'ยิงกระสุนมืดที่ดูดเลือดกลับ', tag: 'special',
      mpCost: 95, cooldown: 52, next: 'stand',
      frames: [
        f(8, 'castWind', { fx: [{ kind: 'charge', color: '#a855f7' }] }),
        f(4, 'castPush', { spawn: [{ kind: 'shadowBolt', x: 26, y: 46 }], sfx: 'cast' }),
        f(14, 'stand'),
      ],
    },
    thousandCuts: {
      id: 'thousandCuts', name: 'พันคมมีด', desc: 'ท่าไม้ตาย — รัวมีดในเงามืดแล้วปิดจบ', tag: 'super',
      mpCost: 250, cooldown: 210, next: 'stand',
      frames: [
        f(14, 'superCast', { flash: '#8b5cf6', slowmo: 0.3, zoom: 1.16, invuln: true, fx: [{ kind: 'chargeBig', color: '#a855f7' }], sfx: 'super' }),
        f(4, 'dash', { vx: 12, invuln: true, fx: [{ kind: 'ghostTrail', color: '#a855f7' }] }),
        f(22, 'slash1', {
          vx: 1.2, invuln: true,
          hit: { box: { x: 8, y: 24, w: 70, h: 64 }, dmg: 6, kbx: 0.4, hitstun: 6, fall: 1, guard: 4, hitstop: 1, shake: 1.4, element: 'dark', vacuum: 1.2 },
          fx: [{ kind: 'slashStorm', count: 3, color: '#c88bff' }],
        }),
        f(6, 'slashWind', { vx: -1 }),
        f(6, 'stab', {
          vx: 6,
          hit: { box: { x: 24, y: 30, w: 66, h: 60 }, dmg: 48, kbx: 10, kby: 5, hitstun: 30, fall: 40, guard: 40, hitstop: 15, shake: 11, once: true, element: 'dark', lifesteal: 0.3, sfx: 'hit3' },
          fx: [{ kind: 'crossSlash', x: 44, y: 44, scale: 2, color: '#c88bff' }],
          flash: '#c88bff', zoom: 1.22,
        }),
        f(24, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 3. Mekhala — lightning zoner. Controls space, hates being cornered.
// ---------------------------------------------------------------------------
const mekhala = def({
  id: 'mekhala',
  name: 'Mekhala',
  nameTh: 'เมขลา',
  titleTh: 'เทพีล่อแก้ว',
  bioTh: 'เทพธิดาสายฟ้าผู้ถือดวงแก้ววิเศษ ถนัดคุมระยะไกล ยิงสายฟ้าไม่ให้ศัตรูเข้าใกล้ ระยะประชิดอ่อน',
  archetype: 'zoner',
  hp: 900, mp: 620, mpRegen: 24,
  walkSpeed: 2.3, runSpeed: 5.0, zSpeed: 1.8, jump: 12.6, airJumps: 1,
  weight: 0.85, half: 14, depth: 8, height: 71,
  look: {
    scale: 0.99, build: 0.92, skin: '#f2d3ae', hair: '#f4f7ff', hairStyle: 'long',
    primary: '#2f6bd8', secondary: '#12224a', trim: '#ffe066', aura: '#7cc4ff',
    cape: '#3b7fe0', weapon: 'none', ambient: 'sparks',
  },
  skills: ['boltOrb', 'chainBolt', 'staticField', 'skyJudgement'],
  actions: {
    boltOrb: {
      id: 'boltOrb', name: 'แก้ววิเศษ', desc: 'ปาดวงแก้วสายฟ้าตามเป้าเล็กน้อย', tag: 'special',
      mpCost: 75, cooldown: 38, next: 'stand',
      frames: [
        f(7, 'castWind', { fx: [{ kind: 'charge', color: '#7cc4ff' }] }),
        f(4, 'castPush', { spawn: [{ kind: 'boltOrb', x: 26, y: 48 }], sfx: 'cast' }),
        f(12, 'stand'),
      ],
    },
    chainBolt: {
      id: 'chainBolt', name: 'สายฟ้าลูกโซ่', desc: 'สายฟ้าเร็วทะลุหลายเป้า', tag: 'special',
      mpCost: 110, cooldown: 58, next: 'stand',
      frames: [
        f(10, 'castUp', { fx: [{ kind: 'charge', color: '#eaf6ff', scale: 1.2 }], flash: '#3f6fbf' }),
        f(4, 'castPush', { spawn: [{ kind: 'chainBolt', x: 24, y: 46, count: 3, spread: 10 }], sfx: 'thunder' }),
        f(16, 'stand'),
      ],
    },
    staticField: {
      id: 'staticField', name: 'ม่านไฟฟ้า', desc: 'กางสนามไฟฟ้ารอบตัว ผลักศัตรูออก', tag: 'special',
      mpCost: 120, cooldown: 90, next: 'stand',
      frames: [
        f(8, 'castDown', { fx: [{ kind: 'charge', color: '#7cc4ff' }] }),
        f(10, 'summon', {
          invuln: true,
          hit: { box: { x: -50, y: 0, w: 130, h: 96 }, dmg: 16, kbx: 7, kby: 3.5, hitstun: 20, fall: 14, guard: 18, hitstop: 6, shake: 5, once: true, element: 'shock' },
          fx: [{ kind: 'shockring', scale: 1.5, color: '#7cc4ff' }, { kind: 'sparkBurst', count: 20, color: '#eaf6ff' }],
          sfx: 'thunder', flash: '#5b8fd0',
        }),
        f(18, 'stand'),
      ],
    },
    skyJudgement: {
      id: 'skyJudgement', name: 'ฟ้าผ่าพิพากษา', desc: 'ท่าไม้ตาย — เรียกสายฟ้าลงมาเป็นแนว', tag: 'super',
      mpCost: 280, cooldown: 220, next: 'stand',
      frames: [
        f(20, 'superCast', { flash: '#9dc7ff', slowmo: 0.32, zoom: 1.12, invuln: true, fx: [{ kind: 'chargeBig', color: '#7cc4ff' }, { kind: 'stormClouds' }], sfx: 'super' }),
        f(6, 'castUp', { spawn: [{ kind: 'skyStrike', x: 70, y: 0, jitter: 12 }], sfx: 'thunder', flash: '#ffffff' }),
        f(6, 'castUp', { spawn: [{ kind: 'skyStrike', x: 150, y: 0, jitter: 14 }], sfx: 'thunder', flash: '#e8f2ff' }),
        f(6, 'castUp', { spawn: [{ kind: 'skyStrike', x: 230, y: 0, jitter: 16 }], sfx: 'thunder', flash: '#ffffff' }),
        f(6, 'castUp', { spawn: [{ kind: 'skyStrike', x: 310, y: 0, jitter: 18 }], sfx: 'thunder', flash: '#e8f2ff', zoom: 1.18 }),
        f(28, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 4. Ramasoon — thunder giant. Slow, armoured, hits like a truck.
// ---------------------------------------------------------------------------
const ramasoon = def({
  id: 'ramasoon',
  name: 'Ramasoon',
  nameTh: 'รามสูร',
  titleTh: 'ยักษ์ขว้างขวาน',
  bioTh: 'ยักษ์ผู้ขว้างขวานจนเกิดฟ้าร้อง เดินช้าแต่ทนและแรงที่สุดในเกม หลายท่ามีอาร์เมอร์ ไม่สะดุดง่าย',
  archetype: 'tank',
  hp: 1250, mp: 420, mpRegen: 15,
  walkSpeed: 1.9, runSpeed: 4.6, zSpeed: 1.3, jump: 10.6, airJumps: 0,
  weight: 1.5, half: 20, depth: 12, height: 86,
  look: {
    scale: 1.18, build: 1.3, skin: '#7fa86e', hair: '#241a12', hairStyle: 'spiky',
    primary: '#4a3a2a', secondary: '#2b2018', trim: '#c9a227', aura: '#9fd8ff',
    weapon: 'gauntlet', ambient: 'sparks',
  },
  skills: ['axeThrow', 'quake', 'thunderGrip', 'stormFury'],
  actions: {
    axeThrow: {
      id: 'axeThrow', name: 'ขว้างขวานฟ้า', desc: 'ขว้างขวานสายฟ้าเป็นวิถีโค้ง', tag: 'special',
      mpCost: 85, cooldown: 54, next: 'stand',
      frames: [
        f(11, 'throwWind', { armor: true, fx: [{ kind: 'charge', color: '#9fd8ff' }] }),
        f(5, 'throwRelease', { spawn: [{ kind: 'rock', x: 30, y: 56, vy: 3.4 }], sfx: 'whoosh' }),
        f(18, 'stand'),
      ],
    },
    quake: {
      id: 'quake', name: 'ทุบแผ่นดิน', desc: 'ทุบพื้นส่งคลื่นกระแทกไปข้างหน้า', tag: 'special',
      mpCost: 100, cooldown: 66, next: 'stand',
      frames: [
        f(12, 'castUp', { armor: true, fx: [{ kind: 'charge', color: '#f0d9a8' }] }),
        f(6, 'castDown', {
          spawn: [{ kind: 'groundWave', x: 30, y: 0 }],
          fx: [{ kind: 'shockring', scale: 1.3, color: '#f0d9a8' }, { kind: 'dust', count: 22 }],
          sfx: 'quake',
        }),
        f(20, 'stand'),
      ],
    },
    thunderGrip: {
      id: 'thunderGrip', name: 'กำหมัดอสนี', desc: 'คว้าแล้วทุ่มพร้อมสายฟ้า ทะลุการ์ด', tag: 'special',
      mpCost: 120, cooldown: 80, next: 'stand',
      frames: [
        f(7, 'grab', { vx: 3.4, armor: true }),
        f(7, 'grab', {
          hit: { box: { x: 26, y: 30, w: 42, h: 62 }, dmg: 34, kbx: 5, kby: 8, hitstun: 30, fall: 32, hitstop: 12, shake: 9, once: true, unblockable: true, element: 'shock', sfx: 'hit3' },
          fx: [{ kind: 'sparkBurst', count: 18, color: '#eaf6ff' }, { kind: 'impact', x: 34, y: 48, scale: 1.5 }],
          flash: '#7fb6ff',
        }),
        f(22, 'stand'),
      ],
    },
    stormFury: {
      id: 'stormFury', name: 'อสนีบาตคลั่ง', desc: 'ท่าไม้ตาย — หมุนขวานแล้วทุบปิดจบ', tag: 'super',
      mpCost: 300, cooldown: 240, next: 'stand',
      frames: [
        f(18, 'superCast', { flash: '#9fd8ff', slowmo: 0.34, zoom: 1.1, armor: true, fx: [{ kind: 'chargeBig', color: '#9fd8ff' }], sfx: 'super' }),
        f(30, 'spinKick', {
          vx: 2.6, armor: true,
          hit: { box: { x: -46, y: 10, w: 120, h: 88 }, dmg: 8, kbx: 1, hitstun: 8, fall: 2, guard: 8, hitstop: 2, shake: 2.4, element: 'shock', vacuum: 1.6 },
          fx: [{ kind: 'spinAura', color: '#9fd8ff' }],
        }),
        f(8, 'castUp', { armor: true }),
        f(8, 'castDown', {
          hit: { box: { x: -30, y: 0, w: 160, h: 110 }, dmg: 52, kbx: 12, kby: 8, hitstun: 34, fall: 45, guard: 50, hitstop: 16, shake: 14, once: true, element: 'shock', sfx: 'hit3' },
          spawn: [{ kind: 'groundWave', x: 40, y: 0 }, { kind: 'groundWave', x: -40, y: 0, vx: -8.5 }],
          fx: [{ kind: 'shockring', scale: 2.2, color: '#9fd8ff' }, { kind: 'sparkBurst', count: 30, color: '#eaf6ff' }],
          flash: '#dceeff', zoom: 1.24,
        }),
        f(30, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 5. Suriya — holy monk. Support-flavoured all-rounder that can heal.
// ---------------------------------------------------------------------------
const suriya = def({
  id: 'suriya',
  name: 'Suriya',
  nameTh: 'สุริยา',
  titleTh: 'พระอาทิตย์ทรงกลด',
  bioTh: 'นักบวชผู้ฝึกวิชาแสง โจมตีสมดุลและฟื้นเลือดตัวเองได้ เหมาะกับการเล่นยาว ๆ ไม่รีบ',
  archetype: 'allrounder',
  hp: 1000, mp: 560, mpRegen: 22,
  walkSpeed: 2.45, runSpeed: 5.4, zSpeed: 1.8, jump: 12.4, airJumps: 0,
  weight: 0.95, half: 14, depth: 9, height: 74,
  look: {
    scale: 1, build: 0.98, skin: '#e3b183', hair: '#20160e', hairStyle: 'bald',
    primary: '#f2a33c', secondary: '#c8642a', trim: '#fff0c2', aura: '#ffd15c',
    weapon: 'staff', ambient: 'motes',
  },
  skills: ['sunDisc', 'palmStrike', 'mantra', 'radiance'],
  actions: {
    sunDisc: {
      id: 'sunDisc', name: 'จักรสุริยะ', desc: 'ปล่อยจานแสงหมุนทะลุศัตรู', tag: 'special',
      mpCost: 90, cooldown: 50, next: 'stand',
      frames: [
        f(8, 'castWind', { fx: [{ kind: 'charge', color: '#ffd15c' }] }),
        f(4, 'castPush', { spawn: [{ kind: 'sunDisc', x: 28, y: 46 }], sfx: 'cast' }),
        f(14, 'stand'),
      ],
    },
    palmStrike: {
      id: 'palmStrike', name: 'ฝ่ามือทอง', desc: 'ผลักด้วยฝ่ามือแสง ดันศัตรูออกไกล', tag: 'special',
      mpCost: 80, cooldown: 46, next: 'stand',
      frames: [
        f(6, 'castWind', { vx: 1.5 }),
        f(6, 'castPush', {
          vx: 2.6,
          hit: { box: { x: 24, y: 30, w: 60, h: 56 }, dmg: 22, kbx: 9, kby: 2, hitstun: 22, fall: 18, guard: 22, hitstop: 7, shake: 5, once: true, element: 'holy', sfx: 'hit2' },
          fx: [{ kind: 'palmWave', x: 34, y: 46, scale: 1.3, color: '#ffd15c' }],
        }),
        f(16, 'stand'),
      ],
    },
    mantra: {
      id: 'mantra', name: 'สวดมนต์', desc: 'ยืนสวด ฟื้นเลือดและกันโดนช่วงหนึ่ง', tag: 'special',
      mpCost: 140, cooldown: 240, next: 'stand',
      frames: [
        f(10, 'channel', { invuln: true, fx: [{ kind: 'healRing', color: '#ffe9a8' }], sfx: 'heal' }),
        f(14, 'channel', { invuln: true, heal: 60, fx: [{ kind: 'healMotes', count: 14, color: '#fff0c2' }] }),
        f(14, 'channel', { heal: 60, fx: [{ kind: 'healMotes', count: 14, color: '#fff0c2' }] }),
        f(12, 'stand'),
      ],
    },
    radiance: {
      id: 'radiance', name: 'รัศมีเบิกฟ้า', desc: 'ท่าไม้ตาย — ลำแสงกวาดทั้งจอ', tag: 'super',
      mpCost: 270, cooldown: 220, next: 'stand',
      frames: [
        f(20, 'superCast', { flash: '#ffe9a8', slowmo: 0.3, zoom: 1.15, invuln: true, fx: [{ kind: 'chargeBig', color: '#ffd15c' }], sfx: 'super' }),
        f(30, 'castPush', {
          invuln: true,
          spawn: [{ kind: 'holyBeam', x: 220, y: 46 }],
          fx: [{ kind: 'beamCore', x: 40, y: 46, scale: 2, color: '#fff6d8' }],
          flash: '#fff6d8', zoom: 1.2, sfx: 'beam',
        }),
        f(26, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 6. Nakarin — naga. Poison damage-over-time and long reach.
// ---------------------------------------------------------------------------
const nakarin = def({
  id: 'nakarin',
  name: 'Nakarin',
  nameTh: 'นาคินทร์',
  titleTh: 'พญานาคเจ็ดเศียร',
  bioTh: 'ราชาแห่งบาดาล พ่นพิษและใช้หอกน้ำระยะยาว ศัตรูที่โดนพิษจะเสียเลือดต่อเนื่อง เล่นเน้นกดดัน',
  archetype: 'technical',
  hp: 980, mp: 540, mpRegen: 20,
  walkSpeed: 2.4, runSpeed: 5.2, zSpeed: 2.0, jump: 11.8, airJumps: 0,
  weight: 1.05, half: 16, depth: 10, height: 78,
  look: {
    scale: 1.05, build: 1.06, skin: '#7fd4c0', hair: '#0b6b5f', hairStyle: 'hood',
    primary: '#0e7a68', secondary: '#073b3a', trim: '#7ef0d0', aura: '#33e0b8',
    cape: '#0b5f56', weapon: 'spear', ambient: 'none',
  },
  skills: ['poisonSpit', 'waterLance', 'coilStrike', 'tidalRage'],
  actions: {
    poisonSpit: {
      id: 'poisonSpit', name: 'พ่นพิษ', desc: 'พ่นพิษเป็นวิถีโค้ง ติดสถานะพิษ', tag: 'special',
      mpCost: 70, cooldown: 42, next: 'stand',
      frames: [
        f(8, 'castWind', { fx: [{ kind: 'charge', color: '#c8ff8a' }] }),
        f(4, 'headbutt', { spawn: [{ kind: 'poisonSpit', x: 26, y: 50, count: 3, spread: 14 }], sfx: 'spit' }),
        f(14, 'stand'),
      ],
    },
    waterLance: {
      id: 'waterLance', name: 'หอกวารี', desc: 'แทงหอกน้ำระยะไกล ทะลุได้', tag: 'special',
      mpCost: 90, cooldown: 48, next: 'stand',
      frames: [
        f(7, 'slashWind'),
        f(5, 'stab', { vx: 2.4, spawn: [{ kind: 'waterLance', x: 34, y: 46 }], sfx: 'cast', fx: [{ kind: 'arc', x: 38, y: 46, color: '#7ec8ff' }] }),
        f(15, 'stand'),
      ],
    },
    coilStrike: {
      id: 'coilStrike', name: 'รัดพญานาค', desc: 'พุ่งเข้ารัดแล้วสะบัด ทะลุการ์ด', tag: 'special',
      mpCost: 110, cooldown: 74, next: 'stand',
      frames: [
        f(6, 'dash', { vx: 8.5, fx: [{ kind: 'dashline', color: '#33e0b8' }] }),
        f(8, 'grab', {
          hit: { box: { x: 22, y: 24, w: 46, h: 62 }, dmg: 28, kbx: 6, kby: 6, hitstun: 26, fall: 26, hitstop: 10, shake: 7, once: true, unblockable: true, element: 'poison', sfx: 'hit3' },
          fx: [{ kind: 'coil', x: 28, y: 44, color: '#33e0b8' }],
        }),
        f(20, 'stand'),
      ],
    },
    tidalRage: {
      id: 'tidalRage', name: 'คลื่นบาดาล', desc: 'ท่าไม้ตาย — คลื่นยักษ์กวาดทั้งแนว', tag: 'super',
      mpCost: 270, cooldown: 220, next: 'stand',
      frames: [
        f(18, 'superCast', { flash: '#6fd8ff', slowmo: 0.32, zoom: 1.12, invuln: true, fx: [{ kind: 'chargeBig', color: '#33e0b8' }], sfx: 'super' }),
        f(6, 'castPush', { spawn: [{ kind: 'tidalWave', x: 40, y: 0 }], sfx: 'wave', flash: '#bfe8ff' }),
        f(8, 'castPush', { spawn: [{ kind: 'tidalWave', x: 30, y: 0 }] }),
        f(8, 'castPush', { spawn: [{ kind: 'tidalWave', x: 20, y: 0 }, { kind: 'poisonSpit', x: 30, y: 60, count: 5, spread: 26 }], zoom: 1.18 }),
        f(26, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 7. Himawan — ice zoner. Freezes, then punishes.
// ---------------------------------------------------------------------------
const himawan = def({
  id: 'himawan',
  name: 'Himawan',
  nameTh: 'หิมวัน',
  titleTh: 'นักเวทหิมะ',
  bioTh: 'มาจากยอดเขาที่ไม่มีใครกลับมา แช่แข็งศัตรูแล้วค่อยเก็บ ต้องวางแผน ไม่ใช่สายบู๊',
  archetype: 'zoner',
  hp: 920, mp: 600, mpRegen: 23,
  walkSpeed: 2.25, runSpeed: 4.9, zSpeed: 1.7, jump: 12.0, airJumps: 0,
  weight: 0.9, half: 14, depth: 9, height: 73,
  look: {
    scale: 1, build: 0.95, skin: '#f0dcc4', hair: '#bfe6ff', hairStyle: 'long',
    primary: '#2b5f9e', secondary: '#14304f', trim: '#d9f2ff', aura: '#79c9ff',
    cape: '#cfe8ff', weapon: 'staff', ambient: 'frost',
  },
  skills: ['iceShard', 'iceSpike', 'frostNova', 'absoluteZero'],
  actions: {
    iceShard: {
      id: 'iceShard', name: 'เกล็ดน้ำแข็ง', desc: 'ยิงเกล็ดน้ำแข็งสามทาง', tag: 'special',
      mpCost: 70, cooldown: 36, next: 'stand',
      frames: [
        f(7, 'castWind', { fx: [{ kind: 'charge', color: '#79c9ff' }] }),
        f(4, 'castPush', { spawn: [{ kind: 'iceShard', x: 26, y: 48, count: 3, spread: 12 }], sfx: 'cast' }),
        f(12, 'stand'),
      ],
    },
    iceSpike: {
      id: 'iceSpike', name: 'แท่งน้ำแข็ง', desc: 'ปลุกแท่งน้ำแข็งจากพื้น ลอยศัตรู', tag: 'special',
      mpCost: 100, cooldown: 58, next: 'stand',
      frames: [
        f(9, 'castDown', { fx: [{ kind: 'charge', color: '#dff6ff' }] }),
        f(5, 'castDown', {
          spawn: [{ kind: 'iceSpike', x: 46, y: 0 }, { kind: 'iceSpike', x: 92, y: 0 }, { kind: 'iceSpike', x: 138, y: 0 }],
          sfx: 'ice', fx: [{ kind: 'frostRing', scale: 1.2 }],
        }),
        f(18, 'stand'),
      ],
    },
    frostNova: {
      id: 'frostNova', name: 'ระเบิดเยือกแข็ง', desc: 'ระเบิดความเย็นรอบตัว แช่แข็งศัตรู', tag: 'special',
      mpCost: 130, cooldown: 96, next: 'stand',
      frames: [
        f(10, 'castDown', { fx: [{ kind: 'charge', color: '#79c9ff' }] }),
        f(8, 'summon', {
          invuln: true,
          hit: { box: { x: -60, y: 0, w: 150, h: 100 }, dmg: 14, kbx: 3, hitstun: 16, fall: 8, guard: 16, hitstop: 6, shake: 5, once: true, element: 'ice' },
          fx: [{ kind: 'frostRing', scale: 1.8 }, { kind: 'sparkBurst', count: 22, color: '#dff6ff' }],
          sfx: 'ice', flash: '#bfe6ff',
        }),
        f(18, 'stand'),
      ],
    },
    absoluteZero: {
      id: 'absoluteZero', name: 'ศูนย์สัมบูรณ์', desc: 'ท่าไม้ตาย — พายุหิมะกลืนทั้งสนาม', tag: 'super',
      mpCost: 280, cooldown: 230, next: 'stand',
      frames: [
        f(22, 'superCast', { flash: '#cfeaff', slowmo: 0.3, zoom: 1.14, invuln: true, fx: [{ kind: 'chargeBig', color: '#79c9ff' }], sfx: 'super' }),
        f(10, 'castPush', { spawn: [{ kind: 'blizzard', x: 40, y: 30 }], sfx: 'blizzard' }),
        f(10, 'castPush', { spawn: [{ kind: 'blizzard', x: 30, y: 50 }] }),
        f(10, 'castPush', { spawn: [{ kind: 'blizzard', x: 30, y: 10 }, { kind: 'iceSpike', x: 120, y: 0 }, { kind: 'iceSpike', x: 190, y: 0 }], zoom: 1.2, flash: '#eaf9ff' }),
        f(28, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 8. Krutthep — garuda. Air superiority and dive attacks.
// ---------------------------------------------------------------------------
const krutthep = def({
  id: 'krutthep',
  name: 'Krutthep',
  nameTh: 'ครุฑเทพ',
  titleTh: 'พญาครุฑเวหา',
  bioTh: 'เจ้าแห่งนภา บินได้และดำดิ่งใส่ศัตรูจากฟ้า เก่งบนอากาศเป็นพิเศษ แต่บนพื้นโดนกดง่าย',
  archetype: 'rushdown',
  hp: 950, mp: 500, mpRegen: 20,
  walkSpeed: 2.7, runSpeed: 6.2, zSpeed: 2.1, jump: 14.2, airJumps: 2,
  weight: 0.88, half: 15, depth: 9, height: 76,
  look: {
    scale: 1.03, build: 1.05, skin: '#e9c07a', hair: '#c9302c', hairStyle: 'spiky',
    primary: '#d4432f', secondary: '#7a2118', trim: '#ffd166', aura: '#57e6b0',
    cape: '#e0673f', weapon: 'claw', ambient: 'leaves',
  },
  skills: ['windBlade', 'skyDive', 'talonRush', 'garudaStorm'],
  actions: {
    windBlade: {
      id: 'windBlade', name: 'ใบมีดวายุ', desc: 'ตวัดปีกส่งใบมีดลมสองใบ', tag: 'special',
      mpCost: 75, cooldown: 40, next: 'stand',
      frames: [
        f(6, 'slashWind'),
        f(4, 'slash1', { spawn: [{ kind: 'windBlade', x: 28, y: 40, count: 2, spread: 16 }], sfx: 'whoosh', fx: [{ kind: 'arc', x: 32, y: 44, color: '#37d6a0' }] }),
        f(13, 'stand'),
      ],
    },
    skyDive: {
      id: 'skyDive', name: 'ดิ่งพสุธา', desc: 'พุ่งขึ้นแล้วดิ่งลงใส่พื้น (ใช้กลางอากาศได้)', tag: 'special',
      mpCost: 95, cooldown: 60, next: 'stand',
      frames: [
        f(6, 'jumpRise', { vy: 13, vx: 2, fx: [{ kind: 'featherBurst', count: 12 }] }),
        f(8, 'airStall', { float: true }),
        f(14, 'stomp', {
          vy: -14, vx: 4,
          hit: { box: { x: 4, y: -8, w: 46, h: 44 }, dmg: 24, kbx: 4, kby: 4, hitstun: 22, fall: 22, guard: 20, hitstop: 8, shake: 6, once: true, element: 'wind', sfx: 'hit3' },
          fx: [{ kind: 'divelines', color: '#57e6b0' }],
        }),
        f(10, 'land', { fx: [{ kind: 'shockring', scale: 1, color: '#57e6b0' }, { kind: 'dust', count: 16 }] }),
      ],
    },
    talonRush: {
      id: 'talonRush', name: 'กรงเล็บพายุ', desc: 'พุ่งข่วนรัวสามครั้ง', tag: 'special',
      mpCost: 100, cooldown: 62, next: 'stand',
      frames: [
        f(5, 'dash', { vx: 9, fx: [{ kind: 'dashline', color: '#57e6b0' }] }),
        f(4, 'slash1', { vx: 5, hit: { box: { x: 24, y: 40, w: 42, h: 34 }, dmg: 10, kbx: 1, hitstun: 12, fall: 4, guard: 8, hitstop: 3, shake: 2, once: true, element: 'wind', sfx: 'slash' } }),
        f(4, 'slash2', { vx: 4, hit: { box: { x: 26, y: 38, w: 44, h: 36 }, dmg: 11, kbx: 1.4, hitstun: 12, fall: 5, guard: 8, hitstop: 3, shake: 2, once: true, element: 'wind', sfx: 'slash' } }),
        f(6, 'punch3', {
          vx: 3,
          hit: { box: { x: 28, y: 34, w: 48, h: 42 }, dmg: 18, kbx: 7, kby: 5, hitstun: 22, fall: 20, guard: 16, hitstop: 7, shake: 5, once: true, element: 'wind', launcher: true, sfx: 'hit2' },
          fx: [{ kind: 'crossSlash', x: 34, y: 44, color: '#57e6b0' }],
        }),
        f(16, 'stand'),
      ],
    },
    garudaStorm: {
      id: 'garudaStorm', name: 'พายุครุฑ', desc: 'ท่าไม้ตาย — ปั่นพายุดูดแล้วดิ่งทำลาย', tag: 'super',
      mpCost: 265, cooldown: 220, next: 'stand',
      frames: [
        f(16, 'superCast', { flash: '#8ff0cc', slowmo: 0.3, zoom: 1.12, invuln: true, fx: [{ kind: 'chargeBig', color: '#57e6b0' }], sfx: 'super' }),
        f(8, 'jumpRise', { vy: 15, spawn: [{ kind: 'cyclone', x: 70, y: 0 }], fx: [{ kind: 'featherBurst', count: 24 }] }),
        f(16, 'airStall', { float: true }),
        f(12, 'stomp', {
          vy: -17,
          hit: { box: { x: -10, y: -10, w: 76, h: 56 }, dmg: 46, kbx: 8, kby: 7, hitstun: 30, fall: 40, guard: 40, hitstop: 14, shake: 12, once: true, element: 'wind', sfx: 'hit3' },
          fx: [{ kind: 'divelines', color: '#57e6b0' }], zoom: 1.2,
        }),
        f(14, 'land', { fx: [{ kind: 'shockring', scale: 2, color: '#57e6b0' }, { kind: 'featherBurst', count: 30 }], flash: '#cffbe9' }),
        f(18, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 9. Bunlue — stone wrestler. The pure grappler.
// ---------------------------------------------------------------------------
const bunlue = def({
  id: 'bunlue',
  name: 'Bunlue',
  nameTh: 'บุญเหลือ',
  titleTh: 'ยอดมวยหินผา',
  bioTh: 'นักมวยคาดเชือกที่ฝึกกับก้อนหิน ไม่มีท่ายิงไกลเลย ต้องเข้าใกล้เพื่อจับทุ่ม แต่ถ้าจับติดคือเจ็บหนัก',
  archetype: 'grappler',
  hp: 1180, mp: 400, mpRegen: 16,
  walkSpeed: 2.2, runSpeed: 5.4, zSpeed: 1.6, jump: 11.2, airJumps: 0,
  weight: 1.35, half: 18, depth: 11, height: 82,
  look: {
    scale: 1.12, build: 1.24, skin: '#c98a52', hair: '#191410', hairStyle: 'short',
    primary: '#8c5a2b', secondary: '#4a2f18', trim: '#e8d6a8', aura: '#e0b070',
    weapon: 'none', ambient: 'none',
  },
  skills: ['stoneGrab', 'boulderThrow', 'ironBody', 'mountainBreaker'],
  actions: {
    stoneGrab: {
      id: 'stoneGrab', name: 'จับทุ่มหิน', desc: 'พุ่งจับแล้วทุ่มลงพื้น ทะลุการ์ด', tag: 'special',
      mpCost: 90, cooldown: 66, next: 'stand',
      frames: [
        f(6, 'dash', { vx: 8, armor: true, fx: [{ kind: 'dashline', color: '#e0b070' }] }),
        f(6, 'grab', {
          hit: { box: { x: 22, y: 26, w: 44, h: 60 }, dmg: 30, kbx: 3, kby: 7, hitstun: 28, fall: 30, hitstop: 11, shake: 8, once: true, unblockable: true, sfx: 'hit3' },
          fx: [{ kind: 'impact', x: 30, y: 46, scale: 1.4 }, { kind: 'dust', count: 14 }],
        }),
        f(20, 'stand'),
      ],
    },
    boulderThrow: {
      id: 'boulderThrow', name: 'ยกหินขว้าง', desc: 'ยกหินก้อนใหญ่ขว้างเป็นวิถีโค้ง', tag: 'special',
      mpCost: 80, cooldown: 56, next: 'stand',
      frames: [
        f(10, 'castDown', { armor: true, fx: [{ kind: 'dust', count: 8 }] }),
        f(6, 'throwRelease', { spawn: [{ kind: 'rock', x: 26, y: 60, vy: 4.2 }], sfx: 'whoosh' }),
        f(18, 'stand'),
      ],
    },
    ironBody: {
      id: 'ironBody', name: 'กายเหล็ก', desc: 'เข้าสภาพกายเหล็ก ลดดาเมจและไม่สะดุด', tag: 'special',
      mpCost: 110, cooldown: 300, next: 'stand',
      frames: [
        f(8, 'castDown', { armor: true, fx: [{ kind: 'charge', color: '#e0b070' }], sfx: 'buff' }),
        f(10, 'taunt', { armor: true, fx: [{ kind: 'buffAura', color: '#e0b070' }] }),
        f(10, 'stand'),
      ],
    },
    mountainBreaker: {
      id: 'mountainBreaker', name: 'ภูผาแตก', desc: 'ท่าไม้ตาย — จับแล้วทุบซ้ำจนแผ่นดินแยก', tag: 'super',
      mpCost: 280, cooldown: 230, next: 'stand',
      frames: [
        f(16, 'superCast', { flash: '#f0d9a8', slowmo: 0.32, zoom: 1.12, armor: true, fx: [{ kind: 'chargeBig', color: '#e0b070' }], sfx: 'super' }),
        f(6, 'dash', { vx: 11, armor: true }),
        f(8, 'grab', {
          hit: { box: { x: 20, y: 20, w: 52, h: 70 }, dmg: 22, kbx: 0, kby: 0, hitstun: 40, fall: 6, hitstop: 8, shake: 5, once: true, unblockable: true, vacuum: 3 },
          fx: [{ kind: 'impact', x: 30, y: 46, scale: 1.2 }],
        }),
        f(6, 'punch2', { hit: { box: { x: 18, y: 24, w: 50, h: 62 }, dmg: 14, hitstun: 30, fall: 4, hitstop: 5, shake: 4, once: true, unblockable: true }, fx: [{ kind: 'impact', x: 28, y: 48 }] }),
        f(6, 'punch3', { hit: { box: { x: 18, y: 24, w: 50, h: 62 }, dmg: 14, hitstun: 30, fall: 4, hitstop: 5, shake: 4, once: true, unblockable: true }, fx: [{ kind: 'impact', x: 28, y: 44 }] }),
        f(10, 'castDown', {
          hit: { box: { x: -20, y: 0, w: 140, h: 100 }, dmg: 46, kbx: 9, kby: 9, hitstun: 34, fall: 45, guard: 45, hitstop: 16, shake: 14, once: true, sfx: 'hit3' },
          spawn: [{ kind: 'stoneWall', x: 60, y: 0 }, { kind: 'stoneWall', x: 110, y: 0 }],
          fx: [{ kind: 'shockring', scale: 2.2, color: '#f0d9a8' }, { kind: 'dust', count: 34 }],
          flash: '#f5e6c0', zoom: 1.24,
        }),
        f(28, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 10. Sroithong — fan dancer. Petals that home, and a defensive spin.
// ---------------------------------------------------------------------------
const sroithong = def({
  id: 'sroithong',
  name: 'Sroithong',
  nameTh: 'สร้อยทอง',
  titleTh: 'นางรำพัดทอง',
  bioTh: 'นางรำจากวังหลวงที่เปลี่ยนท่ารำเป็นท่าฆ่า กลีบดอกไม้ของเธอตามเป้าเอง เก่งเรื่องคุมจังหวะและหลบ',
  archetype: 'technical',
  hp: 930, mp: 570, mpRegen: 22,
  walkSpeed: 2.6, runSpeed: 5.8, zSpeed: 2.2, jump: 12.8, airJumps: 1,
  weight: 0.86, half: 14, depth: 8, height: 72,
  look: {
    scale: 0.98, build: 0.93, skin: '#f0c9a0', hair: '#241a20', hairStyle: 'braid',
    primary: '#d9407a', secondary: '#6d1f3f', trim: '#ffd76a', aura: '#ff7fb0',
    cape: '#f06a9a', weapon: 'fan', ambient: 'petals',
  },
  skills: ['petalStorm', 'fanSlash', 'dancerSpin', 'blossomFinale'],
  actions: {
    petalStorm: {
      id: 'petalStorm', name: 'กลีบทองร่วง', desc: 'ปล่อยกลีบดอกไม้ตามเป้าหมาย', tag: 'special',
      mpCost: 80, cooldown: 44, next: 'stand',
      frames: [
        f(8, 'castWind', { fx: [{ kind: 'charge', color: '#ff7fb0' }] }),
        f(5, 'castPush', { spawn: [{ kind: 'petal', x: 24, y: 50, count: 6, spread: 40, jitter: 8 }], sfx: 'cast' }),
        f(14, 'stand'),
      ],
    },
    fanSlash: {
      id: 'fanSlash', name: 'พัดคมทอง', desc: 'ตวัดพัดสองครั้ง ดึงศัตรูเข้าหา', tag: 'special',
      mpCost: 85, cooldown: 48, next: 'stand',
      frames: [
        f(5, 'slashWind'),
        f(4, 'slash1', {
          hit: { box: { x: 26, y: 40, w: 52, h: 40 }, dmg: 12, kbx: -2, hitstun: 14, fall: 3, guard: 10, hitstop: 3, shake: 2, once: true, vacuum: 2, element: 'wind', sfx: 'slash' },
          fx: [{ kind: 'arc', x: 32, y: 46, color: '#ffd76a' }],
        }),
        f(5, 'slash2', {
          hit: { box: { x: 28, y: 36, w: 56, h: 46 }, dmg: 19, kbx: 6, kby: 4, hitstun: 20, fall: 16, guard: 14, hitstop: 6, shake: 4, once: true, element: 'wind', launcher: true, sfx: 'hit2' },
          fx: [{ kind: 'arc', x: 34, y: 44, scale: 1.3, color: '#ff7fb0' }],
        }),
        f(15, 'stand'),
      ],
    },
    dancerSpin: {
      id: 'dancerSpin', name: 'รำหมุนกลีบ', desc: 'หมุนตัวหลบกระสุนพร้อมโจมตีรอบตัว', tag: 'special',
      mpCost: 105, cooldown: 78, next: 'stand',
      frames: [
        f(4, 'castWind', { invuln: true }),
        f(24, 'spinKick', {
          vx: 1.4, invuln: true,
          hit: { box: { x: -34, y: 14, w: 96, h: 74 }, dmg: 6, kbx: 0.6, hitstun: 8, fall: 2, guard: 6, hitstop: 2, shake: 1.6, element: 'wind', vacuum: 1.2 },
          fx: [{ kind: 'spinAura', color: '#ff7fb0' }, { kind: 'petalSwirl', count: 3 }],
        }),
        f(10, 'stand'),
      ],
    },
    blossomFinale: {
      id: 'blossomFinale', name: 'บุปผาอวสาน', desc: 'ท่าไม้ตาย — พายุกลีบดอกไม้แล้วปิดด้วยพัด', tag: 'super',
      mpCost: 260, cooldown: 215, next: 'stand',
      frames: [
        f(16, 'superCast', { flash: '#ffc3da', slowmo: 0.3, zoom: 1.14, invuln: true, fx: [{ kind: 'chargeBig', color: '#ff7fb0' }], sfx: 'super' }),
        f(8, 'castPush', { spawn: [{ kind: 'petal', x: 24, y: 50, count: 10, spread: 70, jitter: 14 }], fx: [{ kind: 'petalSwirl', count: 6 }] }),
        f(8, 'castPush', { spawn: [{ kind: 'petal', x: 24, y: 60, count: 10, spread: 70, jitter: 14 }] }),
        f(8, 'slashWind', { vx: 4 }),
        f(6, 'slash2', {
          vx: 5,
          hit: { box: { x: 18, y: 20, w: 96, h: 92 }, dmg: 44, kbx: 10, kby: 7, hitstun: 32, fall: 42, guard: 42, hitstop: 14, shake: 11, once: true, element: 'wind', sfx: 'hit3' },
          fx: [{ kind: 'crossSlash', x: 46, y: 46, scale: 1.9, color: '#ff7fb0' }, { kind: 'petalSwirl', count: 8 }],
          flash: '#ffe0ec', zoom: 1.22,
        }),
        f(26, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 11. Adisorn — twin blades. Fastest normals in the game.
// ---------------------------------------------------------------------------
const adisorn = def({
  id: 'adisorn',
  name: 'Adisorn',
  nameTh: 'อดิศร',
  titleTh: 'ดาบคู่สายลม',
  bioTh: 'นักดาบหนุ่มที่เชื่อว่าเร็วกว่าคือชนะ ท่าพื้นฐานเร็วที่สุดในเกม ต่อคอมโบยาวได้ถ้าคุมจังหวะเป็น',
  archetype: 'rushdown',
  hp: 940, mp: 500, mpRegen: 21,
  walkSpeed: 2.95, runSpeed: 6.8, zSpeed: 2.2, jump: 13.0, airJumps: 1,
  weight: 0.88, half: 14, depth: 8, height: 73,
  look: {
    scale: 0.99, build: 0.96, skin: '#e6b489', hair: '#2b4a7a', hairStyle: 'short',
    primary: '#2f8fd8', secondary: '#183a5e', trim: '#e8f4ff', aura: '#5fd0ff',
    weapon: 'blade', ambient: 'none',
  },
  skills: ['bladeRush', 'riseSlash', 'whirlBlade', 'stormOfBlades'],
  actions: {
    // Faster, shorter basic chain than the shared one.
    attack1: {
      id: 'attack1', tag: 'basic', next: 'stand',
      frames: [
        f(2, 'slashWind'),
        f(3, 'slash1', { hit: { box: { x: 28, y: 42, w: 40, h: 26 }, dmg: 7, kbx: 1.8, hitstun: 11, fall: 3, guard: 6, hitstop: 3, shake: 1.4, once: true, sfx: 'slash' }, fx: [{ kind: 'arc', x: 30, y: 46, scale: 0.8 }] }),
        f(6, 'slash2', { cancel: ['attack2'] }),
      ],
    },
    attack2: {
      id: 'attack2', tag: 'basic', next: 'stand',
      frames: [
        f(2, 'slashWind'),
        f(3, 'slash2', { hit: { box: { x: 30, y: 40, w: 42, h: 30 }, dmg: 8, kbx: 2.4, hitstun: 12, fall: 5, guard: 8, hitstop: 3, shake: 1.8, once: true, sfx: 'slash' }, fx: [{ kind: 'arc', x: 32, y: 44, scale: 0.9 }] }),
        f(7, 'slash1', { cancel: ['attack3'] }),
      ],
    },
    bladeRush: {
      id: 'bladeRush', name: 'ดาบทะยาน', desc: 'พุ่งฟันผ่านตัวศัตรู', tag: 'special',
      mpCost: 75, cooldown: 44, next: 'stand',
      frames: [
        f(4, 'slashWind', { vx: -1.5 }),
        f(9, 'stab', {
          vx: 13,
          hit: { box: { x: 6, y: 38, w: 60, h: 34 }, dmg: 20, kbx: 5, kby: 2, hitstun: 20, fall: 16, guard: 16, hitstop: 6, shake: 4, once: true, sfx: 'slash' },
          fx: [{ kind: 'dashline', color: '#5fd0ff' }, { kind: 'ghostTrail', color: '#5fd0ff' }],
        }),
        f(12, 'land', { vx: 0.4 }),
      ],
    },
    riseSlash: {
      id: 'riseSlash', name: 'ฟันเสยฟ้า', desc: 'ฟันเสยขึ้น ลอยศัตรูเพื่อต่อคอมโบอากาศ', tag: 'special',
      mpCost: 90, cooldown: 52, next: 'jumpAir',
      frames: [
        f(5, 'castDown'),
        f(7, 'uppercut', {
          vy: 10, vx: 2.4,
          hit: { box: { x: 16, y: 22, w: 40, h: 72 }, dmg: 21, kbx: 1.6, kby: 9, hitstun: 24, fall: 18, guard: 18, hitstop: 7, shake: 5, once: true, launcher: true, sfx: 'hit2' },
          fx: [{ kind: 'arc', x: 22, y: 46, scale: 1.4, color: '#5fd0ff' }],
        }),
        f(12, 'jumpFall'),
      ],
    },
    whirlBlade: {
      id: 'whirlBlade', name: 'วนดาบพายุ', desc: 'หมุนดาบรอบตัว กันกระสุนได้', tag: 'special',
      mpCost: 100, cooldown: 72, next: 'stand',
      frames: [
        f(4, 'slashWind'),
        f(20, 'spinKick', {
          vx: 2,
          hit: { box: { x: -30, y: 18, w: 90, h: 66 }, dmg: 7, kbx: 1, hitstun: 9, fall: 3, guard: 7, hitstop: 2, shake: 1.8 },
          fx: [{ kind: 'spinAura', color: '#5fd0ff' }, { kind: 'bladeRing' }],
        }),
        f(6, 'slash2', {
          hit: { box: { x: 20, y: 24, w: 62, h: 62 }, dmg: 20, kbx: 8, kby: 5, hitstun: 24, fall: 24, guard: 20, hitstop: 8, shake: 5.5, once: true, sfx: 'hit2' },
          fx: [{ kind: 'crossSlash', x: 34, y: 46, color: '#5fd0ff' }],
        }),
        f(14, 'stand'),
      ],
    },
    stormOfBlades: {
      id: 'stormOfBlades', name: 'พายุดาบพัน', desc: 'ท่าไม้ตาย — พุ่งฟันไป-กลับหลายรอบ', tag: 'super',
      mpCost: 255, cooldown: 210, next: 'stand',
      frames: [
        f(14, 'superCast', { flash: '#9fe4ff', slowmo: 0.3, zoom: 1.14, invuln: true, fx: [{ kind: 'chargeBig', color: '#5fd0ff' }], sfx: 'super' }),
        f(6, 'stab', { vx: 15, invuln: true, hit: { box: { x: 0, y: 30, w: 70, h: 50 }, dmg: 12, kbx: 1, hitstun: 14, fall: 3, guard: 8, hitstop: 3, shake: 2.4, once: true }, fx: [{ kind: 'ghostTrail', color: '#5fd0ff' }] }),
        f(5, 'slashWind', { vx: -13, invuln: true }),
        f(6, 'stab', { vx: 15, invuln: true, hit: { box: { x: 0, y: 30, w: 70, h: 50 }, dmg: 12, kbx: 1, hitstun: 14, fall: 3, guard: 8, hitstop: 3, shake: 2.4, once: true }, fx: [{ kind: 'ghostTrail', color: '#5fd0ff' }] }),
        f(5, 'slashWind', { vx: -13, invuln: true }),
        f(8, 'slash2', {
          vx: 9,
          hit: { box: { x: 12, y: 22, w: 86, h: 76 }, dmg: 40, kbx: 10, kby: 6, hitstun: 30, fall: 40, guard: 40, hitstop: 14, shake: 11, once: true, sfx: 'hit3' },
          fx: [{ kind: 'crossSlash', x: 44, y: 46, scale: 1.9, color: '#5fd0ff' }],
          flash: '#d8f4ff', zoom: 1.2,
        }),
        f(26, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 12. Phailin — crystal sniper. Longest range, weakest up close.
// ---------------------------------------------------------------------------
const phailin = def({
  id: 'phailin',
  name: 'Phailin',
  nameTh: 'ไพลิน',
  titleTh: 'มือปืนแก้วมณี',
  bioTh: 'นักอัญมณีวิทยาที่ยิงผลึกได้แม่นราวปืน ระยะไกลที่สุดในเกม แต่ถ้าโดนเข้าประชิดคือลำบาก',
  archetype: 'zoner',
  hp: 880, mp: 580, mpRegen: 23,
  walkSpeed: 2.35, runSpeed: 5.2, zSpeed: 1.9, jump: 12.2, airJumps: 0,
  weight: 0.84, half: 14, depth: 8, height: 71,
  look: {
    scale: 0.98, build: 0.92, skin: '#eec7a4', hair: '#7a3fa0', hairStyle: 'pony',
    primary: '#7b3fb0', secondary: '#331452', trim: '#ffd9f2', aura: '#c33bd6',
    weapon: 'staff', ambient: 'motes',
  },
  skills: ['crystalShot', 'prismSpread', 'crystalTrap', 'prismCannon'],
  actions: {
    crystalShot: {
      id: 'crystalShot', name: 'ยิงผลึก', desc: 'ยิงผลึกเร็วและตรง ทะลุได้', tag: 'special',
      mpCost: 60, cooldown: 30, next: 'stand',
      frames: [
        f(6, 'castWind'),
        f(3, 'castPush', { spawn: [{ kind: 'crystalShot', x: 28, y: 48 }], sfx: 'shot' }),
        f(11, 'stand'),
      ],
    },
    prismSpread: {
      id: 'prismSpread', name: 'ผลึกกระจาย', desc: 'ยิงผลึกห้าทางเป็นรูปพัด', tag: 'special',
      mpCost: 105, cooldown: 56, next: 'stand',
      frames: [
        f(10, 'castWind', { fx: [{ kind: 'charge', color: '#c33bd6' }] }),
        f(4, 'castPush', { spawn: [{ kind: 'crystalShot', x: 26, y: 48, count: 5, spread: 34 }], sfx: 'shot' }),
        f(16, 'stand'),
      ],
    },
    crystalTrap: {
      id: 'crystalTrap', name: 'กับดักผลึก', desc: 'วางผลึกระเบิดไว้กับพื้น', tag: 'special',
      mpCost: 95, cooldown: 70, next: 'stand',
      frames: [
        f(7, 'castDown'),
        f(5, 'throwRelease', { spawn: [{ kind: 'voidMine', x: 22, y: 40, vx: 5, vy: 3 }], sfx: 'cast' }),
        f(16, 'stand'),
      ],
    },
    prismCannon: {
      id: 'prismCannon', name: 'ปืนใหญ่ปริซึม', desc: 'ท่าไม้ตาย — ลำแสงผลึกทะลุทั้งจอ', tag: 'super',
      mpCost: 265, cooldown: 220, next: 'stand',
      frames: [
        f(24, 'superCast', { flash: '#e8a8ff', slowmo: 0.3, zoom: 1.16, invuln: true, fx: [{ kind: 'chargeBig', color: '#c33bd6' }], sfx: 'super' }),
        f(26, 'castPush', {
          invuln: true,
          spawn: [{ kind: 'holyBeam', x: 220, y: 46 }],
          fx: [{ kind: 'beamCore', x: 40, y: 46, scale: 2.2, color: '#ffd9f2' }],
          flash: '#f4d5ff', zoom: 1.22, sfx: 'beam',
        }),
        f(10, 'castPush', { spawn: [{ kind: 'crystalShot', x: 30, y: 48, count: 7, spread: 50 }] }),
        f(24, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 13. Thoranee — earth guardian. Shields allies, walls off space.
// ---------------------------------------------------------------------------
const thoranee = def({
  id: 'thoranee',
  name: 'Thoranee',
  nameTh: 'ธรณี',
  titleTh: 'ผู้พิทักษ์ปฐพี',
  bioTh: 'แม่พระธรณีในร่างนักรบโล่ ตั้งกำแพงหินและกันดาเมจได้เก่งที่สุด ตัวช้าแต่แทบไม่ล้ม',
  archetype: 'tank',
  hp: 1220, mp: 460, mpRegen: 17,
  walkSpeed: 2.05, runSpeed: 4.8, zSpeed: 1.5, jump: 11.0, airJumps: 0,
  weight: 1.4, half: 18, depth: 11, height: 80,
  look: {
    scale: 1.1, build: 1.2, skin: '#c9955f', hair: '#3c2a16', hairStyle: 'long',
    primary: '#6b7f3a', secondary: '#3a4520', trim: '#d8c98a', aura: '#a8d06a',
    cape: '#5c6f30', weapon: 'gauntlet', ambient: 'leaves',
  },
  skills: ['stoneWall', 'shieldBash', 'rootGrasp', 'gaiaJudgement'],
  actions: {
    stoneWall: {
      id: 'stoneWall', name: 'กำแพงหิน', desc: 'ปลุกกำแพงหินขึ้นจากพื้น กันและงัดศัตรู', tag: 'special',
      mpCost: 90, cooldown: 60, next: 'stand',
      frames: [
        f(9, 'castDown', { armor: true, fx: [{ kind: 'charge', color: '#a8d06a' }] }),
        f(5, 'castDown', { spawn: [{ kind: 'stoneWall', x: 50, y: 0 }, { kind: 'stoneWall', x: 96, y: 0 }], sfx: 'quake', fx: [{ kind: 'dust', count: 18 }] }),
        f(18, 'stand'),
      ],
    },
    shieldBash: {
      id: 'shieldBash', name: 'กระแทกโล่', desc: 'พุ่งกระแทกด้วยโล่ พร้อมอาร์เมอร์', tag: 'special',
      mpCost: 85, cooldown: 56, next: 'stand',
      frames: [
        f(6, 'guardSword', { armor: true }),
        f(10, 'castPush', {
          vx: 8, armor: true,
          hit: { box: { x: 22, y: 26, w: 52, h: 56 }, dmg: 24, kbx: 8, kby: 3, hitstun: 24, fall: 20, guard: 24, hitstop: 8, shake: 6, once: true, sfx: 'hit2' },
          fx: [{ kind: 'impact', x: 32, y: 46, scale: 1.2 }, { kind: 'dust', count: 10 }],
        }),
        f(18, 'stand'),
      ],
    },
    rootGrasp: {
      id: 'rootGrasp', name: 'รากพันธนาการ', desc: 'รากไม้โผล่จากพื้น ตรึงศัตรูไว้', tag: 'special',
      mpCost: 105, cooldown: 84, next: 'stand',
      frames: [
        f(10, 'castDown', { armor: true }),
        f(6, 'summon', {
          spawn: [{ kind: 'cyclone', x: 80, y: 0 }],
          fx: [{ kind: 'rootBurst', x: 80, y: 0, color: '#a8d06a' }],
          sfx: 'root',
        }),
        f(20, 'stand'),
      ],
    },
    gaiaJudgement: {
      id: 'gaiaJudgement', name: 'ปฐพีพิโรธ', desc: 'ท่าไม้ตาย — แผ่นดินแยกเป็นแนวยาว', tag: 'super',
      mpCost: 285, cooldown: 235, next: 'stand',
      frames: [
        f(20, 'superCast', { flash: '#c8e69a', slowmo: 0.32, zoom: 1.12, armor: true, fx: [{ kind: 'chargeBig', color: '#a8d06a' }], sfx: 'super' }),
        f(8, 'castDown', { spawn: [{ kind: 'stoneWall', x: 60, y: 0 }, { kind: 'groundWave', x: 40, y: 0 }], sfx: 'quake', fx: [{ kind: 'shockring', scale: 1.6, color: '#d8c98a' }] }),
        f(8, 'castDown', { spawn: [{ kind: 'stoneWall', x: 120, y: 0 }, { kind: 'stoneWall', x: -60, y: 0 }], fx: [{ kind: 'dust', count: 24 }] }),
        f(10, 'castDown', {
          hit: { box: { x: -70, y: 0, w: 200, h: 120 }, dmg: 44, kbx: 8, kby: 9, hitstun: 32, fall: 42, guard: 45, hitstop: 15, shake: 13, once: true, sfx: 'hit3' },
          spawn: [{ kind: 'stoneWall', x: 180, y: 0 }],
          fx: [{ kind: 'shockring', scale: 2.4, color: '#a8d06a' }, { kind: 'dust', count: 40 }],
          flash: '#e6f2c8', zoom: 1.24,
        }),
        f(30, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 14. Wayu — storm spear. Mid-range poke specialist.
// ---------------------------------------------------------------------------
const wayu = def({
  id: 'wayu',
  name: 'Wayu',
  nameTh: 'วายุ',
  titleTh: 'หอกอสนีบาต',
  bioTh: 'ทหารม้าที่สูญเสียม้าไปแต่ยังเหลือหอก ระยะกลางแทงได้ไกลกว่าคนอื่น เล่นแบบจิ้มแล้วถอย',
  archetype: 'technical',
  hp: 990, mp: 520, mpRegen: 20,
  walkSpeed: 2.6, runSpeed: 5.9, zSpeed: 1.9, jump: 12.6, airJumps: 0,
  weight: 0.98, half: 15, depth: 9, height: 76,
  look: {
    scale: 1.02, build: 1, skin: '#dfae82', hair: '#4a4a58', hairStyle: 'short',
    primary: '#5b5fd6', secondary: '#26295e', trim: '#cfd4ff', aura: '#8f6bff',
    cape: '#4a4fbf', weapon: 'spear', ambient: 'sparks',
  },
  skills: ['spearBolt', 'lungeStab', 'spearVault', 'thousandSpears'],
  actions: {
    spearBolt: {
      id: 'spearBolt', name: 'หอกสายฟ้า', desc: 'ขว้างพลังหอกทะลุแนวตรง', tag: 'special',
      mpCost: 75, cooldown: 40, next: 'stand',
      frames: [
        f(7, 'slashWind', { fx: [{ kind: 'charge', color: '#8f6bff' }] }),
        f(4, 'stab', { spawn: [{ kind: 'spearBolt', x: 34, y: 46 }], sfx: 'cast' }),
        f(13, 'stand'),
      ],
    },
    lungeStab: {
      id: 'lungeStab', name: 'พุ่งแทง', desc: 'ก้าวยาวแทงระยะไกลกว่าปกติ', tag: 'special',
      mpCost: 80, cooldown: 46, next: 'stand',
      frames: [
        f(6, 'slashWind', { vx: -1 }),
        f(6, 'stab', {
          vx: 7.5,
          hit: { box: { x: 34, y: 40, w: 66, h: 26 }, dmg: 22, kbx: 6.5, kby: 1.5, hitstun: 22, fall: 18, guard: 18, hitstop: 6, shake: 4, once: true, element: 'shock', sfx: 'slash' },
          fx: [{ kind: 'arc', x: 46, y: 44, scale: 1.2, color: '#8f6bff' }],
        }),
        f(16, 'stand'),
      ],
    },
    spearVault: {
      id: 'spearVault', name: 'ค้ำหอกกระโดด', desc: 'ค้ำหอกกระโดดข้ามศัตรูแล้วฟาดลง', tag: 'special',
      mpCost: 95, cooldown: 62, next: 'stand',
      frames: [
        f(5, 'castDown', { vx: 3 }),
        f(10, 'jumpRise', { vy: 12, vx: 7, invuln: true, fx: [{ kind: 'dashline', color: '#8f6bff' }] }),
        f(12, 'overhead', {
          vy: -10, vx: 3,
          hit: { box: { x: 20, y: 6, w: 52, h: 60 }, dmg: 26, kbx: 4, kby: 3, hitstun: 24, fall: 24, guard: 20, hitstop: 8, shake: 6, once: true, element: 'shock', sfx: 'hit3' },
          fx: [{ kind: 'arc', x: 30, y: 30, scale: 1.4, color: '#8f6bff' }],
        }),
        f(12, 'land', { fx: [{ kind: 'dust', count: 12 }] }),
      ],
    },
    thousandSpears: {
      id: 'thousandSpears', name: 'หอกพันเล่ม', desc: 'ท่าไม้ตาย — ระดมแทงแล้วส่งหอกพลังชุดใหญ่', tag: 'super',
      mpCost: 260, cooldown: 215, next: 'stand',
      frames: [
        f(16, 'superCast', { flash: '#b8a4ff', slowmo: 0.3, zoom: 1.14, invuln: true, fx: [{ kind: 'chargeBig', color: '#8f6bff' }], sfx: 'super' }),
        f(4, 'stab', { vx: 3, hit: { box: { x: 30, y: 36, w: 76, h: 34 }, dmg: 9, kbx: 0.6, hitstun: 10, fall: 2, guard: 6, hitstop: 2, shake: 2, once: true, element: 'shock' }, fx: [{ kind: 'arc', x: 44, y: 44, color: '#8f6bff' }] }),
        f(4, 'slashWind', { vx: 1 }),
        f(4, 'stab', { vx: 3, hit: { box: { x: 30, y: 36, w: 76, h: 34 }, dmg: 9, kbx: 0.6, hitstun: 10, fall: 2, guard: 6, hitstop: 2, shake: 2, once: true, element: 'shock' }, fx: [{ kind: 'arc', x: 44, y: 44, color: '#8f6bff' }] }),
        f(4, 'slashWind', { vx: 1 }),
        f(8, 'stab', {
          vx: 5,
          spawn: [{ kind: 'spearBolt', x: 36, y: 30, count: 5, spread: 26 }],
          hit: { box: { x: 30, y: 30, w: 86, h: 50 }, dmg: 34, kbx: 10, kby: 5, hitstun: 30, fall: 38, guard: 38, hitstop: 13, shake: 10, once: true, element: 'shock', sfx: 'hit3' },
          fx: [{ kind: 'crossSlash', x: 48, y: 44, scale: 1.8, color: '#8f6bff' }],
          flash: '#ddd4ff', zoom: 1.2,
        }),
        f(26, 'stand'),
      ],
    },
  },
});

// ---------------------------------------------------------------------------
// 15. Ratree — night scythe. Traps, drains, punishes greed.
// ---------------------------------------------------------------------------
const ratree = def({
  id: 'ratree',
  name: 'Ratree',
  nameTh: 'ราตรี',
  titleTh: 'เคียวรัตติกาล',
  bioTh: 'ผู้เก็บวิญญาณที่ทำงานเฉพาะตอนกลางคืน ดูดเลือดจากศัตรูและวางกับดักมืด ยิ่งสู้ยาวยิ่งได้เปรียบ',
  archetype: 'assassin',
  hp: 900, mp: 540, mpRegen: 21,
  walkSpeed: 2.5, runSpeed: 5.7, zSpeed: 2.0, jump: 12.4, airJumps: 1,
  weight: 0.9, half: 15, depth: 9, height: 75,
  look: {
    scale: 1.02, build: 0.94, skin: '#cbb6c9', hair: '#2a1030', hairStyle: 'hood',
    primary: '#3a1a4a', secondary: '#170820', trim: '#b57bff', aura: '#b57bff',
    cape: '#2a1038', weapon: 'sword', ambient: 'shadow',
  },
  skills: ['scytheWave', 'soulDrain', 'voidMine', 'nightHarvest'],
  actions: {
    scytheWave: {
      id: 'scytheWave', name: 'คลื่นเคียว', desc: 'เหวี่ยงเคียวส่งคลื่นมืดทะลุ', tag: 'special',
      mpCost: 85, cooldown: 46, next: 'stand',
      frames: [
        f(8, 'slashWind', { fx: [{ kind: 'charge', color: '#b57bff' }] }),
        f(4, 'slash2', { spawn: [{ kind: 'darkScythe', x: 30, y: 44 }], sfx: 'cast', fx: [{ kind: 'arc', x: 34, y: 46, scale: 1.3, color: '#b57bff' }] }),
        f(15, 'stand'),
      ],
    },
    soulDrain: {
      id: 'soulDrain', name: 'ดูดวิญญาณ', desc: 'ดึงศัตรูเข้ามาแล้วดูดเลือด', tag: 'special',
      mpCost: 110, cooldown: 80, next: 'stand',
      frames: [
        f(10, 'channel', { fx: [{ kind: 'charge', color: '#b57bff' }], sfx: 'drain' }),
        f(16, 'channel', {
          hit: { box: { x: 10, y: 10, w: 120, h: 84 }, dmg: 4, kbx: 0, hitstun: 6, fall: 1, guard: 4, hitstop: 1, shake: 1.2, element: 'dark', vacuum: 2.6, lifesteal: 0.85 },
          fx: [{ kind: 'drainBeam', color: '#b57bff' }],
        }),
        f(14, 'stand'),
      ],
    },
    voidMine: {
      id: 'voidMine', name: 'หลุมมืด', desc: 'โยนหลุมมืดไว้ ระเบิดเมื่อโดนเหยียบ', tag: 'special',
      mpCost: 90, cooldown: 66, next: 'stand',
      frames: [
        f(7, 'throwWind'),
        f(5, 'throwRelease', { spawn: [{ kind: 'voidMine', x: 24, y: 44, vx: 6, vy: 4 }], sfx: 'cast' }),
        f(15, 'stand'),
      ],
    },
    nightHarvest: {
      id: 'nightHarvest', name: 'เก็บเกี่ยวราตรี', desc: 'ท่าไม้ตาย — ดึงทุกคนเข้ามาแล้วเกี่ยวรวดเดียว', tag: 'super',
      mpCost: 270, cooldown: 225, next: 'stand',
      frames: [
        f(18, 'superCast', { flash: '#d0a8ff', slowmo: 0.32, zoom: 1.16, invuln: true, fx: [{ kind: 'chargeBig', color: '#b57bff' }, { kind: 'darkVeil' }], sfx: 'super' }),
        f(20, 'channel', {
          invuln: true,
          hit: { box: { x: -80, y: 0, w: 260, h: 110 }, dmg: 4, kbx: 0, hitstun: 8, fall: 1, guard: 4, hitstop: 1, shake: 1.6, element: 'dark', vacuum: 3.4, lifesteal: 0.5 },
          fx: [{ kind: 'drainBeam', color: '#b57bff' }, { kind: 'darkVeil' }],
        }),
        f(6, 'slashWind'),
        f(8, 'slash2', {
          hit: { box: { x: -40, y: 10, w: 150, h: 96 }, dmg: 46, kbx: 9, kby: 6, hitstun: 32, fall: 42, guard: 42, hitstop: 15, shake: 12, once: true, element: 'dark', lifesteal: 0.35, sfx: 'hit3' },
          fx: [{ kind: 'crossSlash', x: 30, y: 46, scale: 2.2, color: '#b57bff' }, { kind: 'shockring', scale: 1.8, color: '#b57bff' }],
          flash: '#e8d0ff', zoom: 1.24,
        }),
        f(28, 'stand'),
      ],
    },
  },
});

export const ROSTER: CharacterDef[] = [
  kraisorn, adisorn, nilrat, krutthep, ramasoon,
  mekhala, himawan, phailin, suriya, sroithong,
  nakarin, wayu, bunlue, thoranee, ratree,
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(
  ROSTER.map((c) => [c.id, c]),
);

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? ROSTER[0];
}
