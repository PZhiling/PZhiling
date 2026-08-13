/**
 * Procedural fighter renderer.
 *
 * Draws a fighter from a `Look` (proportions + palette) and a `Pose` (joint
 * angles). No sprite sheets required — which is what lets 15 characters ship
 * before a single image is generated, and what keeps the animation smooth
 * (poses interpolate; sprite frames cannot).
 *
 * Local space: origin at the feet, +x is forward and +y is screen-down (so the
 * head sits at a negative y). The caller sets up the transform, so facing is a
 * mirror and everything below can assume the fighter faces right.
 */

import { DEG } from '../core/math';
import type { Look } from '../sim/types';
import type { Pose } from './pose';

export interface RigOptions {
  /** Body height in world units. */
  height: number;
  /** Multiplied over every fill — stage ambient light and status tints. */
  tint?: string;
  tintStrength?: number;
  alpha?: number;
  /** Draws the fighter as a flat silhouette (after-images, shadows). */
  silhouette?: string | null;
  /** Outline weight; 0 disables the dark keyline. */
  outline?: number;
  /** Animation clock, for cloth and hair sway. */
  time: number;
  /** Extra glow around the body — charging, supers, auras. */
  glow?: number;
  glowColor?: string;
  /** Freeze/burn overlays. */
  frozen?: number;
  burning?: number;
}

interface Ctx2 {
  ctx: CanvasRenderingContext2D;
  H: number;
  o: RigOptions;
  look: Look;
}

/**
 * Bone tip from a start point, an absolute angle and a length.
 *
 * Angle 0 points straight down (limbs hang), positive rotates forward toward
 * +x. Local +y is screen-down, which is why cos is added rather than
 * subtracted.
 */
function tip(x: number, y: number, angDeg: number, len: number): [number, number] {
  const a = angDeg * DEG;
  return [x + Math.sin(a) * len, y + Math.cos(a) * len];
}

/** Same, but for parts that grow upward from a joint (neck, head, hair). */
function upTip(x: number, y: number, leanDeg: number, len: number): [number, number] {
  const a = leanDeg * DEG;
  return [x + Math.sin(a) * len, y - Math.cos(a) * len];
}

function strokeBone(
  c: Ctx2,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  color: string,
): void {
  const { ctx, o } = c;
  if (o.outline) {
    ctx.strokeStyle = 'rgba(12,10,18,0.85)';
    ctx.lineWidth = w + o.outline;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.strokeStyle = o.silhouette ?? color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Two-segment limb (upper + lower). Returns the end point. */
function limb(
  c: Ctx2,
  x: number,
  y: number,
  a1: number,
  len1: number,
  a2: number,
  len2: number,
  w1: number,
  w2: number,
  color: string,
  colorLower: string,
): [number, number] {
  const [mx, my] = tip(x, y, a1, len1);
  const [ex, ey] = tip(mx, my, a1 + a2, len2);
  strokeBone(c, x, y, mx, my, w1, color);
  strokeBone(c, mx, my, ex, ey, w2, colorLower);
  return [ex, ey];
}

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((s) => s + s).join('') : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function drawFighter(
  ctx: CanvasRenderingContext2D,
  look: Look,
  pose: Pose,
  opts: RigOptions,
): void {
  const H = opts.height;
  const c: Ctx2 = { ctx, H, o: opts, look };
  const t = opts.time;

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Whole-body transform: root offset, squash/stretch, spin about the hips.
  ctx.translate(pose.rx * H, -pose.ry * H);
  ctx.scale(pose.sx, pose.sy);
  const hipY = -H * (0.46 - pose.crouch * 0.14);
  if (pose.spin !== 0) {
    ctx.translate(0, hipY);
    ctx.rotate(pose.spin * DEG);
    ctx.translate(0, -hipY);
  }

  // ---- proportions -------------------------------------------------------
  const build = look.build;
  const hip = { x: 0, y: hipY };
  const shoulderY = -H * (0.76 - pose.crouch * 0.2);
  const torsoLean = pose.lean * DEG;
  const shoulderX = Math.sin(torsoLean) * (shoulderY - hip.y) * -1;
  const sh = { x: hip.x + shoulderX, y: shoulderY };

  const armW = H * 0.075 * build;
  const legW = H * 0.09 * build;
  const upperArm = H * 0.2;
  const foreArm = H * 0.19;
  const thigh = H * 0.25;
  const shin = H * 0.24;
  const shoulderHalf = H * 0.15 * build;

  const skin = look.skin;
  const skinDark = shade(skin, -0.22);
  const prim = look.primary;
  const sec = look.secondary;
  const primDark = shade(prim, -0.3);

  // ---- aura glow (behind everything) -------------------------------------
  if (opts.glow && opts.glow > 0) {
    const g = ctx.createRadialGradient(0, -H * 0.5, H * 0.1, 0, -H * 0.5, H * 0.95);
    const col = opts.glowColor ?? look.aura;
    g.addColorStop(0, hexA(col, 0.55 * opts.glow));
    g.addColorStop(0.55, hexA(col, 0.2 * opts.glow));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -H * 0.5, H * 0.95, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- cape (behind the body) --------------------------------------------
  if (look.cape && !opts.silhouette) {
    const sway = Math.sin(t * 0.06) * H * 0.05;
    const sway2 = Math.cos(t * 0.05) * H * 0.03;
    ctx.fillStyle = shade(look.cape, -0.12);
    ctx.beginPath();
    ctx.moveTo(sh.x - shoulderHalf * 0.85, sh.y - H * 0.02);
    ctx.quadraticCurveTo(-H * 0.2 + sway, -H * 0.5, -H * 0.19 + sway2, -H * 0.1);
    ctx.quadraticCurveTo(-H * 0.1, -H * 0.14, -H * 0.02, hip.y + H * 0.04);
    ctx.lineTo(sh.x - shoulderHalf * 0.05, sh.y - H * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(12,10,18,0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ---- far limbs ---------------------------------------------------------
  const farShade = -0.3;
  const farFoot = limb(c, hip.x - H * 0.045, hip.y, pose.legFar[0], thigh, pose.legFar[1], shin,
    legW, legW * 0.82, shade(sec, farShade), shade(sec, farShade - 0.08));
  const farHand = limb(c, sh.x - shoulderHalf * 0.45, sh.y, pose.armFar[0], upperArm, pose.armFar[1], foreArm,
    armW, armW * 0.86, shade(prim, farShade), shade(skin, farShade));
  drawFoot(c, farFoot[0], farFoot[1], pose.legFar[0] + pose.legFar[1], H, shade(look.trim, -0.45));
  drawHand(c, farHand[0], farHand[1], armW * 0.62, shade(skin, farShade));

  // ---- torso -------------------------------------------------------------
  ctx.save();
  const torsoGrad = ctx.createLinearGradient(-shoulderHalf, sh.y, shoulderHalf, hip.y);
  torsoGrad.addColorStop(0, opts.silhouette ?? shade(prim, 0.1));
  torsoGrad.addColorStop(1, opts.silhouette ?? primDark);
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.moveTo(sh.x - shoulderHalf, sh.y);
  ctx.quadraticCurveTo(sh.x, sh.y - H * 0.05, sh.x + shoulderHalf, sh.y);
  ctx.quadraticCurveTo(sh.x + shoulderHalf * 0.9, hip.y + H * 0.1, hip.x + H * 0.1 * build, hip.y);
  ctx.lineTo(hip.x - H * 0.1 * build, hip.y);
  ctx.quadraticCurveTo(sh.x - shoulderHalf * 0.9, hip.y + H * 0.1, sh.x - shoulderHalf, sh.y);
  ctx.closePath();
  if (opts.outline) {
    ctx.strokeStyle = 'rgba(12,10,18,0.85)';
    ctx.lineWidth = opts.outline;
    ctx.stroke();
  }
  ctx.fill();

  // Sash / trim across the chest — the cheapest way to make silhouettes
  // distinguishable at a glance.
  if (!opts.silhouette) {
    ctx.strokeStyle = look.trim;
    ctx.lineWidth = H * 0.035;
    ctx.beginPath();
    ctx.moveTo(sh.x - shoulderHalf * 0.85, sh.y - H * 0.01);
    ctx.lineTo(hip.x + H * 0.09 * build, hip.y + H * 0.03);
    ctx.stroke();
    ctx.fillStyle = look.trim;
    ctx.fillRect(hip.x - H * 0.11 * build, hip.y - H * 0.005, H * 0.22 * build, H * 0.035);
  }
  ctx.restore();

  // ---- head --------------------------------------------------------------
  const neck = upTip(sh.x, sh.y, pose.lean, H * 0.06);
  const headR = H * 0.115;
  const headAng = pose.lean + pose.head;
  const [hx, hy] = upTip(neck[0], neck[1], headAng, headR * 0.95);

  drawHair(c, hx, hy, headR, headAng, true);

  ctx.fillStyle = opts.silhouette ?? skin;
  if (opts.outline) {
    ctx.strokeStyle = 'rgba(12,10,18,0.85)';
    ctx.lineWidth = opts.outline;
  }
  ctx.beginPath();
  ctx.ellipse(hx, hy, headR * 0.86, headR, headAng * DEG, 0, Math.PI * 2);
  if (opts.outline) ctx.stroke();
  ctx.fill();

  if (!opts.silhouette) {
    // Face: a single eye mark plus a jaw shadow reads at 60px tall better than
    // any attempt at detail.
    ctx.fillStyle = 'rgba(20,14,24,0.85)';
    const ex = hx + headR * 0.44;
    const ey = hy - headR * 0.06;
    ctx.beginPath();
    ctx.ellipse(ex, ey, headR * 0.17, headR * 0.11, headAng * DEG, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexA(skinDark, 0.55);
    ctx.beginPath();
    ctx.ellipse(hx - headR * 0.1, hy + headR * 0.45, headR * 0.6, headR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHair(c, hx, hy, headR, headAng, false);

  // ---- near limbs --------------------------------------------------------
  const nearFoot = limb(c, hip.x + H * 0.045, hip.y, pose.legNear[0], thigh, pose.legNear[1], shin,
    legW * 1.04, legW * 0.86, sec, shade(sec, -0.1));
  const nearHand = limb(c, sh.x + shoulderHalf * 0.45, sh.y, pose.armNear[0], upperArm, pose.armNear[1], foreArm,
    armW * 1.04, armW * 0.9, prim, skin);
  drawFoot(c, nearFoot[0], nearFoot[1], pose.legNear[0] + pose.legNear[1], H, shade(look.trim, -0.3));
  drawHand(c, nearHand[0], nearHand[1], armW * 0.66, skin);

  // ---- weapon in the lead hand -------------------------------------------
  if (look.weapon && look.weapon !== 'none' && !opts.silhouette) {
    const handAngle = pose.armNear[0] + pose.armNear[1] + pose.wpn;
    drawWeapon(c, nearHand[0], nearHand[1], handAngle, look.weapon);
  }

  // ---- status overlays ---------------------------------------------------
  if (opts.frozen && opts.frozen > 0) {
    ctx.globalAlpha = (opts.alpha ?? 1) * 0.55;
    ctx.fillStyle = 'rgba(150,220,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(-H * 0.2, 0);
    ctx.lineTo(-H * 0.24, -H * 0.55);
    ctx.lineTo(-H * 0.06, -H * 0.95);
    ctx.lineTo(H * 0.1, -H * 1.0);
    ctx.lineTo(H * 0.25, -H * 0.5);
    ctx.lineTo(H * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,250,255,0.9)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.globalAlpha = opts.alpha ?? 1;
  }

  ctx.restore();
}

/** A fist at the end of an arm — small, but it is what stops the rig reading
 *  as a stick figure. */
function drawHand(c: Ctx2, x: number, y: number, r: number, color: string): void {
  const { ctx, o } = c;
  ctx.fillStyle = o.silhouette ?? color;
  if (o.outline) {
    ctx.strokeStyle = 'rgba(12,10,18,0.85)';
    ctx.lineWidth = o.outline * 0.8;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (o.outline) ctx.stroke();
  ctx.fill();
}

/** A boot, rotated to follow the shin and always flat-ish to the floor. */
function drawFoot(c: Ctx2, x: number, y: number, angDeg: number, H: number, color: string): void {
  const { ctx, o } = c;
  ctx.save();
  ctx.translate(x, y);
  // Blend the shin angle toward horizontal so a planted foot lies flat.
  ctx.rotate(angDeg * DEG * 0.35);
  ctx.fillStyle = o.silhouette ?? color;
  if (o.outline) {
    ctx.strokeStyle = 'rgba(12,10,18,0.85)';
    ctx.lineWidth = o.outline * 0.8;
  }
  ctx.beginPath();
  ctx.ellipse(H * 0.018, H * 0.012, H * 0.06, H * 0.028, 0, 0, Math.PI * 2);
  if (o.outline) ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function drawHair(c: Ctx2, hx: number, hy: number, r: number, ang: number, back: boolean): void {
  const { ctx, o, look } = c;
  const col = o.silhouette ?? look.hair;
  const style = look.hairStyle;
  const t = o.time;

  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';

  if (back) {
    // Long styles need mass behind the head.
    if (style === 'long' || style === 'braid' || style === 'pony') {
      const sway = Math.sin(t * 0.05) * r * 0.35;
      ctx.beginPath();
      ctx.moveTo(hx - r * 0.2, hy - r * 0.4);
      ctx.quadraticCurveTo(hx - r * 1.5 + sway, hy + r * 0.6, hx - r * (style === 'pony' ? 1.1 : 0.9) + sway, hy + r * (style === 'long' ? 3.4 : 2.4));
      ctx.quadraticCurveTo(hx - r * 0.2, hy + r * 1.6, hx + r * 0.35, hy);
      ctx.closePath();
      ctx.fill();
    }
    if (style === 'hood') {
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.35, hy + r * 0.9);
      ctx.quadraticCurveTo(hx - r * 1.2, hy - r * 1.7, hx + r * 0.4, hy - r * 1.5);
      ctx.quadraticCurveTo(hx + r * 1.3, hy - r * 0.9, hx + r * 1.0, hy + r * 0.9);
      ctx.closePath();
      ctx.fillStyle = o.silhouette ?? look.secondary;
      ctx.fill();
    }
    return;
  }

  switch (style) {
    case 'bald':
      break;
    case 'spiky': {
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 26;
        const [sx, sy] = upTip(hx, hy, a, r * 0.9);
        const [tx2, ty2] = upTip(hx, hy, a + (i < 0 ? -12 : 12), r * 1.85);
        ctx.moveTo(hx, hy);
        ctx.lineTo(sx, sy);
        ctx.lineTo(tx2, ty2);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'topknot': {
      ctx.beginPath();
      ctx.arc(hx - r * 0.1, hy - r * 0.55, r * 0.85, Math.PI * 0.95, Math.PI * 2.15);
      ctx.fill();
      const [kx, ky] = upTip(hx, hy, ang - 6, r * 1.5);
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 0.42, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'hood':
      break;
    default: {
      ctx.beginPath();
      ctx.arc(hx - r * 0.05, hy - r * 0.35, r * 0.95, Math.PI * 0.92, Math.PI * 2.2);
      ctx.fill();
      break;
    }
  }
}

function drawWeapon(c: Ctx2, x: number, y: number, ang: number, kind: Look['weapon']): void {
  const { ctx, H, look } = c;
  const steel = '#dce4f0';
  const steelDark = '#8d97a8';
  ctx.save();
  ctx.translate(x, y);
  // Weapons are authored pointing up (-y); rotating by 180 - ang aligns that
  // with the bone direction, where angle 0 hangs straight down.
  ctx.rotate((180 - ang) * DEG);

  const outline = (path: () => void, fill: string) => {
    ctx.strokeStyle = 'rgba(12,10,18,0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    path();
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  switch (kind) {
    case 'sword': {
      const L = H * 0.54;
      outline(() => {
        ctx.moveTo(-H * 0.03, 0);
        ctx.lineTo(H * 0.03, 0);
        ctx.lineTo(H * 0.022, -L * 0.92);
        ctx.lineTo(0, -L);
        ctx.lineTo(-H * 0.022, -L * 0.92);
      }, steel);
      ctx.fillStyle = look.trim;
      ctx.fillRect(-H * 0.07, -H * 0.02, H * 0.14, H * 0.035);
      break;
    }
    case 'blade': {
      const L = H * 0.42;
      outline(() => {
        ctx.moveTo(-H * 0.022, 0);
        ctx.lineTo(H * 0.026, -L * 0.2);
        ctx.lineTo(H * 0.012, -L);
        ctx.lineTo(-H * 0.02, -L * 0.85);
      }, steel);
      break;
    }
    case 'staff': {
      const L = H * 0.86;
      ctx.strokeStyle = '#6b4a2c';
      ctx.lineWidth = H * 0.035;
      ctx.beginPath();
      ctx.moveTo(0, L * 0.3);
      ctx.lineTo(0, -L * 0.7);
      ctx.stroke();
      const g = ctx.createRadialGradient(0, -L * 0.72, 0, 0, -L * 0.72, H * 0.14);
      g.addColorStop(0, look.aura);
      g.addColorStop(1, hexA(look.aura, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -L * 0.72, H * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.trim;
      ctx.beginPath();
      ctx.arc(0, -L * 0.72, H * 0.045, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'spear': {
      const L = H * 1.1;
      ctx.strokeStyle = '#4a3320';
      ctx.lineWidth = H * 0.03;
      ctx.beginPath();
      ctx.moveTo(0, L * 0.35);
      ctx.lineTo(0, -L * 0.65);
      ctx.stroke();
      outline(() => {
        ctx.moveTo(-H * 0.035, -L * 0.62);
        ctx.lineTo(0, -L * 0.82);
        ctx.lineTo(H * 0.035, -L * 0.62);
      }, steel);
      break;
    }
    case 'fan': {
      const R = H * 0.42;
      ctx.fillStyle = look.trim;
      ctx.strokeStyle = 'rgba(12,10,18,0.75)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, -Math.PI * 0.95, -Math.PI * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = hexA(look.primary, 0.8);
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= 4; i++) {
        const a = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        ctx.stroke();
      }
      break;
    }
    case 'claw': {
      ctx.strokeStyle = steelDark;
      ctx.lineWidth = H * 0.02;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * H * 0.03, 0);
        ctx.quadraticCurveTo(i * H * 0.06, -H * 0.16, i * H * 0.05, -H * 0.3);
        ctx.stroke();
      }
      break;
    }
    case 'gauntlet': {
      ctx.fillStyle = look.trim;
      ctx.strokeStyle = 'rgba(12,10,18,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-H * 0.055, -H * 0.09, H * 0.11, H * 0.16, H * 0.02);
      ctx.fill();
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/** `#rrggbb` (or an `rgb()` string) with an alpha applied. */
export function hexA(color: string, a: number): string {
  if (color.startsWith('rgb')) {
    return color.replace(/rgba?\(([^)]+)\)/, (_, inner: string) => {
      const parts = inner.split(',').slice(0, 3).map((s) => s.trim());
      return `rgba(${parts.join(',')},${a})`;
    });
  }
  const h = color.replace('#', '');
  const full = h.length === 3 ? h.split('').map((s) => s + s).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export { shade };
