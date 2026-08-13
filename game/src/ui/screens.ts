/**
 * Menus: title, character select, stage select, pause, results.
 *
 * Immediate-mode: each screen draws itself and reports which control the
 * player touched this frame. No retained widget tree, no DOM — which keeps the
 * menus inside the same letterboxed canvas as the game and makes them work
 * identically under touch, mouse and keyboard.
 */

import { assets } from '../core/assets';
import { clamp } from '../core/math';
import { ROSTER } from '../data/characters';
import { STAGES } from '../data/stages';
import { LOGICAL_H, LOGICAL_W } from '../gfx/renderer';
import { drawFighter, hexA, shade } from '../gfx/rig';
import { getPose } from '../gfx/pose';
import type { CharacterDef, StageDef } from '../sim/types';

const FONT = '"Trebuchet MS", "Noto Sans Thai", system-ui, sans-serif';

export interface Pointer {
  x: number;
  y: number;
  /** True on the frame the tap was released — the click. */
  tapped: boolean;
  /** True while a finger/button is down. */
  down: boolean;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function hit(r: Rect, p: Pointer): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function button(
  ctx: CanvasRenderingContext2D,
  p: Pointer,
  r: Rect,
  label: string,
  opts: { primary?: boolean; disabled?: boolean; small?: boolean } = {},
): boolean {
  const hovered = hit(r, p);
  const active = hovered && p.down;
  ctx.save();
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  if (opts.disabled) {
    g.addColorStop(0, 'rgba(70,78,96,0.5)');
    g.addColorStop(1, 'rgba(40,46,60,0.5)');
  } else if (opts.primary) {
    g.addColorStop(0, active ? '#ffd88a' : '#ffb347');
    g.addColorStop(1, active ? '#ff9a3c' : '#e8722c');
  } else {
    g.addColorStop(0, active ? 'rgba(120,150,210,0.75)' : 'rgba(46,58,86,0.85)');
    g.addColorStop(1, active ? 'rgba(70,96,150,0.75)' : 'rgba(26,32,50,0.85)');
  }
  ctx.fillStyle = g;
  roundRect(ctx, r.x, r.y, r.w, r.h, 9);
  ctx.fill();
  ctx.strokeStyle = opts.disabled
    ? 'rgba(150,160,180,0.25)'
    : hovered
      ? 'rgba(255,240,200,0.9)'
      : 'rgba(180,200,240,0.35)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = opts.disabled ? 'rgba(220,228,244,0.4)' : opts.primary ? '#2a1400' : '#eef3ff';
  ctx.font = `700 ${opts.small ? 14 : 18}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return hovered && p.tapped && !opts.disabled;
}

/** Shared animated menu background so the shell never shows a flat colour. */
export function drawMenuBackdrop(ctx: CanvasRenderingContext2D, time: number, accent = '#ff9a3c'): void {
  const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  g.addColorStop(0, '#0a0d1a');
  g.addColorStop(0.6, '#141a30');
  g.addColorStop(1, '#0d1020');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // Slow diagonal light sweeps.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const x = ((time * (0.3 + i * 0.14) + i * 260) % (LOGICAL_W + 500)) - 250;
    const lg = ctx.createLinearGradient(x, 0, x + 160, LOGICAL_H);
    lg.addColorStop(0, hexA(accent, 0));
    lg.addColorStop(0.5, hexA(accent, 0.06 + i * 0.012));
    lg.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 150, 0);
    ctx.lineTo(x + 40, LOGICAL_H);
    ctx.lineTo(x - 110, LOGICAL_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Vignette.
  const v = ctx.createRadialGradient(LOGICAL_W / 2, LOGICAL_H / 2, 160, LOGICAL_W / 2, LOGICAL_H / 2, 560);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

// ---------------------------------------------------------------------------
// Title
// ---------------------------------------------------------------------------

export type TitleAction = 'start' | 'howto' | 'mute' | null;

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  p: Pointer,
  time: number,
  muted: boolean,
  hasProgress: boolean,
): TitleAction {
  drawMenuBackdrop(ctx, time);

  // Hero silhouettes behind the logo.
  const cast = [ROSTER[0], ROSTER[3], ROSTER[8], ROSTER[13]];
  cast.forEach((c, i) => {
    const x = 150 + i * 220;
    const y = 430 + Math.sin(time * 0.02 + i) * 4;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(x, y);
    ctx.scale(1.8, 1.8);
    drawFighter(ctx, c.look, getPose('intro'), {
      height: c.height * c.look.scale,
      time: time + i * 40,
      outline: 0,
      silhouette: shade(c.look.primary, -0.55),
    });
    ctx.restore();
  });

  ctx.save();
  ctx.textAlign = 'center';
  const cx = LOGICAL_W / 2;
  const bob = Math.sin(time * 0.03) * 3;

  ctx.font = `900 74px ${FONT}`;
  const g = ctx.createLinearGradient(0, 92 + bob, 0, 158 + bob);
  g.addColorStop(0, '#fff6d8');
  g.addColorStop(0.55, '#ffb347');
  g.addColorStop(1, '#e8722c');
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(8,6,14,0.9)';
  ctx.strokeText('ตำนานนักสู้', cx, 150 + bob);
  ctx.fillStyle = g;
  ctx.fillText('ตำนานนักสู้', cx, 150 + bob);

  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = 'rgba(220,232,255,0.8)';
  ctx.fillText('LEGEND FIGHTERS  ·  15 ตัวละคร  ·  10 ด่าน', cx, 186 + bob);
  ctx.restore();

  let action: TitleAction = null;
  if (button(ctx, p, { x: cx - 120, y: 236, w: 240, h: 52 }, hasProgress ? 'เล่นต่อ' : 'เริ่มเกม', { primary: true })) {
    action = 'start';
  }
  if (button(ctx, p, { x: cx - 120, y: 300, w: 240, h: 42 }, 'วิธีเล่น')) action = 'howto';
  if (button(ctx, p, { x: LOGICAL_W - 116, y: 20, w: 96, h: 34 }, muted ? 'เสียง: ปิด' : 'เสียง: เปิด', { small: true })) {
    action = 'mute';
  }
  return action;
}

// ---------------------------------------------------------------------------
// How to play
// ---------------------------------------------------------------------------

export function drawHowTo(ctx: CanvasRenderingContext2D, p: Pointer, time: number): boolean {
  drawMenuBackdrop(ctx, time, '#6fb8ff');
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,26,0.7)';
  roundRect(ctx, 90, 60, LOGICAL_W - 180, 400, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,190,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffd166';
  ctx.font = `900 30px ${FONT}`;
  ctx.fillText('วิธีเล่น', 120, 106);

  const lines: [string, string][] = [
    ['เดิน / ขึ้น-ลง', 'ลากนิ้วซ้ายของจอ (หรือปุ่มลูกศร / WASD) — ขึ้นลงคือเดินเข้า-ออกในความลึกของฉาก'],
    ['วิ่ง', 'แตะทางเดิมสองครั้งเร็ว ๆ (หรือกดลูกศรซ้าย/ขวาสองที)'],
    ['ตี', 'ปุ่ม "ตี" — กดต่อเนื่องเป็นคอมโบ 3 ไม้ ไม้สุดท้ายลอยศัตรู'],
    ['กระโดด', 'ปุ่ม "กระโดด" — กดตีกลางอากาศเพื่อโจมตีลง บางตัวกระโดดซ้ำได้'],
    ['กัน', 'ปุ่ม "กัน" — กันได้เฉพาะด้านหน้า ถ้าโดนอัดจนเกจการ์ดหมดจะการ์ดแตก'],
    ['จับทุ่ม', 'กด "กัน" ค้างแล้วกด "ตี" — จับแล้วกด "กระโดด" เพื่อทุ่ม'],
    ['สกิล', 'ปุ่มกลม 4 ปุ่มด้านขวา — ปุ่มที่ 4 คือท่าไม้ตาย ใช้ MP เยอะแต่พลิกเกมได้'],
    ['ธาตุ', 'ไฟ = ติดไฟเสียเลือดต่อเนื่อง · น้ำแข็ง = แช่แข็ง · พิษ = เสียเลือดยาว ๆ'],
  ];
  ctx.font = `600 15px ${FONT}`;
  lines.forEach(([k, v], i) => {
    const y = 148 + i * 36;
    ctx.fillStyle = '#8fd0ff';
    ctx.fillText(k, 120, y);
    ctx.fillStyle = 'rgba(226,234,250,0.88)';
    ctx.fillText(v, 250, y);
  });
  ctx.restore();

  return button(ctx, p, { x: LOGICAL_W / 2 - 80, y: 476, w: 160, h: 42 }, 'กลับ');
}

// ---------------------------------------------------------------------------
// Character select
// ---------------------------------------------------------------------------

export interface CharSelectResult {
  hovered: number;
  confirmed: boolean;
  back: boolean;
}

export function drawCharSelect(
  ctx: CanvasRenderingContext2D,
  p: Pointer,
  time: number,
  selected: number,
): CharSelectResult {
  const def = ROSTER[clamp(selected, 0, ROSTER.length - 1)];
  drawMenuBackdrop(ctx, time, def.look.aura);

  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#eef3ff';
  ctx.font = `900 26px ${FONT}`;
  ctx.fillText('เลือกตัวละคร', 34, 44);
  ctx.restore();

  // Roster grid on the left: 5 × 3.
  const cols = 5;
  const cell = 72;
  const gap = 8;
  const gx = 34;
  const gy = 66;
  let hovered = selected;

  for (let i = 0; i < ROSTER.length; i++) {
    const c = ROSTER[i];
    const x = gx + (i % cols) * (cell + gap);
    const y = gy + Math.floor(i / cols) * (cell + gap);
    const r: Rect = { x, y, w: cell, h: cell };
    const isSel = i === selected;
    const over = hit(r, p);

    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + cell);
    g.addColorStop(0, shade(c.look.primary, isSel ? 0.2 : -0.25));
    g.addColorStop(1, shade(c.look.secondary, isSel ? 0 : -0.35));
    ctx.fillStyle = g;
    roundRect(ctx, x, y, cell, cell, 8);
    ctx.fill();

    // Portrait: generated art if present, otherwise the rigged fighter.
    // Unselected cells come from a cache — redrawing 15 rigs every frame cost
    // more than the rest of the screen put together.
    const portrait = assets.portrait(c.id);
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, cell, cell, 8);
    ctx.clip();
    if (portrait) {
      ctx.drawImage(portrait, x, y, cell, cell);
    } else if (isSel) {
      ctx.translate(x + cell / 2, y + cell - 6);
      ctx.scale(0.72, 0.72);
      drawFighter(ctx, c.look, getPose('victory'), {
        height: c.height * c.look.scale,
        time: time + i * 30,
        outline: 1.6,
      });
    } else {
      ctx.drawImage(rosterThumb(i, cell), x, y);
    }
    ctx.restore();

    ctx.strokeStyle = isSel ? '#ffd166' : over ? 'rgba(255,255,255,0.6)' : 'rgba(160,180,220,0.3)';
    ctx.lineWidth = isSel ? 3 : 1.6;
    roundRect(ctx, x, y, cell, cell, 8);
    ctx.stroke();

    ctx.fillStyle = 'rgba(6,8,14,0.7)';
    ctx.fillRect(x, y + cell - 16, cell, 16);
    ctx.fillStyle = isSel ? '#ffd166' : 'rgba(230,238,255,0.85)';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(c.nameTh, x + cell / 2, y + cell - 4);
    ctx.restore();

    if (over) hovered = i;
  }

  drawCharDetail(ctx, def, time);

  const confirmed = button(ctx, p, { x: LOGICAL_W - 214, y: LOGICAL_H - 62, w: 180, h: 44 }, 'เลือกตัวนี้', { primary: true });
  const back = button(ctx, p, { x: 34, y: LOGICAL_H - 62, w: 120, h: 44 }, 'กลับ');
  return { hovered, confirmed, back };
}

/** One-off render of a roster fighter, reused every frame after the first. */
const thumbCache = new Map<number, HTMLCanvasElement>();

function rosterThumb(index: number, cell: number): HTMLCanvasElement {
  const cached = thumbCache.get(index);
  if (cached) return cached;
  const c = ROSTER[index];
  const canvas = document.createElement('canvas');
  canvas.width = cell;
  canvas.height = cell;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(cell / 2, cell - 6);
  ctx.scale(0.72, 0.72);
  drawFighter(ctx, c.look, getPose('stand'), {
    height: c.height * c.look.scale,
    time: index * 30,
    outline: 1.6,
  });
  thumbCache.set(index, canvas);
  return canvas;
}

function drawCharDetail(ctx: CanvasRenderingContext2D, c: CharacterDef, time: number): void {
  const x = 430;
  const y = 66;
  const w = LOGICAL_W - x - 34;
  const h = 386;

  ctx.save();
  ctx.fillStyle = 'rgba(10,14,26,0.72)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = hexA(c.look.aura, 0.5);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Big preview, idling.
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 12);
  ctx.clip();
  const glow = ctx.createRadialGradient(x + 96, y + 190, 10, x + 96, y + 190, 170);
  glow.addColorStop(0, hexA(c.look.aura, 0.28));
  glow.addColorStop(1, hexA(c.look.aura, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.translate(x + 96, y + 274);
  ctx.scale(2.5, 2.5);
  const idle = Math.floor(time / 26) % 2 === 0 ? 'stand' : 'stand2';
  drawFighter(ctx, c.look, getPose(idle), {
    height: c.height * c.look.scale,
    time,
    outline: 2.2,
    glow: 0.35,
    glowColor: c.look.aura,
  });
  ctx.restore();

  const tx = x + 196;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 28px ${FONT}`;
  ctx.fillText(c.nameTh, tx, y + 44);
  ctx.fillStyle = hexA(c.look.aura, 0.95);
  ctx.font = `700 15px ${FONT}`;
  ctx.fillText(c.titleTh, tx, y + 66);

  ctx.fillStyle = 'rgba(220,230,248,0.82)';
  ctx.font = `500 12.5px ${FONT}`;
  wrapText(ctx, c.bioTh, tx, y + 90, w - 236, 17, 4);

  // Stat bars — relative, not absolute, so they compare across the roster.
  const stats: [string, number][] = [
    ['พลังชีวิต', (c.hp - 820) / 460],
    ['พลังโจมตี', archetypePower(c)],
    ['ความเร็ว', (c.runSpeed - 4.4) / 2.8],
    ['ระยะ', archetypeRange(c)],
    ['ความยาก', archetypeDifficulty(c)],
  ];
  stats.forEach(([label, v], i) => {
    const sy = y + 168 + i * 20;
    ctx.fillStyle = 'rgba(200,214,240,0.8)';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(label, tx, sy + 9);
    const bx = tx + 74;
    const bw = 150;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, bx, sy, bw, 9, 3);
    ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, hexA(c.look.aura, 0.9));
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    roundRect(ctx, bx, sy, bw * clamp(v, 0.08, 1), 9, 3);
    ctx.fill();
  });

  // Skill list.
  ctx.fillStyle = '#ffd166';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText('สกิล', tx, y + 288);
  c.skills.forEach((id, i) => {
    const act = c.actions[id];
    if (!act) return;
    const sy = y + 306 + i * 20;
    ctx.fillStyle = act.tag === 'super' ? '#ffd166' : hexA(c.look.aura, 0.95);
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText(`${i + 1}. ${act.name ?? id}`, tx, sy);
    ctx.fillStyle = 'rgba(214,224,244,0.75)';
    ctx.font = `500 11.5px ${FONT}`;
    ctx.fillText(act.desc ?? '', tx + 116, sy);
  });
  ctx.restore();
}

function archetypePower(c: CharacterDef): number {
  const map: Record<string, number> = {
    rushdown: 0.6, assassin: 0.92, grappler: 0.86, allrounder: 0.62,
    tank: 0.8, technical: 0.58, zoner: 0.55,
  };
  return map[c.archetype] ?? 0.6;
}

function archetypeRange(c: CharacterDef): number {
  const map: Record<string, number> = {
    rushdown: 0.25, assassin: 0.3, grappler: 0.12, allrounder: 0.5,
    tank: 0.35, technical: 0.68, zoner: 0.96,
  };
  return map[c.archetype] ?? 0.5;
}

function archetypeDifficulty(c: CharacterDef): number {
  const map: Record<string, number> = {
    allrounder: 0.25, tank: 0.35, rushdown: 0.5, zoner: 0.6,
    grappler: 0.7, technical: 0.8, assassin: 0.9,
  };
  return map[c.archetype] ?? 0.5;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
  maxLines: number,
): void {
  // Thai does not use spaces between words, so wrap by measured character run
  // rather than by whitespace.
  let line = '';
  let lines = 0;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line.length > 0) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      if (lines >= maxLines) return;
      line = ch;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

// ---------------------------------------------------------------------------
// Stage select
// ---------------------------------------------------------------------------

export interface StageSelectResult {
  picked: number;
  back: boolean;
}

export function drawStageSelect(
  ctx: CanvasRenderingContext2D,
  p: Pointer,
  time: number,
  unlocked: number,
  bestScores: number[],
): StageSelectResult {
  drawMenuBackdrop(ctx, time, '#6fd0ff');
  ctx.save();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#eef3ff';
  ctx.font = `900 26px ${FONT}`;
  ctx.fillText('เลือกด่าน', 34, 44);
  ctx.restore();

  let picked = -1;
  const cols = 5;
  const cw = 168;
  const chh = 168;
  const gap = 14;
  const gx = (LOGICAL_W - (cols * cw + (cols - 1) * gap)) / 2;
  const gy = 70;

  STAGES.forEach((s, i) => {
    const x = gx + (i % cols) * (cw + gap);
    const y = gy + Math.floor(i / cols) * (chh + gap);
    const locked = i > unlocked;
    const r: Rect = { x, y, w: cw, h: chh };
    const over = hit(r, p) && !locked;

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, cw, chh, 10);
    ctx.clip();
    drawStageThumb(ctx, s, x, y, cw, chh, time + i * 60);
    if (locked) {
      ctx.fillStyle = 'rgba(6,8,14,0.75)';
      ctx.fillRect(x, y, cw, chh);
    }
    ctx.fillStyle = 'rgba(6,8,14,0.72)';
    ctx.fillRect(x, y + chh - 42, cw, 42);
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = locked ? 'rgba(200,210,230,0.5)' : '#ffffff';
    ctx.font = `700 14px ${FONT}`;
    ctx.fillText(locked ? 'ยังไม่ปลดล็อก' : s.nameTh, x + 10, y + chh - 22);
    ctx.font = `500 11px ${FONT}`;
    ctx.fillStyle = 'rgba(200,214,240,0.7)';
    ctx.fillText(`ด่าน ${i + 1}${bestScores[i] ? `  ·  ${bestScores[i].toLocaleString('en-US')}` : ''}`, x + 10, y + chh - 8);

    ctx.strokeStyle = over ? '#ffd166' : 'rgba(150,175,220,0.32)';
    ctx.lineWidth = over ? 3 : 1.6;
    roundRect(ctx, x, y, cw, chh, 10);
    ctx.stroke();
    ctx.restore();

    if (over && p.tapped) picked = i;
  });

  const back = button(ctx, p, { x: 34, y: LOGICAL_H - 56, w: 120, h: 40 }, 'กลับ');
  return { picked, back };
}

/** Miniature of the stage palette so each card reads as a distinct place. */
function drawStageThumb(
  ctx: CanvasRenderingContext2D,
  s: StageDef,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const pal = s.palette;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(0.65, pal.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  const sunX = x + w * 0.68;
  const sunY = y + h * 0.32;
  const sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.5);
  sg.addColorStop(0, hexA(pal.sun, 0.6));
  sg.addColorStop(1, hexA(pal.sun, 0));
  ctx.fillStyle = sg;
  ctx.fillRect(x, y, w, h);

  // Two silhouette bands, offset by a per-stage phase.
  const phase = s.id.charCodeAt(0);
  ctx.fillStyle = hexA(shade(pal.fog, -0.35), 0.9);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i <= 8; i++) {
    const px = x + (i / 8) * w;
    const py = y + h * 0.66 + Math.sin(i * 1.7 + phase) * h * 0.08;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.ground;
  ctx.fillRect(x, y + h * 0.78, w, h * 0.22);

  // Weather hint.
  ctx.fillStyle = hexA(pal.ambient, 0.5);
  for (let i = 0; i < 12; i++) {
    const px = x + ((i * 53 + time * 0.6) % w);
    const py = y + ((i * 37 + time * 0.9) % (h * 0.78));
    ctx.fillRect(px, py, 1.6, s.weather === 'rain' ? 6 : 1.6);
  }
}

// ---------------------------------------------------------------------------
// Pause / results
// ---------------------------------------------------------------------------

export type PauseAction = 'resume' | 'restart' | 'quit' | null;

export function drawPause(ctx: CanvasRenderingContext2D, p: Pointer): PauseAction {
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,16,0.72)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 40px ${FONT}`;
  ctx.fillText('พักเกม', LOGICAL_W / 2, 150);
  ctx.restore();

  const cx = LOGICAL_W / 2;
  if (button(ctx, p, { x: cx - 110, y: 200, w: 220, h: 46 }, 'เล่นต่อ', { primary: true })) return 'resume';
  if (button(ctx, p, { x: cx - 110, y: 258, w: 220, h: 42 }, 'เริ่มด่านใหม่')) return 'restart';
  if (button(ctx, p, { x: cx - 110, y: 310, w: 220, h: 42 }, 'ออกไปเมนู')) return 'quit';
  return null;
}

export interface ResultsInfo {
  won: boolean;
  stage: StageDef;
  score: number;
  bestCombo: number;
  kos: number;
  timeSec: number;
  isLastStage: boolean;
}

export type ResultsAction = 'next' | 'retry' | 'quit' | null;

export function drawResults(
  ctx: CanvasRenderingContext2D,
  p: Pointer,
  time: number,
  info: ResultsInfo,
): ResultsAction {
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,16,0.82)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.textAlign = 'center';
  const cx = LOGICAL_W / 2;

  const g = ctx.createLinearGradient(0, 70, 0, 120);
  if (info.won) {
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(1, '#ffb347');
  } else {
    g.addColorStop(0, '#ffb0b0');
    g.addColorStop(1, '#d84a4a');
  }
  ctx.font = `900 54px ${FONT}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(8,6,14,0.9)';
  const title = info.won ? (info.isLastStage ? 'จบเกม!' : 'ผ่านด่าน!') : 'แพ้แล้ว';
  ctx.strokeText(title, cx, 116 + Math.sin(time * 0.05) * 2);
  ctx.fillStyle = g;
  ctx.fillText(title, cx, 116 + Math.sin(time * 0.05) * 2);

  ctx.font = `700 17px ${FONT}`;
  ctx.fillStyle = 'rgba(226,234,250,0.85)';
  ctx.fillText(info.stage.nameTh, cx, 148);

  const rows: [string, string][] = [
    ['คะแนน', info.score.toLocaleString('en-US')],
    ['คอมโบสูงสุด', `${info.bestCombo} ครั้ง`],
    ['น็อกเอาต์', `${info.kos} ตัว`],
    ['เวลา', `${Math.floor(info.timeSec / 60)}:${String(Math.floor(info.timeSec % 60)).padStart(2, '0')}`],
  ];
  rows.forEach(([k, v], i) => {
    const y = 200 + i * 34;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(190,206,236,0.85)';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(k, cx - 16, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd166';
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(v, cx + 16, y);
  });
  ctx.restore();

  if (info.won && !info.isLastStage) {
    if (button(ctx, p, { x: cx - 190, y: 366, w: 180, h: 46 }, 'ด่านต่อไป', { primary: true })) return 'next';
    if (button(ctx, p, { x: cx + 10, y: 366, w: 180, h: 46 }, 'เล่นซ้ำ')) return 'retry';
  } else {
    if (button(ctx, p, { x: cx - 190, y: 366, w: 180, h: 46 }, 'ลองใหม่', { primary: true })) return 'retry';
    if (button(ctx, p, { x: cx + 10, y: 366, w: 180, h: 46 }, 'เลือกด่าน')) return 'quit';
  }
  if (button(ctx, p, { x: cx - 90, y: 424, w: 180, h: 38 }, 'ออกไปเมนู', { small: true })) return 'quit';
  return null;
}

/** Orientation nag shown when a phone is held upright. */
export function drawRotateHint(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.fillStyle = '#080b14';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.translate(LOGICAL_W / 2, LOGICAL_H / 2 - 30);
  ctx.rotate(Math.sin(time * 0.04) * 0.35 - 0.35);
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 5;
  roundRect(ctx, -46, -78, 92, 156, 12);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText('หมุนเครื่องเป็นแนวนอน', LOGICAL_W / 2, LOGICAL_H / 2 + 110);
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = 'rgba(210,222,244,0.75)';
  ctx.fillText('เกมนี้ออกแบบมาให้เล่นแนวนอนเท่านั้น', LOGICAL_W / 2, LOGICAL_H / 2 + 138);
  ctx.restore();
}
