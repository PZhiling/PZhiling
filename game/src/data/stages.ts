/**
 * Ten stages.
 *
 * Difficulty rises through three levers, not one: the `level` multiplier on
 * each wave, how many enemies stand up at once, and which archetypes show up
 * together (a zoner behind a tank is much harder than two rushdowns).
 *
 * Each stage also carries the Google Flow prompt for its track, so the music
 * brief never drifts away from the art direction it belongs to.
 */

import type { StageDef } from '../sim/types';

export const STAGES: StageDef[] = [
  {
    id: 'village',
    nameTh: 'หมู่บ้านรุ่งอรุณ',
    subtitleTh: 'ด่านที่ 1 · เริ่มต้นการเดินทาง',
    theme: 'village',
    width: 2600,
    zNear: 118,
    zFar: 34,
    palette: {
      skyTop: '#1b2a4a', skyBottom: '#f0a45c', sun: '#ffd9a0', fog: '#e0a878',
      ground: '#6b5136', groundLine: '#8a6a45', ambient: '#ffb877', ambientStrength: 0.16,
    },
    weather: 'fireflies',
    drops: ['heal', 'mana'],
    musicTh: 'อรุณรุ่งเหนือทุ่งข้าว',
    musicPrompt:
      'Warm sunrise adventure theme, Thai folk fusion — khim and ranat ek over soft taiko and acoustic bass, 96 BPM, hopeful and open, light strings pad, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['adisorn', 'adisorn'], level: 0.7, from: 'right', bannerTh: 'โจรบุกหมู่บ้าน' },
      { enemies: ['bunlue', 'adisorn', 'adisorn'], level: 0.75, from: 'both' },
      { enemies: ['kraisorn'], level: 0.95, from: 'right', bannerTh: 'หัวหน้าโจร ไกรสร', boss: true },
    ],
  },
  {
    id: 'bamboo',
    nameTh: 'ป่าไผ่ยามวิกาล',
    subtitleTh: 'ด่านที่ 2 · เสียงใบไผ่และรอยมีด',
    theme: 'bamboo',
    width: 3000,
    zNear: 118,
    zFar: 30,
    palette: {
      skyTop: '#08121e', skyBottom: '#123a3a', sun: '#bfe8d0', fog: '#123330',
      ground: '#1e2b22', groundLine: '#33513c', ambient: '#7fd0a8', ambientStrength: 0.2,
    },
    weather: 'fireflies',
    drops: ['heal', 'mana', 'knife'],
    musicTh: 'เงาไผ่',
    musicPrompt:
      'Nocturnal stealth theme — bamboo flute and pizzicato guzheng over a sparse hand-drum groove, 88 BPM, tense and airy, wide reverb, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['nilrat', 'nilrat'], level: 0.85, from: 'both', bannerTh: 'นักฆ่าในเงามืด' },
      { enemies: ['adisorn', 'nilrat', 'sroithong'], level: 0.9, from: 'both' },
      { enemies: ['nilrat', 'nilrat', 'nilrat'], level: 0.95, from: 'both' },
      { enemies: ['sroithong'], level: 1.05, from: 'left', bannerTh: 'นางรำพัดทอง สร้อยทอง', boss: true },
    ],
  },
  {
    id: 'market',
    nameTh: 'ตลาดน้ำคลองใหญ่',
    subtitleTh: 'ด่านที่ 3 · ศึกกลางสายน้ำ',
    theme: 'market',
    width: 3200,
    zNear: 116,
    zFar: 36,
    palette: {
      skyTop: '#2a4a7a', skyBottom: '#8fc4e8', sun: '#ffffff', fog: '#a8cfe0',
      ground: '#5a4a38', groundLine: '#7d6848', ambient: '#a8d8f0', ambientStrength: 0.14,
    },
    weather: 'none',
    drops: ['heal', 'heal', 'mana', 'stick'],
    musicTh: 'ตลาดเช้าริมคลอง',
    musicPrompt:
      'Bright market bustle theme — plucked phin and marimba over a shuffling 6/8 groove, 112 BPM, playful and busy, hand percussion and finger cymbals, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['nakarin', 'adisorn', 'adisorn'], level: 0.95, from: 'both', bannerTh: 'พวกลักลอบขนของ' },
      { enemies: ['bunlue', 'bunlue', 'nakarin'], level: 1.0, from: 'both' },
      { enemies: ['phailin', 'adisorn', 'adisorn', 'nilrat'], level: 1.0, from: 'both' },
      { enemies: ['nakarin'], level: 1.15, from: 'right', bannerTh: 'พญานาคเจ็ดเศียร นาคินทร์', boss: true },
    ],
  },
  {
    id: 'snowpeak',
    nameTh: 'ยอดเขาหิมพานต์',
    subtitleTh: 'ด่านที่ 4 · ลมหนาวกัดกระดูก',
    theme: 'snowpeak',
    width: 3200,
    zNear: 114,
    zFar: 32,
    palette: {
      skyTop: '#14213d', skyBottom: '#6f9ecb', sun: '#e8f4ff', fog: '#c8dcf0',
      ground: '#c9dcea', groundLine: '#eaf4ff', ambient: '#bcd8f5', ambientStrength: 0.24,
    },
    weather: 'snow',
    drops: ['heal', 'mana', 'mana'],
    musicTh: 'ลมเหนือ',
    musicPrompt:
      'Frozen summit theme — glassy bells and sustained strings over a slow half-time drum, 76 BPM, vast and cold, distant choir pad, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['himawan', 'bunlue', 'bunlue'], level: 1.05, from: 'both', bannerTh: 'ผู้เฝ้ายอดเขา' },
      { enemies: ['himawan', 'himawan', 'thoranee'], level: 1.1, from: 'both' },
      { enemies: ['nilrat', 'nilrat', 'himawan', 'adisorn'], level: 1.1, from: 'both' },
      { enemies: ['himawan'], level: 1.3, from: 'left', bannerTh: 'นักเวทหิมะ หิมวัน', boss: true },
    ],
  },
  {
    id: 'desert',
    nameTh: 'ซากเมืองทะเลทราย',
    subtitleTh: 'ด่านที่ 5 · ใต้แดดที่ไม่ปรานีใคร',
    theme: 'desert',
    width: 3400,
    zNear: 118,
    zFar: 34,
    palette: {
      skyTop: '#3d5a8a', skyBottom: '#f2c46a', sun: '#fff3c4', fog: '#e0bc84',
      ground: '#c9a05e', groundLine: '#e0bc84', ambient: '#ffd89a', ambientStrength: 0.2,
    },
    weather: 'sand',
    drops: ['heal', 'mana', 'stick', 'knife'],
    musicTh: 'ลมทรายกลบเมือง',
    musicPrompt:
      'Sunbaked ruins theme — oud and duduk over deep frame drums, 100 BPM, weary and grand, brass swells on the turnaround, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['thoranee', 'phailin', 'adisorn'], level: 1.15, from: 'both', bannerTh: 'ทหารรับจ้าง' },
      { enemies: ['bunlue', 'bunlue', 'thoranee', 'phailin'], level: 1.15, from: 'both' },
      { enemies: ['wayu', 'wayu', 'phailin'], level: 1.2, from: 'both' },
      { enemies: ['thoranee'], level: 1.35, from: 'right', bannerTh: 'ผู้พิทักษ์ปฐพี ธรณี', boss: true },
    ],
  },
  {
    id: 'lava',
    nameTh: 'ถ้ำลาวาใต้พิภพ',
    subtitleTh: 'ด่านที่ 6 · หายใจเป็นไฟ',
    theme: 'lava',
    width: 3000,
    zNear: 112,
    zFar: 36,
    palette: {
      skyTop: '#180608', skyBottom: '#7a1c0a', sun: '#ff9a3c', fog: '#5a1408',
      ground: '#2e1410', groundLine: '#6b2a14', ambient: '#ff8a48', ambientStrength: 0.3,
    },
    weather: 'embers',
    drops: ['heal', 'mana'],
    musicTh: 'หัวใจภูเขาไฟ',
    musicPrompt:
      'Molten depths theme — distorted low brass and industrial taiko, 128 BPM, driving and dangerous, metallic percussion hits, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['kraisorn', 'kraisorn', 'bunlue'], level: 1.25, from: 'both', bannerTh: 'ทหารเพลิง' },
      { enemies: ['ramasoon', 'kraisorn', 'adisorn', 'adisorn'], level: 1.25, from: 'both' },
      { enemies: ['kraisorn', 'kraisorn', 'kraisorn'], level: 1.3, from: 'both' },
      { enemies: ['ramasoon'], level: 1.4, from: 'right', bannerTh: 'ยักษ์ขว้างขวาน รามสูร', boss: true },
    ],
  },
  {
    id: 'temple',
    nameTh: 'วัดร้างกลางสายฝน',
    subtitleTh: 'ด่านที่ 7 · ฝนไม่หยุด ศึกก็ไม่หยุด',
    theme: 'temple',
    width: 3400,
    zNear: 116,
    zFar: 32,
    palette: {
      skyTop: '#141c2c', skyBottom: '#3a4a63', sun: '#c8d8ea', fog: '#2c3a4e',
      ground: '#3a3830', groundLine: '#5a5648', ambient: '#8fa8c8', ambientStrength: 0.22,
    },
    weather: 'rain',
    drops: ['heal', 'heal', 'mana'],
    musicTh: 'ฝนบนหลังคาโบสถ์',
    musicPrompt:
      'Rain-soaked temple theme — solo erhu over muted piano and rolling toms, 84 BPM, melancholy turning resolute, temple bell accents, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['suriya', 'suriya', 'thoranee'], level: 1.3, from: 'both', bannerTh: 'พระนักรบผู้หลงทาง' },
      { enemies: ['wayu', 'wayu', 'suriya', 'phailin'], level: 1.3, from: 'both' },
      { enemies: ['ratree', 'nilrat', 'nilrat'], level: 1.35, from: 'both' },
      { enemies: ['suriya'], level: 1.45, from: 'left', bannerTh: 'พระอาทิตย์ทรงกลด สุริยา', boss: true },
    ],
  },
  {
    id: 'skycity',
    nameTh: 'นครลอยฟ้า',
    subtitleTh: 'ด่านที่ 8 · เหนือเมฆไม่มีที่ถอย',
    theme: 'skycity',
    width: 3600,
    zNear: 114,
    zFar: 30,
    palette: {
      skyTop: '#1e2f66', skyBottom: '#8fb8f0', sun: '#ffffff', fog: '#b8d0f5',
      ground: '#8a93b8', groundLine: '#c8d4f0', ambient: '#cfe0ff', ambientStrength: 0.2,
    },
    weather: 'none',
    drops: ['heal', 'mana', 'mana'],
    musicTh: 'เหนือเมฆ',
    musicPrompt:
      'Sky fortress theme — soaring synth strings and arpeggiated bells over a driving four-on-the-floor, 132 BPM, heroic and weightless, big cinematic snare, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['krutthep', 'krutthep', 'wayu'], level: 1.4, from: 'both', bannerTh: 'กองบินครุฑ' },
      { enemies: ['mekhala', 'krutthep', 'adisorn', 'adisorn'], level: 1.4, from: 'both' },
      { enemies: ['krutthep', 'krutthep', 'mekhala', 'phailin'], level: 1.45, from: 'both' },
      { enemies: ['krutthep'], level: 1.55, from: 'right', bannerTh: 'พญาครุฑเวหา ครุฑเทพ', boss: true },
    ],
  },
  {
    id: 'fortress',
    nameTh: 'ป้อมปราการเงา',
    subtitleTh: 'ด่านที่ 9 · ประตูสุดท้ายก่อนบัลลังก์',
    theme: 'fortress',
    width: 3600,
    zNear: 114,
    zFar: 32,
    palette: {
      skyTop: '#0d0716', skyBottom: '#3a1a52', sun: '#c88bff', fog: '#2a1240',
      ground: '#241830', groundLine: '#463058', ambient: '#a06ad8', ambientStrength: 0.26,
    },
    weather: 'ash',
    drops: ['heal', 'mana', 'knife'],
    musicTh: 'ประตูเงา',
    musicPrompt:
      'Dark fortress theme — detuned choir and low brass over a relentless 3/4 ostinato, 92 BPM, oppressive and ceremonial, chain and anvil percussion, no vocals, loopable 90 seconds.',
    waves: [
      { enemies: ['ratree', 'ratree', 'ramasoon'], level: 1.5, from: 'both', bannerTh: 'องครักษ์รัตติกาล' },
      { enemies: ['nilrat', 'nilrat', 'ratree', 'thoranee'], level: 1.5, from: 'both' },
      { enemies: ['ramasoon', 'thoranee', 'himawan', 'phailin'], level: 1.55, from: 'both' },
      { enemies: ['ratree'], level: 1.65, from: 'left', bannerTh: 'เคียวรัตติกาล ราตรี', boss: true },
    ],
  },
  {
    id: 'astral',
    nameTh: 'วิหารดวงดาว',
    subtitleTh: 'ด่านที่ 10 · ศึกชี้ชะตา',
    theme: 'astral',
    width: 3200,
    zNear: 112,
    zFar: 34,
    palette: {
      skyTop: '#05030f', skyBottom: '#1a1246', sun: '#ffe9a8', fog: '#170f38',
      ground: '#171034', groundLine: '#3a2a70', ambient: '#9fb8ff', ambientStrength: 0.28,
    },
    weather: 'stars',
    drops: ['heal', 'heal', 'mana', 'mana'],
    musicTh: 'บัลลังก์ดวงดาว',
    musicPrompt:
      'Final confrontation theme — full orchestra with wordless choir and taiko, 140 BPM, two-part structure: solemn 30-second intro then relentless main section, no vocals, loopable 120 seconds.',
    waves: [
      { enemies: ['ratree', 'krutthep', 'ramasoon'], level: 1.6, from: 'both', bannerTh: 'ผู้พิทักษ์ทั้งสาม' },
      { enemies: ['suriya', 'himawan', 'nakarin', 'phailin'], level: 1.6, from: 'both' },
      { enemies: ['kraisorn', 'adisorn', 'nilrat', 'sroithong'], level: 1.65, from: 'both' },
      { enemies: ['mekhala'], level: 1.9, from: 'right', bannerTh: 'เทพีล่อแก้ว เมขลา', boss: true },
    ],
  },
];

export function getStage(id: string): StageDef {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}
