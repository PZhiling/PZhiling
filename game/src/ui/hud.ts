/**
 * In-game HUD and the on-screen gamepad.
 *
 * Drawn in logical 960×540 space on top of the scene. The control pad is drawn
 * here rather than as DOM overlays so it survives fullscreen, orientation
 * changes and the letterbox transform without a second layout system.
 */

import { clamp } from '../core/math';
import type { TouchSource } from '../core/input';
import type { Fighter } from '../sim/types';
import type { World } from '../sim/world';
import { hexA } from '../gfx/rig';
import { LOGICAL_H, LOGICAL_W } from '../gfx/renderer';

const FONT = '"Trebuchet MS", "Noto Sans Thai", system-ui, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHud(ctx: CanvasRenderingContext2D, world: World, showTouch: boolean, touch: TouchSource | null, fps: number): void {
  const players = world.players();

  players.forEach((p, i) => drawPlayerPanel(ctx, p, 14, 12 + i * 62));
  drawWaveInfo(ctx, world);
  drawCombo(ctx, world, players[0]);
  drawBanner(ctx, world);

  if (showTouch && touch) drawTouchPad(ctx, world, touch, players[0]);
  if (fps > 0) drawFps(ctx, fps);
}

function drawPlayerPanel(ctx: CanvasRenderingContext2D, f: Fighter, x: number, y: number): void {
  const w = 250;
  ctx.save();

  // Portrait medallion — a colour chip of the character, so the panel is
  // identifiable at a glance even before art exists.
  ctx.fillStyle = 'rgba(8,10,18,0.62)';
  roundRect(ctx, x, y, w, 52, 8);
  ctx.fill();
  ctx.strokeStyle = hexA(f.def.look.aura, 0.5);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const px = x + 26;
  const py = y + 26;
  const g = ctx.createRadialGradient(px, py, 2, px, py, 20);
  g.addColorStop(0, f.def.look.primary);
  g.addColorStop(1, f.def.look.secondary);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = f.def.look.trim;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `700 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f2f4fa';
  ctx.fillText(f.def.nameTh, x + 52, y + 17);

  // HP with a trailing ghost bar.
  const barX = x + 52;
  const barW = w - 64;
  const hpFrac = clamp(f.hp / f.hpMax, 0, 1);
  const ghostFrac = clamp(f.hpGhost / f.hpMax, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, barX, y + 22, barW, 10, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,90,90,0.55)';
  roundRect(ctx, barX, y + 22, barW * ghostFrac, 10, 3);
  ctx.fill();
  const hpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  hpGrad.addColorStop(0, hpFrac > 0.3 ? '#3ddc84' : '#ff6b6b');
  hpGrad.addColorStop(1, hpFrac > 0.3 ? '#9be15d' : '#ffa06b');
  ctx.fillStyle = hpGrad;
  roundRect(ctx, barX, y + 22, barW * hpFrac, 10, 3);
  ctx.fill();

  // MP.
  const mpFrac = clamp(f.mp / f.mpMax, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, barX, y + 35, barW, 7, 3);
  ctx.fill();
  const mpGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  mpGrad.addColorStop(0, '#3a7bd5');
  mpGrad.addColorStop(1, '#6fd0ff');
  ctx.fillStyle = mpGrad;
  roundRect(ctx, barX, y + 35, barW * mpFrac, 7, 3);
  ctx.fill();

  // Lives.
  for (let i = 0; i < f.lives; i++) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + 12 + i * 11, y + 47, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Status icons.
  let sx = barX;
  const status: [number, string][] = [
    [f.burn, '#ff8a3c'],
    [f.freeze, '#9fdcff'],
    [f.poison, '#a8e05a'],
    [f.shock, '#cfe8ff'],
  ];
  for (const [t, color] of status) {
    if (t <= 0) continue;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx + 4, y + 48, 3.2, 0, Math.PI * 2);
    ctx.fill();
    sx += 11;
  }

  ctx.restore();
}

function drawWaveInfo(ctx: CanvasRenderingContext2D, world: World): void {
  const total = world.stage.waves.length;
  const cur = Math.min(world.waveIndex + 1, total);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `700 13px ${FONT}`;
  ctx.fillStyle = 'rgba(8,10,18,0.55)';
  roundRect(ctx, LOGICAL_W / 2 - 92, 12, 184, 26, 7);
  ctx.fill();
  ctx.fillStyle = '#e8ecf6';
  ctx.fillText(`${world.stage.nameTh}  ·  ระลอก ${cur}/${total}`, LOGICAL_W / 2, 29);

  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'right';
  ctx.fillText(`คะแนน ${world.score.toLocaleString('en-US')}`, LOGICAL_W - 58, 29);
  ctx.restore();
}

function drawCombo(ctx: CanvasRenderingContext2D, world: World, player: Fighter | undefined): void {
  if (!player || player.comboCount < 2) return;
  const t = clamp(player.comboTimer / 90, 0, 1);
  const pop = clamp((90 - player.comboTimer) / 8, 0, 1);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.globalAlpha = clamp(t * 2, 0, 1);
  const x = 30;
  const y = 168;
  const size = 40 + (1 - pop) * 16;
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(8,6,14,0.85)';
  ctx.strokeText(String(player.comboCount), x, y);
  const g = ctx.createLinearGradient(x, y - size, x, y);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = g;
  ctx.fillText(String(player.comboCount), x, y);
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = '#ffd166';
  ctx.fillText('HIT', x + ctx.measureText(String(player.comboCount)).width + 44, y - 4);
  ctx.restore();
  void world;
}

function drawBanner(ctx: CanvasRenderingContext2D, world: World): void {
  if (world.bannerTimer <= 0 || !world.bannerText) return;
  const t = world.bannerTimer;
  // Slide in, hold, slide out — never a hard cut.
  const alpha = clamp(Math.min(t / 20, (140 - t) / 12), 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  const y = 132;
  ctx.fillStyle = 'rgba(6,8,16,0.55)';
  ctx.fillRect(0, y - 34, LOGICAL_W, 56);
  const g = ctx.createLinearGradient(0, y - 30, 0, y + 10);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#ffc24d');
  ctx.font = `900 34px ${FONT}`;
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(8,6,14,0.9)';
  ctx.strokeText(world.bannerText, LOGICAL_W / 2, y);
  ctx.fillStyle = g;
  ctx.fillText(world.bannerText, LOGICAL_W / 2, y);
  ctx.restore();
}

function drawFps(ctx: CanvasRenderingContext2D, fps: number): void {
  ctx.save();
  ctx.font = `600 11px ${FONT}`;
  ctx.fillStyle = fps < 45 ? '#ff8a8a' : 'rgba(220,230,245,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(fps)} fps`, 14, LOGICAL_H - 10);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Touch pad
// ---------------------------------------------------------------------------

const BUTTON_LABEL: Record<string, string> = {
  attack: 'ตี',
  jump: 'กระโดด',
  defend: 'กัน',
};

export function drawTouchPad(
  ctx: CanvasRenderingContext2D,
  world: World,
  touch: TouchSource,
  player: Fighter | undefined,
): void {
  ctx.save();
  ctx.globalAlpha = 0.9;

  // Stick.
  const st = touch.layout.stick;
  const cx = touch.stickActive ? touch.stickOriginX : st.x;
  const cy = touch.stickActive ? touch.stickOriginY : st.y;
  ctx.strokeStyle = 'rgba(230,238,255,0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, st.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(10,14,24,0.28)';
  ctx.fill();
  const tx = cx + touch.stickX * st.r * 0.66;
  const ty = cy + touch.stickY * st.r * 0.66;
  const g = ctx.createRadialGradient(tx, ty, 2, tx, ty, 24);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(150,190,255,0.25)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(tx, ty, 22, 0, Math.PI * 2);
  ctx.fill();

  for (const b of touch.layout.buttons) {
    if (b.id === 'pause') {
      drawPauseButton(ctx, b.x, b.y, b.r);
      continue;
    }
    const lit = touch.lit.has(b.id);
    if (b.id.startsWith('skill')) {
      drawSkillButton(ctx, world, b, lit, player);
    } else {
      drawActionButton(ctx, b.x, b.y, b.r, BUTTON_LABEL[b.id] ?? b.id, lit);
    }
  }

  ctx.restore();
}

function drawActionButton(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, label: string, lit: boolean): void {
  const g = ctx.createRadialGradient(x, y - r * 0.3, 2, x, y, r);
  g.addColorStop(0, lit ? 'rgba(255,240,200,0.95)' : 'rgba(240,246,255,0.34)');
  g.addColorStop(1, lit ? 'rgba(255,160,60,0.7)' : 'rgba(120,150,200,0.16)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = lit ? 'rgba(255,220,150,0.95)' : 'rgba(230,238,255,0.42)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = lit ? '#231404' : 'rgba(240,246,255,0.9)';
  ctx.font = `700 ${Math.round(r * 0.42)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);
  ctx.textBaseline = 'alphabetic';
}

function drawSkillButton(
  ctx: CanvasRenderingContext2D,
  world: World,
  b: { id: string; x: number; y: number; r: number },
  lit: boolean,
  player: Fighter | undefined,
): void {
  const idx = Number(b.id.slice(5));
  const skillId = player?.def.skills[idx];
  const act = skillId ? player?.def.actions[skillId] : undefined;
  const cd = skillId ? (player?.cooldowns[skillId] ?? 0) : 0;
  const cost = act?.mpCost ?? 0;
  const ready = !!player && cd <= 0 && player.mp >= cost;
  const aura = player?.def.look.aura ?? '#8fb8ff';
  const isSuper = act?.tag === 'super';

  const g = ctx.createRadialGradient(b.x, b.y - b.r * 0.3, 2, b.x, b.y, b.r);
  if (lit) {
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, hexA(aura, 0.85));
  } else if (ready) {
    g.addColorStop(0, hexA(aura, 0.6));
    g.addColorStop(1, hexA(aura, 0.2));
  } else {
    g.addColorStop(0, 'rgba(120,130,150,0.3)');
    g.addColorStop(1, 'rgba(60,70,90,0.15)');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = ready ? hexA(isSuper ? '#ffd166' : aura, 0.95) : 'rgba(200,210,230,0.3)';
  ctx.lineWidth = isSuper ? 2.8 : 2;
  ctx.stroke();

  // Cooldown sweep.
  if (cd > 0 && act?.cooldown) {
    ctx.fillStyle = 'rgba(10,12,20,0.6)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + (cd / act.cooldown) * Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }

  // Short label: the move name is too long for a 54px circle, so use the
  // first syllable plus the slot number.
  const name = act?.name ?? `สกิล ${idx + 1}`;
  ctx.fillStyle = ready ? '#0d1020' : 'rgba(220,228,244,0.65)';
  ctx.font = `700 ${isSuper ? 12 : 11}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.length > 6 ? name.slice(0, 6) : name, b.x, b.y);
  ctx.textBaseline = 'alphabetic';

  if (isSuper && ready) {
    // Pulsing ring so the finisher is obviously available.
    const pulse = 0.5 + Math.sin(world.tick * 0.12) * 0.5;
    ctx.strokeStyle = hexA('#ffd166', 0.35 + pulse * 0.45);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 3 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPauseButton(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(10,14,24,0.45)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,238,255,0.45)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(235,242,255,0.9)';
  ctx.fillRect(x - 5, y - 6, 3.5, 12);
  ctx.fillRect(x + 1.5, y - 6, 3.5, 12);
}
