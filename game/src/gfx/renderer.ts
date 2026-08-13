/**
 * Scene renderer.
 *
 * Owns the camera, the 2.5D projection and the draw order. Everything is drawn
 * into a fixed 960×540 logical space and then letterboxed to the device, so
 * layout maths never has to care about the actual screen — which matters when
 * the same build has to look right on a phone, a tablet and a desktop browser.
 */

import { assets } from '../core/assets';
import { clamp, lerp } from '../core/math';
import { fxRng, Rng } from '../core/rng';
import { getProjectile } from '../data/projectiles';
import type { Fighter, Pickup, Projectile, StageDef } from '../sim/types';
import type { World } from '../sim/world';
import { buildBackdrop, drawSky, type BakedLayer } from './backdrop';
import { FxSystem } from './fx';
import { blendPose, clonePose, getPose, POSES, type Pose } from './pose';
import { drawFighter, hexA, shade } from './rig';

export const LOGICAL_W = 960;
export const LOGICAL_H = 540;

/** Screen band the arena floor occupies. */
const GROUND_TOP = 306;
const GROUND_H = 168;

export interface Projected {
  sx: number;
  sy: number;
  scale: number;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  fx = new FxSystem();

  private layers: BakedLayer[] = [];
  private stage: StageDef | null = null;
  private time = 0;
  private shakeX = 0;
  private shakeY = 0;
  /** Reused pose buffer so per-frame blending allocates nothing. */
  private poseBuf: Pose = clonePose(POSES.stand);

  /** Device pixel size of the letterboxed viewport. */
  viewport = { x: 0, y: 0, w: LOGICAL_W, h: LOGICAL_H, scale: 1 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is not available in this browser');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);

    // Contain-fit the logical stage inside the device viewport.
    const scale = Math.min(this.canvas.width / LOGICAL_W, this.canvas.height / LOGICAL_H);
    this.viewport = {
      x: (this.canvas.width - LOGICAL_W * scale) / 2,
      y: (this.canvas.height - LOGICAL_H * scale) / 2,
      w: LOGICAL_W * scale,
      h: LOGICAL_H * scale,
      scale,
    };
  }

  /** Client (CSS pixel) point → logical canvas point. Used by touch input. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / rect.width;
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return {
      x: (px - this.viewport.x) / this.viewport.scale,
      y: (py - this.viewport.y) / this.viewport.scale,
    };
  }

  /**
   * Full-screen gradient fills were costing more than the whole cast put
   * together — a gradient fill shades every pixel, a drawImage blits. Sky,
   * floor and fog only change when the stage changes, so bake them once.
   */
  private skyTile: HTMLCanvasElement | null = null;
  private groundTile: HTMLCanvasElement | null = null;
  private fogTile: HTMLCanvasElement | null = null;
  private static vignetteTile: HTMLCanvasElement | null = null;

  setStage(stage: StageDef): void {
    this.stage = stage;
    this.layers = buildBackdrop(stage);
    this.fx.clear();
    this.skyTile = bakeSky(stage);
    this.groundTile = bakeGround(stage);
    this.fogTile = bakeFog(stage);
    if (!Renderer.vignetteTile) Renderer.vignetteTile = bakeVignette();
  }

  // -- projection ----------------------------------------------------------

  private depthT(z: number): number {
    const s = this.stage!;
    return clamp((z - s.zFar) / Math.max(1, s.zNear - s.zFar), 0, 1);
  }

  baseY(z: number): number {
    return GROUND_TOP + this.depthT(z) * GROUND_H;
  }

  depthScale(z: number): number {
    // Near fighters are ~30% larger than far ones — enough to read depth,
    // little enough that hitboxes still look honest.
    return 0.84 + this.depthT(z) * 0.3;
  }

  project = (x: number, y: number, z: number): Projected => {
    const scale = this.depthScale(z);
    return {
      sx: x - this.camX,
      sy: this.baseY(z) - y * scale,
      scale,
    };
  };

  private camX = 0;

  // -- main draw -----------------------------------------------------------

  draw(world: World, dt: number): void {
    const ctx = this.ctx;
    const stage = this.stage!;
    this.time += dt * 60;
    this.camX = world.camX;

    this.trackQuality(dt);

    // Screen shake decays in the sim; the renderer only samples it.
    const s = world.shake;
    this.shakeX = fxRng.range(-s, s);
    this.shakeY = fxRng.range(-s, s) * 0.6;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.scale, this.viewport.scale);
    ctx.beginPath();
    ctx.rect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.clip();

    // Camera zoom pivots on the centre of the action, not the screen corner.
    ctx.save();
    const zoom = world.camZoom;
    ctx.translate(LOGICAL_W / 2 + this.shakeX, LOGICAL_H * 0.56 + this.shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-LOGICAL_W / 2, -LOGICAL_H * 0.56);

    if (this.skyTile) {
      ctx.drawImage(this.skyTile, 0, 0);
      // Only the sun disc has to move; the wash behind it is baked in.
      const sunX = LOGICAL_W * 0.72 - world.camX * 0.02;
      ctx.fillStyle = hexA(stage.palette.sun, 0.9);
      ctx.beginPath();
      ctx.arc(sunX, LOGICAL_H * 0.3, LOGICAL_H * 0.045 + Math.sin(this.time * 0.01) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawSky(ctx, stage, LOGICAL_W, LOGICAL_H, world.camX, this.time);
    }
    this.drawBackdrop(world);
    this.drawGround(stage, world);

    this.spawnAmbient(world);
    this.fx.update();

    this.drawScene(world);

    this.drawFog();
    ctx.restore();

    this.drawPost(world);
    ctx.restore();
  }

  /** Rolling frame time, in ms. Seeded optimistically so a slow first frame
   *  (shader/tile warm-up) does not immediately drop the quality. */
  private frameMs = 16;

  private trackQuality(dt: number): void {
    if (dt <= 0) return;
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05;
    // Two thresholds with a gap between them, so quality does not oscillate
    // around a single boundary.
    if (this.frameMs > 22 && this.fx.quality > 0.35) {
      this.fx.quality = Math.max(0.35, this.fx.quality - 0.02);
    } else if (this.frameMs < 17 && this.fx.quality < 1) {
      this.fx.quality = Math.min(1, this.fx.quality + 0.01);
    }
  }

  private drawBackdrop(world: World): void {
    const ctx = this.ctx;
    const manifestLayers = assets.stageLayers(this.stage!.id);

    if (manifestLayers.length > 0) {
      // Generated art takes over wholesale when the manifest provides it.
      for (const l of manifestLayers) {
        const img = assets.image(l.src);
        if (!img) continue;
        const scale = l.scale ?? 1;
        const w = img.width * scale;
        ctx.globalAlpha = l.opacity ?? 1;
        ctx.globalCompositeOperation = l.additive ? 'lighter' : 'source-over';
        let x = -((world.camX * l.parallax) % w);
        if (x > 0) x -= w;
        do {
          ctx.drawImage(img, x, l.y, w, img.height * scale);
          x += w;
        } while (l.repeat !== false && x < LOGICAL_W);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      return;
    }

    for (const l of this.layers) {
      const w = l.canvas.width;
      ctx.globalAlpha = l.opacity;
      ctx.globalCompositeOperation = l.additive ? 'lighter' : 'source-over';
      let x = -(((world.camX * l.parallax + this.time * l.drift) % w + w) % w);
      while (x < LOGICAL_W) {
        ctx.drawImage(l.canvas, x, l.y);
        x += w;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawGround(stage: StageDef, world: World): void {
    const ctx = this.ctx;
    if (!this.groundTile) return;
    // The floor tile carries its own gradient, perspective lines and scatter,
    // and is twice the viewport wide so it can scroll without a seam.
    const w = this.groundTile.width;
    let x = -(((world.camX * 0.5) % w) + w) % w;
    while (x < LOGICAL_W) {
      ctx.drawImage(this.groundTile, x, GROUND_TOP);
      x += w;
    }
    void stage;
  }

  /** Particles spawned per frame, per weather type. Tuned by eye on a phone. */
  private static readonly WEATHER_RATE: Record<string, number> = {
    none: 0, snow: 1.1, rain: 1.8, embers: 0.7, petals: 0.45,
    sand: 0.4, ash: 0.4, fireflies: 0.28, stars: 0.35,
  };

  private weatherAcc = 0;

  private spawnAmbient(world: World): void {
    const stage = this.stage!;
    // Back off entirely when combat effects are already filling the budget —
    // ambience must never be the reason a hit feels laggy.
    const headroom = this.fx.count < 300 ? 1 : this.fx.count < 420 ? 0.4 : 0;
    this.weatherAcc += (Renderer.WEATHER_RATE[stage.weather] ?? 0) * headroom * this.fx.quality;
    while (this.weatherAcc >= 1) {
      this.weatherAcc--;
      this.fx.weather(stage.weather, world.camX, LOGICAL_W, GROUND_TOP);
    }
    if (this.time % 3 < 1) {
      for (const f of world.fighters) {
        if (f.dead) continue;
        const amb = f.def.look.ambient;
        if (!amb || amb === 'none') continue;
        this.fx.ambient(amb, f.x, f.y, f.z, f.def.look.aura);
      }
    }
  }

  /** Draws everything in the arena, sorted back-to-front by depth. */
  private drawScene(world: World): void {
    const ctx = this.ctx;
    const stage = this.stage!;

    interface Item { z: number; draw: () => void }
    const items: Item[] = [];

    for (const f of world.fighters) {
      items.push({ z: f.z, draw: () => this.drawFighterEntity(world, f) });
    }
    for (const p of world.projectiles) {
      items.push({ z: p.z, draw: () => this.drawProjectile(p) });
    }
    for (const it of world.pickups) {
      items.push({ z: it.z, draw: () => this.drawPickup(it) });
    }

    items.sort((a, b) => a.z - b.z);

    // Shadows first, as a single pass — they must never sit on top of a
    // fighter standing behind them.
    for (const f of world.fighters) this.drawShadow(f.x, f.y, f.z, f.def.half * 1.5, f.dead ? 0.25 : 0.45);
    for (const p of world.projectiles) {
      const pd = getProjectile(p.kind);
      if (pd.style !== 'beam') this.drawShadow(p.x, p.y, p.z, 10 * p.scale, 0.22);
    }

    // Interleave particles with the cast in depth bands.
    const bands = 5;
    const zFar = stage.zFar;
    const zSpan = (stage.zNear - stage.zFar) / bands;
    let idx = 0;
    for (let b = 0; b <= bands; b++) {
      const zLimit = b === bands ? Infinity : zFar + (b + 1) * zSpan;
      while (idx < items.length && items[idx].z < zLimit) {
        items[idx].draw();
        idx++;
      }
      this.fx.draw(ctx, this.project, b === 0 ? -Infinity : zFar + b * zSpan, zLimit);
    }

    this.drawDamageNumbers(world);
  }

  private static shadowTile: HTMLCanvasElement | null = null;

  private drawShadow(x: number, y: number, z: number, r: number, alpha: number): void {
    const ctx = this.ctx;
    if (!Renderer.shadowTile) Renderer.shadowTile = bakeShadow();
    const { sx } = this.project(x, 0, z);
    const by = this.baseY(z);
    const scale = this.depthScale(z);
    // Shadows shrink and fade with altitude — the main read for "how high".
    const lift = clamp(1 - y / 220, 0.32, 1);
    const rr = r * scale * lift;
    ctx.globalAlpha = alpha * lift;
    ctx.drawImage(Renderer.shadowTile, sx - rr, by - rr * 0.34, rr * 2, rr * 0.68);
    ctx.globalAlpha = 1;
  }

  /** Blend the current action frame toward the next so motion stays fluid. */
  private currentPose(f: Fighter): Pose {
    const act = f.action;
    const fr = act.frames[f.frameIdx];
    if (!fr) return getPose('stand');
    const nextFr = act.frames[f.frameIdx + 1] ?? (act.loop ? act.frames[0] : null);
    const a = getPose(fr.pose);
    if (!nextFr || fr.dur <= 1) return a;
    const b = getPose(nextFr.pose);
    const t = clamp(f.frameTime / fr.dur, 0, 1);
    return blendPose(a, b, t * t * (3 - 2 * t), this.poseBuf);
  }

  private drawFighterEntity(world: World, f: Fighter): void {
    const ctx = this.ctx;
    const { sx, sy, scale } = this.project(f.x, f.y, f.z);
    const pose = this.currentPose(f);
    const H = f.def.height * f.def.look.scale * scale;

    // After-images for fast movement and supers — first thing to go when
    // the frame budget is tight.
    for (const gh of this.fx.quality > 0.6 ? f.ghosts : []) {
      const gp = this.project(gh.x, gh.y, gh.z);
      const t = gh.t / 14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(gp.sx, gp.sy);
      ctx.scale(gh.facing * gp.scale, gp.scale);
      drawFighter(ctx, f.def.look, getPose(gh.pose), {
        height: f.def.height * f.def.look.scale,
        alpha: t * 0.32,
        silhouette: f.def.look.aura,
        outline: 0,
        time: this.time,
      });
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    const sheet = assets.characterSheet(f.charId);
    if (sheet) {
      this.drawSprite(f, sheet, sx, sy, scale);
    } else {
      ctx.save();
      ctx.translate(sx, sy);
      // Mirroring by facing is what lets every pose be authored facing right.
      ctx.scale(f.facing * scale, scale);
      const charging = f.action.tag === 'super' || (f.action.tag === 'special' && f.frameIdx === 0);
      drawFighter(ctx, f.def.look, pose, {
        height: f.def.height * f.def.look.scale,
        time: this.time,
        outline: 2.2,
        alpha: f.invuln > 0 && Math.floor(this.time / 3) % 2 === 0 ? 0.45 : 1,
        glow: charging ? 0.9 : f.action.tag === 'special' ? 0.4 : 0,
        glowColor: f.def.look.aura,
        frozen: f.freeze,
        burning: f.burn,
      });
      ctx.restore();
    }

    if (f.burn > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(sx, sy - H * 0.45, 0, sx, sy - H * 0.45, H * 0.7);
      g.addColorStop(0, 'rgba(255,140,50,0.35)');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - H, sy - H * 1.2, H * 2, H * 1.4);
      ctx.restore();
    }

    this.drawFighterTag(world, f, sx, sy, H);
  }

  /** Floating name/health above enemies, and a marker above the player. */
  private drawFighterTag(world: World, f: Fighter, sx: number, sy: number, H: number): void {
    const ctx = this.ctx;
    if (f.dead) return;

    if (f.mode === 'player') {
      const bob = Math.sin(this.time * 0.08) * 3;
      ctx.fillStyle = '#7ce0a0';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - H - 16 + bob);
      ctx.lineTo(sx - 7, sy - H - 28 + bob);
      ctx.lineTo(sx + 7, sy - H - 28 + bob);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      return;
    }

    const w = 44;
    const frac = clamp(f.hp / f.hpMax, 0, 1);
    const ghost = clamp(f.hpGhost / f.hpMax, 0, 1);
    const y = sy - H - 14;
    ctx.fillStyle = 'rgba(8,8,14,0.65)';
    ctx.fillRect(sx - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = 'rgba(255,90,90,0.55)';
    ctx.fillRect(sx - w / 2, y, w * ghost, 4);
    ctx.fillStyle = f.vars.level >= 1.5 ? '#ffb347' : '#ff6b6b';
    ctx.fillRect(sx - w / 2, y, w * frac, 4);
    void world;
  }

  private drawSprite(f: Fighter, sheet: ReturnType<typeof assets.characterSheet>, sx: number, sy: number, scale: number): void {
    if (!sheet) return;
    const img = assets.image(sheet.src);
    if (!img) return;
    const poseId = f.action.frames[f.frameIdx]?.pose ?? 'stand';
    const frames = sheet.poses[poseId] ?? sheet.poses.stand ?? [0];
    const idx = frames[Math.floor(this.time / 6) % frames.length];
    const cols = sheet.cols || 1;
    const sxSheet = (idx % cols) * sheet.frameW;
    const sySheet = Math.floor(idx / cols) * sheet.frameH;
    const ppu = sheet.ppu ?? 1;
    const w = (sheet.frameW / ppu) * scale;
    const h = (sheet.frameH / ppu) * scale;
    const ax = sheet.anchorX ?? 0.5;
    const ay = sheet.anchorY ?? 1;

    const ctx = this.ctx;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(f.facing, 1);
    ctx.drawImage(img, sxSheet, sySheet, sheet.frameW, sheet.frameH, -w * ax, -h * ay, w, h);
    ctx.restore();
  }

  private drawProjectile(p: Projectile): void {
    const ctx = this.ctx;
    const pd = getProjectile(p.kind);
    const { sx, sy, scale } = this.project(p.x, p.y, p.z);
    const s = p.scale * scale;
    const t = this.time;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    switch (pd.style) {
      case 'orb': {
        const r = 16 * s;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.28, pd.color);
        g.addColorStop(0.62, hexA(pd.color2 ?? pd.color, 0.6));
        g.addColorStop(1, hexA(pd.color2 ?? pd.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.4, 0, Math.PI * 2);
        ctx.fill();
        // Orbiting sparks make a flat circle read as energy.
        ctx.strokeStyle = hexA('#ffffff', 0.8);
        ctx.lineWidth = 1.6 * s;
        for (let i = 0; i < 3; i++) {
          const a = t * 0.12 + (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(sx, sy, r * 1.5, r * 0.5, a, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'bolt': {
        ctx.strokeStyle = pd.color;
        ctx.lineWidth = 4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - p.facing * 44 * s, sy + Math.sin(t * 0.5) * 6);
        for (let i = 1; i <= 4; i++) {
          ctx.lineTo(sx - p.facing * 44 * s + p.facing * i * 11 * s, sy + Math.sin(t * 0.5 + i) * 7 * s);
        }
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6 * s;
        ctx.stroke();
        break;
      }
      case 'wave': {
        const w = 46 * s;
        const h = 54 * s;
        const g = ctx.createLinearGradient(sx - w, sy, sx + w, sy);
        g.addColorStop(0, hexA(pd.color2 ?? pd.color, 0));
        g.addColorStop(0.5, hexA(pd.color, 0.9));
        g.addColorStop(1, hexA('#ffffff', 0.5));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(sx, sy - h * 0.5, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
          const yy = sy - h * (0.2 + i * 0.28);
          ctx.strokeStyle = hexA('#ffffff', 0.35);
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.moveTo(sx - w * 0.7, yy);
          ctx.quadraticCurveTo(sx, yy - 10 * s, sx + w * 0.7, yy);
          ctx.stroke();
        }
        break;
      }
      case 'shard':
      case 'blade': {
        const len = (pd.style === 'blade' ? 34 : 20) * s;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.atan2(-p.vy, p.vx));
        const g = ctx.createLinearGradient(-len, 0, len, 0);
        g.addColorStop(0, hexA(pd.color2 ?? pd.color, 0));
        g.addColorStop(0.6, pd.color);
        g.addColorStop(1, '#ffffff');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, -8 * s);
        ctx.lineTo(len, 0);
        ctx.lineTo(0, 8 * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'beam': {
        const life = p.life / getProjectile(p.kind).life;
        const thick = (pd.style === 'beam' ? 40 : 20) * s * Math.sin(Math.PI * clamp(life, 0, 1)) * 1.4;
        if (p.kind === 'skyStrike') {
          // Vertical strike from off the top of the screen.
          const g = ctx.createLinearGradient(sx - thick, 0, sx + thick, 0);
          g.addColorStop(0, hexA(pd.color2 ?? pd.color, 0));
          g.addColorStop(0.5, '#ffffff');
          g.addColorStop(1, hexA(pd.color2 ?? pd.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(sx - thick, -20, thick * 2, this.baseY(p.z) + 20);
        } else {
          const g = ctx.createLinearGradient(0, sy - thick, 0, sy + thick);
          g.addColorStop(0, hexA(pd.color2 ?? pd.color, 0));
          g.addColorStop(0.5, '#ffffff');
          g.addColorStop(1, hexA(pd.color2 ?? pd.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(sx - LOGICAL_W, sy - thick, LOGICAL_W * 2, thick * 2);
        }
        break;
      }
      case 'geyser': {
        // Solid, not additive: on a bright stage an additive spike washed out
        // to a flat white triangle with no read at all.
        ctx.globalCompositeOperation = 'source-over';
        const life = 1 - p.life / getProjectile(p.kind).life;
        const grow = clamp(life * 3, 0, 1);
        const h = 96 * s * grow;
        const w = 20 * s;
        const g = ctx.createLinearGradient(0, sy, 0, sy - h);
        g.addColorStop(0, hexA(pd.color2 ?? pd.color, 0.95));
        g.addColorStop(0.55, hexA(pd.color, 0.9));
        g.addColorStop(1, hexA('#ffffff', 0.85));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(sx - w, sy);
        ctx.lineTo(sx - w * 0.3, sy - h * 0.55);
        ctx.lineTo(sx, sy - h);
        ctx.lineTo(sx + w * 0.42, sy - h * 0.5);
        ctx.lineTo(sx + w, sy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexA(shade(pd.color2 ?? pd.color, -0.45), 0.9);
        ctx.lineWidth = 1.8 * s;
        ctx.stroke();
        // Inner highlight so the shape reads as faceted crystal / stone.
        ctx.strokeStyle = hexA('#ffffff', 0.55);
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.15, sy);
        ctx.lineTo(sx, sy - h * 0.92);
        ctx.stroke();
        break;
      }
      case 'ring': {
        const r = 24 * s;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.2 * p.facing);
        ctx.strokeStyle = pd.color;
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = hexA(pd.color2 ?? pd.color, 0.8);
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'rock': {
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.14 * p.facing);
        ctx.fillStyle = pd.color;
        ctx.strokeStyle = pd.color2 ?? '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const r = 14 * s;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const rr = r * (0.75 + ((i * 37) % 10) / 22);
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'petal': {
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.2);
        ctx.fillStyle = pd.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9 * s, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = pd.color2 ?? pd.color;
        ctx.beginPath();
        ctx.ellipse(3 * s, 0, 4 * s, 2.4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'scythe': {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.24 * p.facing);
        ctx.strokeStyle = pd.color;
        ctx.lineWidth = 7 * s;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          ctx.rotate(Math.PI);
          ctx.beginPath();
          ctx.arc(0, 0, 24 * s, -0.9, 0.9);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
      case 'meteor': {
        const r = 22 * s;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, pd.color);
        g.addColorStop(1, hexA(pd.color2 ?? pd.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'mine': {
        const pulse = 0.6 + Math.sin(t * 0.2) * 0.4;
        const r = 13 * s;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.2 * pulse);
        g.addColorStop(0, pd.color);
        g.addColorStop(1, hexA(pd.color2 ?? pd.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.2 * pulse, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'weapon':
      default: {
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 0.35 * p.facing);
        ctx.strokeStyle = pd.color;
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.moveTo(-14 * s, 0);
        ctx.lineTo(14 * s, 0);
        ctx.stroke();
        ctx.restore();
        break;
      }
    }
    ctx.restore();
  }

  private drawPickup(it: Pickup): void {
    const ctx = this.ctx;
    const { sx, sy, scale } = this.project(it.x, it.y, it.z);
    const bob = Math.sin(this.time * 0.08 + it.uid) * 3;
    const color = it.kind === 'heal' ? '#6fe08a' : it.kind === 'mana' ? '#6fb8ff' : '#dce4f0';
    const blink = it.life < 180 && Math.floor(this.time / 6) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy - 10 + bob, 0, sx, sy - 10 + bob, 22 * scale);
    g.addColorStop(0, hexA(color, 0.9));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy - 10 + bob, 22 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(10,10,16,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (it.kind === 'heal' || it.kind === 'mana') {
      ctx.arc(sx, sy - 10 + bob, 7 * scale, 0, Math.PI * 2);
    } else {
      ctx.rect(sx - 9 * scale, sy - 14 + bob, 18 * scale, 6 * scale);
    }
    ctx.fill();
    ctx.stroke();
  }

  private drawDamageNumbers(world: World): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let drawn = 0;
    for (const d of world.damageNumbers) {
      if (++drawn > 24) break;
      const { sx, sy, scale } = this.project(d.x, d.y, d.z);
      const t = d.life / 48;
      const size = (d.crit ? 26 : 18) * scale * (1 + (1 - t) * 0.15);
      ctx.globalAlpha = clamp(t * 1.6, 0, 1);
      ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(8,6,14,0.85)';
      ctx.strokeText(String(d.value), sx, sy);
      ctx.fillStyle = d.color;
      ctx.fillText(String(d.value), sx, sy);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawFog(): void {
    if (this.fogTile) this.ctx.drawImage(this.fogTile, 0, GROUND_TOP - 54);
  }

  /** Full-screen grade: flash, vignette, subtle bloom, letterbox bars. */
  private drawPost(world: World): void {
    const ctx = this.ctx;

    if (world.flash) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp(world.flash.life / 8, 0, 1) * 0.55;
      ctx.fillStyle = world.flash.color;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }

    if (Renderer.vignetteTile) ctx.drawImage(Renderer.vignetteTile, 0, 0);

    // Slow-motion tint, so the player can feel the super without a UI label.
    if (world.slowmo > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = clamp(world.slowmo / 60, 0, 1) * 0.3;
      ctx.fillStyle = '#3a2a6a';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.restore();
    }
  }

  /** Convenience for UI code that needs the same letterboxed transform. */
  beginUi(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(this.viewport.x, this.viewport.y);
    ctx.scale(this.viewport.scale, this.viewport.scale);
  }

  endUi(): void {
    this.ctx.restore();
  }

  clearUi(color = '#05060a'): void {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

// ---------------------------------------------------------------------------
// Baked tiles
// ---------------------------------------------------------------------------

function tile(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function bakeSky(stage: StageDef): HTMLCanvasElement {
  const { c, ctx } = tile(LOGICAL_W, LOGICAL_H);
  drawSky(ctx, stage, LOGICAL_W, LOGICAL_H, 0, 0);
  return c;
}

/**
 * The arena floor: gradient, receding depth lines, converging streaks and a
 * scatter of debris. Baked at double width so scrolling it never shows a seam.
 */
function bakeGround(stage: StageDef): HTMLCanvasElement {
  const w = LOGICAL_W * 2;
  const h = LOGICAL_H - GROUND_TOP;
  const { c, ctx } = tile(w, h);
  const p = stage.palette;
  const rng = new Rng(stage.id.length * 7919 + stage.width);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(p.ground, -0.3));
  g.addColorStop(0.35, p.ground);
  g.addColorStop(1, shade(p.ground, 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = hexA(p.groundLine, 0.14);
  ctx.lineWidth = 1;
  for (let i = 1; i <= 6; i++) {
    // Lines bunch up toward the horizon, which is what sells the recession.
    const t = (i / 7) ** 1.5;
    const y = t * GROUND_H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.strokeStyle = hexA(p.groundLine, 0.1);
  const spacing = 160;
  for (let x = 0; x <= w; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + 46, 0);
    ctx.lineTo(x - 46, h);
    ctx.stroke();
  }

  // Debris scatter, denser and larger toward the camera.
  for (let i = 0; i < 260; i++) {
    const y = Math.pow(rng.next(), 0.6) * h;
    const x = rng.range(0, w);
    const s = 1 + (y / h) * 3.4;
    ctx.fillStyle = hexA(rng.chance(0.5) ? p.groundLine : shade(p.ground, -0.35), rng.range(0.1, 0.35));
    ctx.beginPath();
    ctx.ellipse(x, y, s * rng.range(0.6, 1.8), s * rng.range(0.3, 0.7), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Contact shadow along the back edge grounds the whole plane.
  const edge = ctx.createLinearGradient(0, 0, 0, 44);
  edge.addColorStop(0, 'rgba(0,0,0,0.5)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, 44);
  return c;
}

function bakeFog(stage: StageDef): HTMLCanvasElement {
  const h = GROUND_H + 54;
  const { c, ctx } = tile(LOGICAL_W, h);
  // Aerial perspective: strongest at the far edge of the floor, fading both
  // ways so the band never shows a hard seam.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hexA(stage.palette.fog, 0));
  g.addColorStop(0.34, hexA(stage.palette.fog, 0.34));
  g.addColorStop(1, hexA(stage.palette.fog, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LOGICAL_W, h);
  return c;
}

function bakeShadow(): HTMLCanvasElement {
  const { c, ctx } = tile(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

function bakeVignette(): HTMLCanvasElement {
  const { c, ctx } = tile(LOGICAL_W, LOGICAL_H);
  const v = ctx.createRadialGradient(
    LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.35,
    LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.85,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  return c;
}

export { lerp };
